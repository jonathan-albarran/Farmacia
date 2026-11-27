import { useEffect, useState } from "react";
import PageTitle from "../../components/common/PageTitle";
import { apiRequest } from "../../services/api";
import { codigoMedicamento, diaUTC, fechaHoraLocal, fechaISO, formatearFecha } from "../../utils/formato";
import "./Dashboard.css";

const DIAS_PARA_CADUCAR = 30;
const MAX_FILAS = 6;

// Formatea las fechas y horas para mostrarlas de manera legible,
// Utilizando un mensaje alternativo cuando la fecha no está disponible.
function mostrarFecha(fecha) {
  return formatearFecha(fecha, "Fecha no disponible");
}

function mostrarFechaHora(fecha) {
  const fechaLocal = fechaHoraLocal(fecha);
  if (!fechaLocal) {
    return mostrarFecha(fecha);
  }

  const dia = mostrarFecha(fechaISO(fechaLocal));
  const hora = `${String(fechaLocal.getHours()).padStart(2, "0")}:${String(fechaLocal.getMinutes()).padStart(2, "0")}`;
  return `${dia} · ${hora}`;
}

function calcularExistenciasBajas(medicamentos, lotes) {
  const cantidades = new Map();
  for (const lote of lotes) {
    const id = Number(lote.producto_id);
    cantidades.set(id, (cantidades.get(id) || 0) + Number(lote.cantidad || 0));
  }

  return medicamentos
    .filter((medicamento) => medicamento.estado === "ACTIVO")
    .map((medicamento) => ({
      ...medicamento,
      existencia: cantidades.get(Number(medicamento.id)) || 0,
      stockMinimo: Number(medicamento.stock_minimo || 0)
    }))
    .filter((medicamento) => medicamento.existencia <= medicamento.stockMinimo)
    .sort((a, b) => (a.existencia - a.stockMinimo) - (b.existencia - b.stockMinimo));
}

