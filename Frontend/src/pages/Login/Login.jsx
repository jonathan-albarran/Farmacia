import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  apiRequest,
  sincronizarCambiosPendientes
} from "../../services/api";
import {
  guardarCredencialOffline,
  validarCredencialOffline
} from "../../utils/offlineAuth";
import { guardarUsuarioActual } from "../../utils/session";
import "./Login.css";

// Precarga los datos principales del sistema para facilitar
// su consulta sin conexión a internet.
async function precargarDatosOffline(usuario) {
  const rutas = [
    "/productos",
    "/categorias",
    "/lotes",
    "/movimientos"
  ];

  if (["administrador", "dueno"].includes(usuario.rol)) {
    rutas.push("/usuarios");
  }

  await Promise.all(rutas.map(async (ruta) => {
    try {
      await apiRequest(ruta);
    } catch (error) {
      // Ignorar errores en precarga silenciosa
    }
  }));
}

export default function Login() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [enLinea, setEnLinea] = useState(() => navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setEnLinea(true);
    const handleOffline = () => setEnLinea(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    setError("");
    setCargando(true);

    try {
      try {
        // Intentar iniciar sesión con el servidor
        const datos = await apiRequest("/auth/login", {
          method: "POST",
          body: JSON.stringify({ correo, password })
        });

        // Guardar autorización local para futuros accesos offline
        try {
          await guardarCredencialOffline(
            correo,
            password,
            datos.usuario
          );
        } catch (error) {
          // Registro silencioso en local
        }

        localStorage.setItem("token", datos.token);
        localStorage.removeItem("modoOffline");
        guardarUsuarioActual(datos.usuario);
        await sincronizarCambiosPendientes();
        await precargarDatosOffline(datos.usuario);

        navigate("/dashboard");
        return;

      } catch (errorServidor) {
        // Solo intentar acceso offline si falla la conexión de red
        if (!(errorServidor instanceof TypeError)) {
          throw errorServidor;
        }
      }

      // Intentar iniciar sesión sin Internet
      const resultado = await validarCredencialOffline(
        correo,
        password
      );

      if (!resultado.ok) {
        const mensajes = {
          "no-autorizado":
            "Este usuario aún no ha iniciado sesión con Internet en este dispositivo.",
          "credenciales-invalidas":
            "El correo o la contraseña son incorrectos."
        };

        throw new Error(
          mensajes[resultado.motivo] || "No se pudo validar el acceso offline."
        );
      }

      // Establecer sesión local
      localStorage.removeItem("token");
      localStorage.setItem("modoOffline", "true");
      guardarUsuarioActual(resultado.usuario);

      navigate("/dashboard");

    } catch (error) {
      setError(
        error.message || "No se pudo iniciar sesión."
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="login-container">
      <div className="login-card">
        <header className="login-header">
          <img
            src="/farmacia_dulce_maria_pwa_192.png"
            alt="Logo Farmacia Dulce María"
            className="login-logo"
          />
          <h1 className="login-title">Farmacia Dulce María</h1>
          <p className="login-subtitle">Gestión y Control de Farmacia</p>
          
          <div className={`login-status-badge ${enLinea ? "online" : "offline"}`}>
            <span className="login-status-dot"></span>
            {enLinea ? "Servidor en línea" : "Modo sin conexión"}
          </div>
        </header>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="login-field">
            <label htmlFor="correo" className="login-label">
              Correo electrónico
            </label>
            <div className="login-input-wrapper">
              <input
                id="correo"
                name="correo"
                type="email"
                autoComplete="username"
                className="login-input"
                placeholder="ejemplo@farmacia.com"
                value={correo}
                onChange={(event) => setCorreo(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="login-field">
            <label htmlFor="password" className="login-label">
              Contraseña
            </label>
            <div className="login-input-wrapper">
              <input
                id="password"
                name="password"
                type={mostrarPassword ? "text" : "password"}
                autoComplete="current-password"
                className="login-input login-input-password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button
                type="button"
                className="login-toggle-password"
                onClick={() => setMostrarPassword((prev) => !prev)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                title={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {mostrarPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error-alert" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="login-submit-btn"
            disabled={cargando}
          >
            {cargando ? (
              <>
                <svg className="login-spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                  <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
                </svg>
                <span>Iniciando sesión...</span>
              </>
            ) : (
              "Ingresar al sistema"
            )}
          </button>
        </form>

        <footer className="login-footer">
          Sistema de Administración y Control Farmacéutico
        </footer>
      </div>
    </main>
  );
}