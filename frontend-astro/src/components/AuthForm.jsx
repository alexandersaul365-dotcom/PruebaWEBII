import { useState } from 'react';
import GoogleBoton from './GoogleBoton.jsx';

/**
 * Formulario de acceso/registro de NexoPlay, presentado como una tarjeta
 * centrada de 420px. Al éxito la cookie httpOnly queda puesta y se redirige
 * al inicio (tanto el acceso normal como el de Google).
 */
export default function AuthForm({ modo = 'login' }) {
  const esLogin = modo === 'login';
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setError(null);

    if (!esLogin && password !== confirmacion) {
      setError('Las contraseñas no coinciden.');
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
      if (!respuesta.ok) throw new Error(datos?.error || 'No se pudo iniciar sesión.');

      window.location.assign('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card">
        <span className="auth__eyebrow">NexoPlay</span>
        <h1 className="auth__titulo">{esLogin ? 'Iniciar sesión' : 'Crear cuenta'}</h1>
        <p className="auth__subtitulo">
          {esLogin
            ? 'Accede a tu cuenta para seguir comprando.'
            : 'Regístrate y recibe tu pedido en la puerta de tu casa.'}
        </p>

        <form className="auth__form" onSubmit={enviar} noValidate={false}>
          {!esLogin && (
            <label className="auth__campo">
              <span>Nombre</span>
              <input
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                required
                autoComplete="name"
                placeholder="Tu nombre"
              />
            </label>
          )}

          <label className="auth__campo">
            <span>Correo</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
            />
          </label>

          <label className="auth__campo">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={esLogin ? 'current-password' : 'new-password'}
              placeholder="••••••••"
            />
          </label>

          {!esLogin && (
            <label className="auth__campo">
              <span>Confirmar contraseña</span>
              <input
                type="password"
                value={confirmacion}
                onChange={(e) => setConfirmacion(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </label>
          )}

          {error && (
            <p role="alert" className="auth__error">
              {error}
            </p>
          )}

          <GoogleBoton />

          <div className="auth__divisor"> </div>

          <button type="submit" className="boton boton--primario" disabled={procesando}>
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
      </div>

      <style>{`
        .auth {
          display: flex;
          justify-content: center;
          padding: 48px 16px;
        }
        .auth__card {
          width: 100%;
          max-width: 420px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow);
          padding: 32px;
          display: flex;
          flex-direction: column;
        }
        .auth__eyebrow {
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
          text-align: center;
        }
        .auth__titulo {
          font-size: 28px;
          font-weight: 700;
          line-height: 1.2;
          text-align: center;
          margin: 8px 0 4px;
        }
        .auth__subtitulo {
          font-size: 14px;
          color: var(--text-muted);
          text-align: center;
          margin: 0 0 24px;
        }
        .auth__form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .auth__campo {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 14px;
          font-weight: 600;
        }
        .auth__campo input {
          height: 44px;
          padding: 0 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg);
          color: var(--text);
          font-size: 15px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .auth__campo input:focus {
          outline: none;
          border-color: var(--primary);
          box-shadow: 0 0 0 3px var(--ring);
        }
        .auth__error {
          color: var(--danger);
          font-size: 14px;
          margin: 0;
        }
        .auth__divisor {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-muted);
          font-size: 13px;
          margin: 4px 0;
        }
        .auth__divisor::before,
        .auth__divisor::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }
        .auth__pie {
          font-size: 14px;
          color: var(--text-muted);
          text-align: center;
          margin: 20px 0 0;
        }
        .auth__pie a { color: var(--primary); font-weight: 600; }
      `}</style>
    </div>
  );
}