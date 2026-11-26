const express = require("express");
const router = express.Router();
const db = require("../config/database");

function obtenerDatosProducto(body) {
    const entrada = body && typeof body === "object" ? body : {};
    const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
    const categoriaId = Number(entrada.categoria_id);
    const precioTexto = String(entrada.precio_venta ?? "");
    const stockTexto = String(entrada.stock_minimo ?? "5");
    const estado = entrada.estado ?? "ACTIVO";
    const camposOpcionales = [
        ["principio_activo", 150],
        ["concentracion", 100],
        ["presentacion", 100]
    ];
    const datos = {};

    if (!nombre) {
        return { error: "El nombre es obligatorio" };
    }

    if (nombre.length > 150) {
        return { error: "El nombre no puede superar los 150 caracteres" };
    }

    if (!Number.isInteger(categoriaId) || categoriaId < 1) {
        return { error: "Selecciona una categoría válida" };
    }

    if (!/^\d{1,8}(\.\d{1,2})?$/.test(precioTexto)) {
        return { error: "El precio de venta debe ser un número entre 0 y 99,999,999.99 con máximo 2 decimales" };
    }

    if (!/^\d+$/.test(stockTexto) || Number(stockTexto) > 2147483647) {
        return { error: "El stock mínimo debe ser un entero no negativo" };
    }

    if (!["ACTIVO", "INACTIVO"].includes(estado)) {
        return { error: "El estado debe ser ACTIVO o INACTIVO" };
    }

    for (const [campo, maximo] of camposOpcionales) {
        const valor = entrada[campo];
        if (valor != null && typeof valor !== "string") {
            return { error: `El campo ${campo.replace("_", " ")} no es válido` };
        }

        const texto = typeof valor === "string" ? valor.trim() : "";
        if (texto.length > maximo) {
            return { error: `El campo ${campo.replace("_", " ")} supera el límite permitido` };
        }
        datos[campo] = texto || null;
    }

    return {
        nombre,
        principio_activo: datos.principio_activo,
        concentracion: datos.concentracion,
        presentacion: datos.presentacion,
        precio_venta: Number(precioTexto),
        stock_minimo: Number(stockTexto),
        categoria_id: categoriaId,
        estado
    };
}

async function existeCategoria(id) {
    const [categorias] = await db.query(
        "SELECT id FROM categorias WHERE id = ?",
        [id]
    );
    return categorias.length > 0;
}

 // Buscar medicamentos por nombre
router.get("/buscar", async (req, res) => {
    try {
        const busqueda = String(req.query.nombre || "").trim();

        const [productos] = await db.query(
            `SELECT p.id, p.nombre, p.principio_activo, p.concentracion,
                    p.presentacion, p.precio_venta, p.stock_minimo,
                    p.categoria_id, p.estado, p.fecha_registro,
                    c.nombre AS categoria_nombre
             FROM productos p
             JOIN categorias c ON c.id = p.categoria_id
             WHERE p.nombre LIKE ?
             ORDER BY p.nombre ASC`,
            [`%${busqueda}%`]
        );

        return res.json(productos);
    } catch (error) {
        console.error("Error al buscar medicamentos:", error.message);

        return res.status(500).json({
            mensaje: "Error al buscar medicamentos"
        });
    }
});

//Listar medicamentos
router.get("/", async (req, res) => {
    try {
        const [productos] = await db.query(
            `SELECT p.id, p.nombre, p.principio_activo, p.concentracion, p.presentacion,
                    p.precio_venta, p.stock_minimo, p.categoria_id, p.estado, p.fecha_registro,
                    c.nombre AS categoria_nombre
             FROM productos p
             JOIN categorias c ON c.id = p.categoria_id
             ORDER BY p.nombre ASC`
        );
        return res.json(productos);
    } catch (error) {
        console.error("Error al consultar medicamentos:", error.message);
        return res.status(500).json({ mensaje: "Error al consultar medicamentos" });
    }
});


//Agregar medicamento
router.post("/", async (req, res) => {
    try {
        const datos = obtenerDatosProducto(req.body);
        if (datos.error) {
            return res.status(400).json({ mensaje: datos.error });
        }

        if (!await existeCategoria(datos.categoria_id)) {
            return res.status(400).json({ mensaje: "La categoría seleccionada no existe" });
        }

        const [resultado] = await db.query(
            `INSERT INTO productos
             (nombre, principio_activo, concentracion, presentacion,
              precio_venta, stock_minimo, categoria_id, estado)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                datos.nombre,
                datos.principio_activo,
                datos.concentracion,
                datos.presentacion,
                datos.precio_venta,
                datos.stock_minimo,
                datos.categoria_id,
                datos.estado
            ]
        );

        return res.status(201).json({
            mensaje: "Medicamento registrado correctamente",
            id: resultado.insertId
        });
    } catch (error) {
        console.error("Error al registrar medicamento:", error.message);
        return res.status(500).json({ mensaje: "Error al registrar medicamento" });
    }
});

//Actualizar medicamento
router.put("/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const datos = obtenerDatosProducto(req.body);
        if (datos.error) {
            return res.status(400).json({ mensaje: datos.error });
        }

        if (!await existeCategoria(datos.categoria_id)) {
            return res.status(400).json({ mensaje: "La categoría seleccionada no existe" });
        }

        const [productos] = await db.query(
            "SELECT id FROM productos WHERE id = ?",
            [id]
        );
        if (productos.length === 0) {
            return res.status(404).json({ mensaje: "Medicamento no encontrado" });
        }

        await db.query(
            `UPDATE productos
             SET nombre = ?, principio_activo = ?, concentracion = ?, presentacion = ?,
                 precio_venta = ?, stock_minimo = ?, categoria_id = ?, estado = ?
             WHERE id = ?`,
            [
                datos.nombre,
                datos.principio_activo,
                datos.concentracion,
                datos.presentacion,
                datos.precio_venta,
                datos.stock_minimo,
                datos.categoria_id,
                datos.estado,
                id
            ]
        );

        return res.json({ mensaje: "Medicamento actualizado correctamente" });
    } catch (error) {
        console.error("Error al actualizar medicamento:", error.message);
        return res.status(500).json({ mensaje: "Error al actualizar medicamento" });
    }
});

//Eliminar medicamento
router.delete("/:id", async (req, res) => {
    try {
        const [resultado] = await db.query(
            "DELETE FROM productos WHERE id = ?",
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({ mensaje: "Medicamento no encontrado" });
        }

        return res.json({ mensaje: "Medicamento eliminado correctamente" });
    } catch (error) {
        if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
            return res.status(409).json({
                mensaje: "No se puede eliminar porque tiene lotes asociados"
            });
        }

        console.error("Error al eliminar medicamento:", error.message);
        return res.status(500).json({ mensaje: "Error al eliminar medicamento" });
    }
});

module.exports = router;
