import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import Notification from "../../components/common/Notification";
import CrudForm, { CrudInput, CrudSelect } from "../../components/common/CrudForm";
import CrudList from "../../components/common/CrudList";
import CrudTable from "../../components/common/CrudTable";
import useCrudForm from "../../hooks/useCrudForm";
import { apiRequest } from "../../services/api";
import { codigoMedicamento, fechaISO, formatearFecha } from "../../utils/formato";
import { obtenerUsuarioActual } from "../../utils/session";
import { normalizarRol } from "../../utils/roles";

const formularioInicial = {
  producto_id: "",
  numero_lote: "",
  cantidad: "0",
  precio_compra: "0.00",
  fecha_caducidad: ""
};

export default function Inventario() {
  const rolUsuario = normalizarRol(obtenerUsuarioActual()?.rol);
  const puedeEliminar = ["administrador", "dueno"].includes(rolUsuario);
  const [lotes, setLotes] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [loteEditando, setLoteEditando] = useState(null);
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
      const [lotesDatos, medicamentosDatos] = await Promise.all([
        apiRequest("/lotes"),
        apiRequest("/productos")
      ]);

      if (!Array.isArray(lotesDatos) || !Array.isArray(medicamentosDatos)) {
        throw new Error("El servidor devolvió datos de lotes o medicamentos inválidos.");
      }

      setLotes(lotesDatos);
      setMedicamentos(medicamentosDatos);
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al cargar los lotes."
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

  function abrirFormulario(lote = null) {
    setLoteEditando(lote);
    llenarFormulario(lote ? {
      producto_id: String(lote.producto_id),
      numero_lote: lote.numero_lote,
      cantidad: String(lote.cantidad),
      precio_compra: String(lote.precio_compra),
      fecha_caducidad: fechaISO(lote.fecha_caducidad)
    } : formularioInicial);
  }

  function limpiarFormulario() {
    setLoteEditando(null);
    reiniciarFormulario();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const editando = Boolean(loteEditando);
    const medicamento = medicamentos.find(
      (item) => Number(item.id) === Number(formulario.producto_id)
    );
    const descripcion = formulario.numero_lote.trim();
    const confirmacion = editando
      ? `¿Guardar los cambios del lote "${descripcion}"?`
      : `¿Registrar el lote "${descripcion}" para "${medicamento?.nombre || "el medicamento seleccionado"}"?`;

    if (!window.confirm(confirmacion)) {
      return;
    }

    setGuardando(true);

    try {
      await apiRequest(
        editando ? `/lotes/${loteEditando.id}` : "/lotes",
        {
          method: editando ? "PUT" : "POST",
          body: JSON.stringify({
            ...formulario,
            producto_id: Number(formulario.producto_id),
            cantidad: Number(formulario.cantidad),
            precio_compra: Number(formulario.precio_compra)
          })
        }
      );

      limpiarFormulario();
      await cargarDatos();
      setNotificacion({
        type: "success",
        message: editando ? "Lote actualizado" : "Lote registrado"
      });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al guardar el lote."
      });
    } finally {
      setGuardando(false);
    }
  }

  async function eliminarLote(lote) {
    if (!window.confirm(`¿Eliminar el lote "${lote.numero_lote}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setEliminandoId(lote.id);

    try {
      await apiRequest(`/lotes/${lote.id}`, { method: "DELETE" });
      await cargarDatos();
      setNotificacion({ type: "success", message: "Lote eliminado" });
    } catch (error) {
      setNotificacion({
        type: "error",
        message: error.message || "Error al eliminar el lote."
      });
    } finally {
      setEliminandoId(null);
    }
  }

  const lotesFiltrados = lotes.filter((lote) => {
    const consulta = busqueda.trim().toLocaleLowerCase();
    return [
      lote.numero_lote,
      lote.medicamento_nombre,
      codigoMedicamento(lote.producto_id)
    ].some((valor) => valor?.toLocaleLowerCase().includes(consulta));
  });
  const columnas = [
    {
      label: "Medicamento",
      render: (lote) => (
        <>
          <strong>{codigoMedicamento(lote.producto_id)}</strong>
          <small>{lote.medicamento_nombre}</small>
        </>
      )
    },
    { label: "Número de lote", render: (lote) => lote.numero_lote },
    { label: "Cantidad", render: (lote) => lote.cantidad },
    { label: "Precio compra", render: (lote) => `$${Number(lote.precio_compra).toFixed(2)}` },
    { label: "Caducidad", render: (lote) => formatearFecha(lote.fecha_caducidad) },
    {
      label: "Acciones",
      render: (lote) => (
        <div className="crud-row-actions">
          <button
            type="button"
            className="crud-action-edit"
            onClick={() => abrirFormulario(lote)}
            disabled={guardando || eliminandoId !== null}
          >
            Editar
          </button>
          <button
            type="button"
            className="crud-action-delete"
            onClick={() => eliminarLote(lote)}
            disabled={!puedeEliminar || guardando || eliminandoId !== null}
          >
            {eliminandoId === lote.id ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="crud-page">
      <Notification notification={notificacion} onClose={() => setNotificacion(null)} />
      <PageTitle title="Lotes" />

      <div className="crud-layout">
        <CrudForm
          title={loteEditando ? "Editar lote" : "Registrar lote"}
          editing={Boolean(loteEditando)}
          onSubmit={handleSubmit}
          onReset={limpiarFormulario}
          saving={guardando}
          submitLabel={loteEditando ? "Guardar cambios" : "Registrar lote"}
          submitDisabled={cargando || medicamentos.length === 0}
        >
          <CrudSelect
            id="medicamento-lote"
            label="Medicamento"
            name="producto_id"
            value={formulario.producto_id}
            onChange={handleChange}
            required
          >
            <option value="">Selecciona un medicamento</option>
            {medicamentos.map((medicamento) => (
              <option key={medicamento.id} value={medicamento.id}>
                {codigoMedicamento(medicamento.id)} · {medicamento.nombre}
              </option>
            ))}
          </CrudSelect>

          <CrudInput
            id="numero-lote"
            label="Número de lote"
            name="numero_lote"
            value={formulario.numero_lote}
            onChange={handleChange}
            maxLength={100}
            required
          />

          <div className="crud-fields-row">
            <CrudInput
              id="cantidad-lote"
              label="Cantidad"
              name="cantidad"
              type="number"
              min="0"
              step="1"
              value={formulario.cantidad}
              onChange={handleChange}
              required
            />
            <CrudInput
              id="precio-compra"
              label="Precio de compra"
              name="precio_compra"
              type="number"
              min="0"
              max="99999999.99"
              step="0.01"
              value={formulario.precio_compra}
              onChange={handleChange}
              required
            />
          </div>

          <CrudInput
            id="fecha-caducidad"
            label="Fecha de caducidad"
            name="fecha_caducidad"
            type="date"
            value={formulario.fecha_caducidad}
            onChange={handleChange}
            required
          />
        </CrudForm>

        <CrudList
          title="Lotes registrados"
          count={lotesFiltrados.length}
          loading={cargando}
          loadingMessage="Cargando lotes..."
          emptyMessage={busqueda ? "No se encontraron lotes." : "No hay lotes registrados."}
          toolbar={
            <div className="crud-field crud-search">
              <label htmlFor="buscar-lote">Buscar lote</label>
              <input
                id="buscar-lote"
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder=" Número de lote, código o medicamento "
              />
            </div>
          }
        >
          <CrudTable
            className="crud-table crud-table--lots"
            columns={columnas}
            rows={lotesFiltrados}
          />
        </CrudList>
      </div>
    </div>
  );
}
