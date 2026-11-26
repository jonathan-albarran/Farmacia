const express = require("express");
const router = express.Router();
const db = require("../config/database");

        
function obtenerDatosProducto(body) {
    const entrada = body && typeof body === "object" && !Array.isArray(body)
        ? body
        : {};

    const nombre = typeof entrada.nombre === "string"
        ? entrada.nombre.trim()
        : "";

    const categoriaId = Number(entrada.categoria_id);

    const precioTexto = typeof entrada.precio_venta === "string" ||
        typeof entrada.precio_venta === "number"
        ? String(entrada.precio_venta)
        : "";

    const stockTexto = entrada.stock_minimo == null
        ? "5"
        : String(entrada.stock_minimo);

    const estado = entrada.estado ?? "ACTIVO";

    const camposOpcionales = [
        ["principio_activo", 150],
        ["concentracion", 100],
        ["presentacion", 100]
    ];

    const datos = {};

    // Validar nombre
    if (!nombre) {
        return { error: "El nombre es obligatorio" };
    }

    if (nombre.length > 150) {
        return {
            error: "El nombre no puede superar los 150 caracteres"
        };
    }

    // Validar categoría
    if (
        !Number.isSafeInteger(categoriaId) ||
        categoriaId < 1
    ) {
        return {
            error: "Selecciona una categoría válida"
        };
    }

    // Validar precio
    if (!/^\d{1,8}(\.\d{1,2})?$/.test(precioTexto)) {
        return {
            error: "El precio debe ser un número válido con máximo 2 decimales"
        };
    }

    const precioVenta = Number(precioTexto);

    if (!Number.isFinite(precioVenta) || precioVenta <= 0) {
        return {
            error: "El precio de venta debe ser mayor a cero"
        };
    }

    // Validar stock mínimo
    if (!/^\d+$/.test(stockTexto)) {
        return {
            error: "El stock mínimo debe ser un entero no negativo"
        };
    }

    const stockMinimo = Number(stockTexto);

    if (
        !Number.isSafeInteger(stockMinimo) ||
        stockMinimo > 2147483647
    ) {
        return {
            error: "El stock mínimo está fuera del límite permitido"
        };
    }

    // Validar estado
    if (
        typeof estado !== "string" ||
        !["ACTIVO", "INACTIVO"].includes(estado)
    ) {
        return {
            error: "El estado debe ser ACTIVO o INACTIVO"
        };
    }

    // Validar campos opcionales
    for (const [campo, maximo] of camposOpcionales) {
        const valor = entrada[campo];

        if (valor != null && typeof valor !== "string") {
            return {
                error: `El campo ${campo.replace("_", " ")} no es válido`
            };
        }

        const texto = typeof valor === "string"
            ? valor.trim()
            : "";

        if (texto.length > maximo) {
            return {
                error: `El campo ${campo.replace("_", " ")} supera el límite permitido`
            };
        }

        datos[campo] = texto || null;
    }

    // Regresar los datos validados
    return {
        nombre,
        principio_activo: datos.principio_activo,
        concentracion: datos.concentracion,
        presentacion: datos.presentacion,
        precio_venta: precioVenta,
        stock_minimo: stockMinimo,
        categoria_id: categoriaId,
        estado
    };
}
