import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import CrudForm, { CrudInput, CrudSelect } from "../../components/common/CrudForm";
import CrudList from "../../components/common/CrudList";
import CrudTable from "../../components/common/CrudTable";
import useCrudForm from "../../hooks/useCrudForm";
import { apiRequest } from "../../services/api";
import { codigoMedicamento } from "../../utils/formato";
import { obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";

const formularioInicial = {
  nombre: "",
  principio_activo: "",
  concentracion: "",
  presentacion: "",
  precio_venta: "0",
  stock_minimo: "5",
  categoria_id: "",
  estado: "ACTIVO"
};

const camposPrincipales = [
  { id: "nombre-producto", label: "Nombre", name: "nombre", placeholder: "Ej. Marca", maxLength: 150, required: true },
  { id: "principio-activo", label: "Principio activo", name: "principio_activo", placeholder: "Ej. Paracetamol", maxLength: 150 }
];

const filasProducto = [
  [
    { id: "concentracion-producto", label: "Concentración", name: "concentracion", placeholder: "Ej. 500 mg", maxLength: 100 },
    { id: "presentacion-producto", label: "Presentación", name: "presentacion", placeholder: "Ej. Caja con 20 tabletas", maxLength: 100 }
  ],
  [
    { id: "precio-venta", label: "Precio de venta", name: "precio_venta", type: "number", min: "0", max: "99999999.99", step: "0.01", required: true },
    { id: "stock-minimo", label: "Stock mínimo", name: "stock_minimo", type: "number", min: "0", step: "1", required: true }
  ]
];

// Gestiona los productos y categorías, controla los permisos
// Del usuario y carga los datos desde el servidor.
export default function Productos() {
  const rolUsuario = normalizarRol(obtenerUsuarioActual()?.rol);
  const puedeEliminar = ["administrador", "dueno"].includes(rolUsuario);
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [productoEditando, setProductoEditando] = useState(null);
  const {
    values: formulario,
    handleChange,
    fill: llenarFormulario,
    reset: reiniciarFormulario
  } = useCrudForm(formularioInicial);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  async function cargarDatos() {
    try {
      const [productosDatos, categoriasDatos] = await Promise.all([
        apiRequest("/productos"),
        apiRequest("/categorias")
      ]);
      if (!Array.isArray(productosDatos) || !Array.isArray(categoriasDatos)) {
        throw new Error("El servidor devolvió datos de medicamentos o categorías inválidos.");
      }
      setProductos(productosDatos);
      setCategorias(categoriasDatos);
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al conectar con el servidor."
      });
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const actualizarTrasSincronizar = () => {
      void cargarDatos();
    };
    window.addEventListener("offline-sync-complete", actualizarTrasSincronizar);
    void Promise.resolve().then(cargarDatos);

    return () => {
      window.removeEventListener("offline-sync-complete", actualizarTrasSincronizar);
    };
  }, []);

  function abrirFormulario(producto = null) {
    setProductoEditando(producto);
    llenarFormulario(producto ? {
      nombre: producto.nombre,
      principio_activo: producto.principio_activo || "",
      concentracion: producto.concentracion || "",
      presentacion: producto.presentacion || "",
      precio_venta: String(producto.precio_venta),
      stock_minimo: String(producto.stock_minimo),
      categoria_id: String(producto.categoria_id),
      estado: producto.estado
    } : formularioInicial);
  }

  function limpiarFormulario() {
    setProductoEditando(null);
    reiniciarFormulario();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const editando = Boolean(productoEditando);

    const confirmacion = editando
      ? `¿Guardar los cambios del medicamento "${productoEditando.nombre}"?`
      : `¿Agregar el medicamento "${formulario.nombre.trim()}"?`;
    if (!window.confirm(confirmacion)) {
      return;
    }

    setGuardando(true);

    try {
      const datos = {
        ...formulario,
        precio_venta: Number(formulario.precio_venta),
        stock_minimo: Number(formulario.stock_minimo),
        categoria_id: Number(formulario.categoria_id)
      };
      await apiRequest(
        productoEditando ? `/productos/${productoEditando.id}` : "/productos",
        {
          method: productoEditando ? "PUT" : "POST",
          body: JSON.stringify(datos)
        }
      );

      limpiarFormulario();
      await cargarDatos();
      setNotificacion({
        type: "success",
        message: editando
          ? "Medicamento actualizado"
          : "Medicamento agregado"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al guardar el medicamento."
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarProducto(producto) {
    if (!window.confirm(`¿Eliminar el medicamento "${producto.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(producto.id);

    try {
      await apiRequest(`/productos/${producto.id}`, { method: "DELETE" });
      await cargarDatos();
      setNotificacion({
        type: "success",
        message: "Medicamento eliminado"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al eliminar el medicamento."
      });
    } finally {
      setEliminandoId(null);
    }
  }

  const productosFiltrados = productos.filter((producto) => {
    const consulta = busqueda.trim().toLocaleLowerCase();
    return [
      producto.nombre,
      producto.principio_activo,
      producto.categoria_nombre
    ].some((valor) => valor?.toLocaleLowerCase().includes(consulta));
  });
  const columnas = [
    { label: "Código", render: (producto) => codigoMedicamento(producto.id) },
    {
      label: "Medicamento",
      render: (producto) => (
        <>
          <strong>{producto.nombre}</strong>
          {producto.principio_activo && <small>{producto.principio_activo}</small>}
        </>
      )
    },
    {
      label: "Presentación",
      render: (producto) => (
        [producto.concentracion, producto.presentacion].filter(Boolean).join(" · ") || "—"
      )
    },
    { label: "Precio", render: (producto) => `$${Number(producto.precio_venta).toFixed(2)}` },
    { label: "Stock mínimo", render: (producto) => producto.stock_minimo },
    { label: "Categoría", render: (producto) => producto.categoria_nombre || "—" },
    {
      label: "Estado",
      render: (producto) => producto.estado === "ACTIVO" ? "Activo" : "Inactivo"
    },
    {
      label: "Acciones",
      render: (producto) => (
        <div className="crud-row-actions">
          <button
            type="button"
            className="crud-action-edit"
            onClick={() => abrirFormulario(producto)}
            disabled={guardando || eliminandoId !== null}
          >
            Editar
          </button>
          <button
            type="button"
            className="crud-action-delete"
            onClick={() => eliminarProducto(producto)}
            disabled={!puedeEliminar || guardando || eliminandoId !== null}
          >
            {eliminandoId === producto.id ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="crud-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle title="Medicamentos" />

      <div className="crud-layout">
        <CrudForm
          title={productoEditando ? "Editar medicamento" : "Agregar medicamento"}
          editing={Boolean(productoEditando)}
          onSubmit={handleSubmit}
          onReset={limpiarFormulario}
          saving={guardando}
          submitLabel={productoEditando ? "Guardar cambios" : "Agregar medicamento"}
          submitDisabled={cargando || categorias.length === 0}
        >
          {camposPrincipales.map((campo) => (
            <CrudInput
              key={campo.id}
              {...campo}
              value={formulario[campo.name]}
              onChange={handleChange}
            />
          ))}

          {filasProducto.map((fila) => (
            <div className="crud-fields-row" key={fila[0].id}>
              {fila.map((campo) => (
                <CrudInput
                  key={campo.id}
                  {...campo}
                  value={formulario[campo.name]}
                  onChange={handleChange}
                />
              ))}
            </div>
          ))}

          <CrudSelect
            id="categoria-producto"
            label="Categoría"
            name="categoria_id"
            value={formulario.categoria_id}
            onChange={handleChange}
            required
          >
            <option value="">Selecciona una categoría</option>
            {categorias.map((categoria) => (
              <option key={categoria.id} value={categoria.id}>
                {categoria.nombre}
              </option>
            ))}
          </CrudSelect>

          <CrudSelect
            id="estado-producto"
            label="Estado"
            name="estado"
            value={formulario.estado}
            onChange={handleChange}
          >
            <option value="ACTIVO">Activo</option>
            <option value="INACTIVO">Inactivo</option>
          </CrudSelect>
        </CrudForm>

        <CrudList
          title="Medicamentos registrados"
          count={productosFiltrados.length}
          loading={cargando}
          loadingMessage="Cargando medicamentos..."
          emptyMessage={busqueda ? "No se encontraron medicamentos." : "No hay medicamentos registrados."}
          toolbar={
            <div className="crud-field crud-search">
              <label htmlFor="buscar-producto">Buscar medicamento</label>
              <input
                id="buscar-producto"
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Nombre, principio activo o categoría"
              />
            </div>
          }
        >
          <CrudTable
            className="crud-table crud-table--products"
            columns={columnas}
            rows={productosFiltrados}
          />
        </CrudList>
      </div>
    </div>
  );
}
