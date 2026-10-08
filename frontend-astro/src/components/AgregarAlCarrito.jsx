import { useState } from 'react';
import { agregarAlCarrito } from '../stores/carrito.js';

// Unica parte interactiva de la pagina de producto (que, por lo demas, es
// una pagina .astro renderizada en el servidor). Recibe el producto ya
// resuelto por el servidor via props (serializadas a JSON por Astro).
export default function AgregarAlCarrito({ producto }) {
  const stock = Number(producto.stock) || 0;
  const [cantidad, setCantidad] = useState(1);
  const [agregado, setAgregado] = useState(false);

  // El atributo max del input no evita que se escriban cifras mayores con el
  // teclado, asi que aqui se recortan ademas por logica. Numero >0 y <= stock.
  const alCambiarCantidad = (valor) => {
    const numero = Math.floor(Number(valor));
    const recortado = Math.min(Math.max(1, numero || 1), stock || 1);
    setCantidad(stock ? recortado : 1);
  };

  const handleAgregar = () => {
    if (cantidadInvalida) return;
    agregarAlCarrito(producto, cantidad);
    setAgregado(true);
    setTimeout(() => setAgregado(false), 1500);
  };

  const sinStock = stock === 0;
  const cantidadInvalida = cantidad < 1 || cantidad > stock;

  return (
    <div className="agregar-carrito">
      <input
        type="number"
        min="1"
        max={stock || 1}
        step="1"
        value={cantidad}
        onChange={(e) => alCambiarCantidad(e.target.value)}
        className="agregar-carrito__cantidad"
        aria-label="Cantidad"
        disabled={sinStock}
      />
      <button
        className="boton boton--primario"
        onClick={handleAgregar}
        disabled={sinStock || cantidadInvalida}
        title={cantidadInvalida ? `Solo hay ${stock} en existencia.` : undefined}
      >
        {sinStock
          ? 'Sin stock'
          : agregado
            ? '¡Agregado!'
            : 'Agregar al carrito'}
      </button>
      <style>{`
        .agregar-carrito { display: flex; gap: 10px; align-items: center; margin-top: 16px; }
        .agregar-carrito__cantidad { width: 64px; padding: 8px; border: 1px solid var(--border); border-radius: var(--radius); }
      `}</style>
    </div>
  );
}