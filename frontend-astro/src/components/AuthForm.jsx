import { useState } from 'react';

// Cuentas de demostracion para la evaluacion presencial: los botones solo
// autocompletan el formulario; el login se hace igual contra el backend.
const CUENTAS_DEMO = [
  { rol: 'Admin', email: 'admin@nexoplay.com', password: 'admin123' },
  { rol: 'Operador', email: 'operador@nexoplay.com', password: 'operador123' },
  { rol: 'Cliente', email: 'cliente@nexoplay.com', password: 'cliente123' },
];

/**
 * Formulario de login (login) o registro (register). Al exito guarda la
 * cookie httpOnly (via /auth/local en el servidor) y redirige segun el rol:
 * admin/operador al panel, cliente al catalogo.
 */
export default function AuthForm({ modo = 'login' }) {
  const esLogin = modo === 'login';
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const autocompletar = (cuenta) => {
    setEmail(cuenta.email);
    setPassword(cuenta.password);
    setError(null);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);

    if (!esLogin && password !== confirmacion) {
      setError('Las contrasenas no coinciden.');
      return;
    }

    setProcesando(true);
    try {
      const cuerpo = esLogin
        ? { action: 'login', email, password }
        : { action: 'register', nombre, email, password };
      const respuesta = await fetch('/auth/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) throw new Error(datos?.error || 'No se pudo iniciar sesion.');

      const rol = datos.usuario?.rol;
      window.location.assign(rol === 'ADMIN' || rol === 'OPERADOR' ? '/admin' : '/');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="auth">
      {esLogin && (
        <div className="auth__demo">
          <p>Cuentas de demostración (autocompletan el formulario):</p>
          <div className="auth__demo-botones">
            {CUENTAS_DEMO.map((cuenta) => (
              <button
                key={cuenta.rol}
                type="button"
                className="boton boton--secundario"
                onClick={() => autocompletar(cuenta)}
              >
                {cuenta.rol}
              </button>
            ))}
          </div>
        </div>
      )}

      <form className="auth__form" onSubmit={enviar}>
        {!esLogin && (
          <label>
            Nombre
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoComplete="name"
            />
          </label>
        )}

        <label>
          Correo
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </label>

        <label>
          Contrasena
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={esLogin ? 'current-password' : 'new-password'}
          />
        </label>

        {!esLogin && (
          <label>
            Confirmar contrasena
            <input
              type="password"
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="auth__error">
            {error}
          </p>
        )}

        <button className="boton boton--primario" disabled={procesando}>
          {procesando ? 'Procesando…' : esLogin ? 'Iniciar sesión' : 'Crear cuenta'}
        </button>
      </form>

      <p className="auth__pie">
        {esLogin ? (
          <>
            ¿No tienes cuenta? <a href="/registro">Regístrate aquí</a>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta? <a href="/login">Inicia sesión aquí</a>
          </>
        )}
      </p>

      <style>{`
        .auth { max-width: 380px; margin: 0 auto; display: flex; flex-direction: column; gap: 20px; }
        .auth__demo { background: var(--surface-muted); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; font-size: 13px; }
        .auth__demo p { margin: 0 0 10px; color: var(--texto-secundario); }
        .auth__demo-botones { display: flex; gap: 8px; flex-wrap: wrap; }
        .auth__form { display: flex; flex-direction: column; gap: 14px; }
        .auth__form label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 600; }
        .auth__form input { padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 15px; }
        .auth__error { color: var(--error); font-size: 14px; margin: 0; }
        .auth__pie { font-size: 14px; color: var(--texto-secundario); }
      `}</style>
    </div>
  );
}