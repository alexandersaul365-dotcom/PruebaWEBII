import { useState } from 'react';
import { agregarAlCarrito } from '../stores/carrito.js';

/**
 * Botón "Agregar al carrito" de las cards de producto. Un clic agrega 1
 * unidad; no navega. Con stock 0 se muestra "Agotado" deshabilitado y al
 * agregar da un feedback de "✓ Agregado" durante 1.5s.
 */
export default function BotonAgregar({ producto }) {
  const stock = Number(producto.stock) || 0;
  const [agregado, setAgregado] = useState(false);

  const handleAgregar = (e) => {
    e.preventDefault();
    e.stopPropagation();
    agregarAlCarrito(producto, 1);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1500);
  };

  return (
    <button
      type="button"
      className="boton boton--primario producto-card__boton"
      onClick={handleAgregar}
      disabled={stock === 0 || agregado}
      aria-label={stock === 0 ? `${producto.nombre}: agotado` : `Agregar ${producto.nombre} al carrito`}
    >
      {stock === 0 ? 'Agotado' : agregado ? '✓ Agregado' : 'Agregar al carrito'}
      <style>{`
        .producto-card__boton {
          width: 100%;
          height: 40px;
          margin-top: 16px;
          font-size: 14px;
          font-weight: 600;
        }
        .producto-card__boton:disabled {
          background: color-mix(in srgb, var(--primary) 55%, var(--surface));
          cursor: not-allowed;
        }
      `}</style>
    </button>
  );
}