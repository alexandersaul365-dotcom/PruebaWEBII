import { useState } from 'react';

export default function CerrarSesion() {
  const [procesando, setProcesando] = useState(false);

  const salir = async () => {
    if (procesando) return;
    setProcesando(true);
    try {
      await fetch('/auth/salir', { method: 'POST' });
    } catch {
      // Aun sin conexion hay que volver al inicio.
    }
    window.location.assign('/');
  };

  return (
    <button
      type="button"
      className="boton boton--texto boton--peligro"
      onClick={salir}
      disabled={procesando}
    >
      {procesando ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  );
}