export default function Dashboard() {
  const [medicamentos, setMedicamentos] = useState([]);
  const [lotes, setLotes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  async function cargarDashboard() {
    try {
      const [medicamentosDatos, lotesDatos, movimientosDatos] = await Promise.all([
        apiRequest("/productos"),
        apiRequest("/lotes"),
        apiRequest("/movimientos")
      ]);

      if (
        !Array.isArray(medicamentosDatos) ||
        !Array.isArray(lotesDatos) ||
        !Array.isArray(movimientosDatos)
      ) {
        throw new Error("El servidor devolvió datos de inventario inválidos.");
      }

      setMedicamentos(medicamentosDatos);
      setLotes(lotesDatos);
      setMovimientos(movimientosDatos);
    } catch (error) {
      setError(error.message || "No se pudo cargar el resumen del inventario.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const actualizarTrasSincronizar = () => {
      void cargarDashboard();
    };
    window.addEventListener("offline-sync-complete", actualizarTrasSincronizar);
    void Promise.resolve().then(cargarDashboard);

    return () => {
      window.removeEventListener("offline-sync-complete", actualizarTrasSincronizar);
    };
  }, []);

  const hoy = diaUTC(new Date());
  const movimientosHoy = movimientos.filter(
    (movimiento) => fechaISO(fechaHoraLocal(movimiento.fecha) || movimiento.fecha) === fechaISO(new Date())
  ).length;
  const lotesPorCaducar = lotes
    .map((lote) => ({
      ...lote,
      diaCaducidad: diaUTC(lote.fecha_caducidad)
    }))
    .filter((lote) => lote.diaCaducidad !== null &&
      lote.diaCaducidad >= hoy &&
      lote.diaCaducidad <= hoy + DIAS_PARA_CADUCAR)
    .sort((a, b) => a.diaCaducidad - b.diaCaducidad);
  const medicamentosBajos = calcularExistenciasBajas(medicamentos, lotes);
  const unidadesEnInventario = lotes.reduce(
    (total, lote) => total + Number(lote.cantidad || 0),
    0
  );

  return (
    <div className="dashboard-page">
      <PageTitle
        title="Inicio"
      />

      {error && <p className="dashboard-error" role="alert">{error}</p>}

      <div className="dashboard-resumen">
        <article className="dashboard-metrica">
          <span>Medicamentos registrados</span>
          <strong>{cargando ? "—" : medicamentos.length}</strong>
        </article>
        <article className="dashboard-metrica">
          <span>Lotes registrados</span>
          <strong>{cargando ? "—" : lotes.length}</strong>
        </article>
        <article className="dashboard-metrica">
          <span>Unidades en inventario</span>
          <strong>{cargando ? "—" : unidadesEnInventario.toLocaleString("es-MX")}</strong>
        </article>
        <article className="dashboard-metrica">
          <span>Movimientos de hoy</span>
          <strong>{cargando ? "—" : movimientosHoy}</strong>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="dashboard-card" aria-labelledby="caducidad-title">
          <div className="dashboard-card-header">
            <h2 id="caducidad-title">Medicamentos próximos a caducar</h2>
            <span className="dashboard-total">{cargando ? "—" : lotesPorCaducar.length}</span>
          </div>
          <p className="dashboard-ayuda">Lotes que caducan en los próximos 30 días.</p>

          {cargando ? (
            <p className="dashboard-mensaje">Cargando lotes...</p>
          ) : lotesPorCaducar.length === 0 ? (
            <p className="dashboard-mensaje">No hay lotes próximos a caducar.</p>
          ) : (
            <ul className="dashboard-lista">
              {lotesPorCaducar.slice(0, MAX_FILAS).map((lote) => (
                <li key={lote.id}>
                  <div>
                    <strong>{codigoMedicamento(lote.producto_id)} · {lote.medicamento_nombre}</strong>
                    <small>Lote {lote.numero_lote}</small>
                  </div>
                  <span className="dashboard-detalle">
                    {lote.diaCaducidad === hoy
                      ? "Hoy"
                      : `En ${lote.diaCaducidad - hoy} días`}
                    <small>{mostrarFecha(lote.fecha_caducidad)}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!cargando && lotesPorCaducar.length > MAX_FILAS && (
            <p className="dashboard-mas">
              Y {lotesPorCaducar.length - MAX_FILAS} lotes más.
            </p>
          )}
        </section>

        <section className="dashboard-card" aria-labelledby="stock-title">
          <div className="dashboard-card-header">
            <h2 id="stock-title">Existencias bajas</h2>
            <span className="dashboard-total">{cargando ? "—" : medicamentosBajos.length}</span>
          </div>
          <p className="dashboard-ayuda">Medicamentos activos con existencia igual o menor al mínimo.</p>

          {cargando ? (
            <p className="dashboard-mensaje">Calculando existencias...</p>
          ) : medicamentosBajos.length === 0 ? (
            <p className="dashboard-mensaje">No hay medicamentos con existencias bajas.</p>
          ) : (
            <ul className="dashboard-lista">
              {medicamentosBajos.slice(0, MAX_FILAS).map((medicamento) => (
                <li key={medicamento.id}>
                  <div>
                    <strong>{codigoMedicamento(medicamento.id)} · {medicamento.nombre}</strong>
                    <small>Mínimo: {medicamento.stockMinimo}</small>
                  </div>
                  <span className="dashboard-existencia">
                    {medicamento.existencia}
                    <small>disponibles</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {!cargando && medicamentosBajos.length > MAX_FILAS && (
            <p className="dashboard-mas">
              Y {medicamentosBajos.length - MAX_FILAS} medicamentos más.
            </p>
          )}
        </section>

        <section className="dashboard-card" aria-labelledby="movimientos-title">
          <div className="dashboard-card-header">
            <h2 id="movimientos-title">Movimientos recientes</h2>
          </div>
          <p className="dashboard-ayuda">Últimas entradas y salidas registradas.</p>

          {cargando ? (
            <p className="dashboard-mensaje">Cargando movimientos...</p>
          ) : movimientos.length === 0 ? (
            <p className="dashboard-mensaje">Aún no hay movimientos registrados.</p>
          ) : (
            <ul className="dashboard-lista">
              {movimientos.slice(0, MAX_FILAS).map((movimiento) => (
                <li key={movimiento.id}>
                  <div>
                    <strong>{movimiento.medicamento_nombre}</strong>
                    <small>
                      {movimiento.usuario_nombre} · {mostrarFechaHora(movimiento.fecha)}
                    </small>
                  </div>
                  <span className={`dashboard-movimiento dashboard-movimiento-${movimiento.tipo.toLocaleLowerCase()}`}>
                    {movimiento.tipo === "ENTRADA" ? "+" : "−"}{movimiento.cantidad}
                    <small>{movimiento.tipo === "ENTRADA" ? "Entrada" : "Salida"}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
