
import { useState } from "react";
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

// Precarga los datos principales del sistema para facilitar
// Su consulta sin conexión a internet.
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
      //console.error(`No se pudo preparar la copia offline de ${ruta}:`, error);
    }
  }));
}

export default function Login() {
  const navigate = useNavigate();

  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

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
          //console.error("No se pudo guardar la autorización offline:", error);
        }

        localStorage.setItem("token", datos.token);
        localStorage.removeItem("modoOffline");
        guardarUsuarioActual(datos.usuario);
        await sincronizarCambiosPendientes();
        await precargarDatosOffline(datos.usuario);

        navigate("/dashboard");
        return;

      } catch (errorServidor) {
        // Solo intentar acceso offline si falla la conexión
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
        //  "vencido":
        //    "La autorización offline ha vencido. Conéctate a Internet para iniciar sesión nuevamente.",
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
    <main>
      <h1>Farmacia Dulce María</h1>
      <h2>Iniciar sesión</h2>

      <form onSubmit={handleSubmit}>
        <label htmlFor="correo">Correo electrónico</label>
        <input
          id="correo"
          name="correo"
          type="email"
          autoComplete="username"
          value={correo}
          onChange={(event) => setCorreo(event.target.value)}
          required
        />

        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {error && <p role="alert">{error}</p>}

        <button type="submit" disabled={cargando}>
          {cargando ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
