import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import CrudForm, { CrudInput, CrudTextarea } from "../../components/common/CrudForm";
import CrudList from "../../components/common/CrudList";
import CrudTable from "../../components/common/CrudTable";
import useCrudForm from "../../hooks/useCrudForm";
import { apiRequest } from "../../services/api";
import { obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";

const formularioInicial = {
  nombre: "",
  descripcion: ""
};

export default function Categorias() {
  const rolUsuario = normalizarRol(obtenerUsuarioActual()?.rol);
  const puedeAdministrar = ["administrador", "dueno"].includes(rolUsuario);
  const [categorias, setCategorias] = useState([]);
  const [categoriaEditando, setCategoriaEditando] = useState(null);
  const {
    values: formulario,
    handleChange,
    fill: llenarFormulario,
    reset: reiniciarFormulario
  } = useCrudForm(formularioInicial);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [notificacion, setNotificacion] = useState(null);

  async function cargarCategorias() {
    try {
      const datos = await apiRequest("/categorias");
      if (!Array.isArray(datos)) {
        throw new Error("El servidor devolvió una lista de categorías inválida.");
      }
      setCategorias(datos);
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
      void cargarCategorias();
    };
    window.addEventListener("offline-sync-complete", actualizarTrasSincronizar);
    void Promise.resolve().then(cargarCategorias);

    return () => {
      window.removeEventListener("offline-sync-complete", actualizarTrasSincronizar);
    };
  }, []);

  function abrirFormulario(categoria = null) {
    setCategoriaEditando(categoria);
    llenarFormulario(categoria ? {
      nombre: categoria.nombre,
      descripcion: categoria.descripcion || ""
    } : formularioInicial);
  }

  function limpiarFormulario() {
    setCategoriaEditando(null);
    reiniciarFormulario();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const editando = Boolean(categoriaEditando);

    const confirmacion = editando
      ? `¿Guardar los cambios de la categoría "${categoriaEditando.nombre}"?`
      : `¿Agregar la categoría "${formulario.nombre.trim()}"?`;
    if (!window.confirm(confirmacion)) {
      return;
    }

    setGuardando(true);

    try {
      await apiRequest(
        categoriaEditando ? `/categorias/${categoriaEditando.id}` : "/categorias",
        {
          method: categoriaEditando ? "PUT" : "POST",
          body: JSON.stringify({
            nombre: formulario.nombre.trim(),
            descripcion: formulario.descripcion.trim()
          })
        }
      );

      limpiarFormulario();
      await cargarCategorias();
      setNotificacion({
        type: "success",
        message: editando
          ? "Categoría actualizada"
          : "Categoría agregada"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al guardar la categoría."
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarCategoria(categoria) {
    if (!window.confirm(`¿Eliminar la categoría "${categoria.nombre}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(categoria.id);

    try {
      await apiRequest(`/categorias/${categoria.id}`, { method: "DELETE" });
      await cargarCategorias();
      setNotificacion({
        type: "success",
        message: "Categoría eliminada"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al eliminar la categoría."
      });
    } finally {
      setEliminandoId(null);
    }
  }

  const columnas = [
    { label: "Nombre", render: (categoria) => categoria.nombre },
    { label: "Descripción", render: (categoria) => categoria.descripcion || "—" },
    {
      label: "Acciones",
      render: (categoria) => (
        <div className="crud-row-actions">
          <button
            type="button"
            className="crud-action-edit"
            onClick={() => abrirFormulario(categoria)}
            disabled={!puedeAdministrar || guardando || eliminandoId !== null}
            title="Editar categoría"
          >
            Editar
          </button>
          <button
            type="button"
            className="crud-action-delete"
            onClick={() => eliminarCategoria(categoria)}
            disabled={!puedeAdministrar || guardando || eliminandoId !== null}
            title="Eliminar categoría"
          >
            {eliminandoId === categoria.id ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="crud-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle title="Categorías" />

      <div className="crud-layout">
        <CrudForm
          title={categoriaEditando ? "Editar categoría" : "Agregar categoría"}
          editing={Boolean(categoriaEditando)}
          onSubmit={handleSubmit}
          onReset={limpiarFormulario}
          saving={guardando}
          submitLabel={categoriaEditando ? "Guardar cambios" : "Agregar categoría"}
          submitDisabled={!puedeAdministrar}
          newLabel="Nueva"
        >
          <CrudInput
            id="nombre-categoria"
            label="Nombre"
            name="nombre"
            value={formulario.nombre}
            onChange={handleChange}
            maxLength={100}
            required
          />
          <CrudTextarea
            id="descripcion-categoria"
            label="Descripción"
            name="descripcion"
            value={formulario.descripcion}
            onChange={handleChange}
            rows={5}
            placeholder=" Descripción opcional de la categoría "
          />
        </CrudForm>

        <CrudList
          title="Categorías registradas"
          count={categorias.length}
          loading={cargando}
          loadingMessage="Cargando categorías..."
          emptyMessage="No hay categorías registradas."
        >
          <CrudTable
            className="crud-table crud-table--categories"
            columns={columnas}
            rows={categorias}
          />
        </CrudList>
      </div>
    </div>
  );
}
