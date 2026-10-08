import { useRef, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $carrito, quitarDelCarrito, vaciarCarrito } from '../stores/carrito.js';
import { $sesion } from '../stores/sesion.js';
import { graphqlRequest, MUTATIONS } from '../lib/graphql.js';

// Isla que resuelve carrito + checkout de /carrito.astro.
// Flujo: se crea el pedido (PENDING / cobro PENDIENTE), se elige metodo de
// pago (Mercado Pago o PayPal) y se redirige a la pasarela. El estado real
// del cobro se confirma en /pago/resultado.
export default function CarritoCheckout() {
  const carrito = useStore($carrito);
  const sesion = useStore($sesion);
  const [procesando, setProcesando] = useState(false);
  const [pedido, setPedido] = useState(null);
  const [error, setError] = useState(null);
  // Guarda contra doble clic: un click doble no debe crear DOS pedidos (ni
  // dos preferencias de pago). React puede no haber re-renderizado aun cuando
  // llega el segundo click, asi que "procesando" solo no basta.
  const enProceso = useRef(false);

  const total = carrito.reduce((acc, r) => acc + r.precio * r.cantidad, 0);

  // Renglones cuya cantidad pedida excede el stock que se tenia registrado en
  // la tienda. El backend re-valida el stock real y es la autoridad final;
  // este aviso solo evita viajar al backend con algo que ya se sabe invalido.
  const renglonesInvalidos = carrito.filter(
    (r) => Number(r.stock) > 0 && (r.cantidad || 0) > Number(r.stock)
  );

  const confirmarPedido = async () => {
    if (enProceso.current) return;
    enProceso.current = true;
    setProcesando(true);
    setError(null);
    try {
      if (renglonesInvalidos.length > 0) {
        const primero = renglonesInvalidos[0];
        throw new Error(
          `"${primero.nombre}" solo tiene ${primero.stock} en existencia. Ajusta la cantidad e intenta de nuevo.`
        );
      }
      const data = await graphqlRequest(
        MUTATIONS.crearPedido,
        { d: { detalles: carrito.map((r) => ({ productoId: r.productoId, cantidad: r.cantidad })) } }
        // En el navegador el token no viaja aca: /api/graphql lee la cookie
        // httpOnly y autoriza al backend por nosotros.
      );
      setPedido(data.crearPedido);
      vaciarCarrito();
    } catch (err) {
      setError(
        err.status === 401
          ? 'Tu sesion expiro. Vuelve a iniciar sesion y confirma el pedido.'
          : err.message
      );
    } finally {
      enProceso.current = false;
      setProcesando(false);
    }
  };

  const pagarCon = async (metodo) => {
    if (enProceso.current) return;
    enProceso.current = true;
    setProcesando(true);
    setError(null);
    try {
      const mutation =
        metodo === 'MERCADO_PAGO'
          ? MUTATIONS.iniciarPagoMercadoPago
          : MUTATIONS.iniciarPagoPayPal;
      const data = await graphqlRequest(
        mutation,
        { pedidoId: String(pedido.id) }
        // Idem: el proxy /api/graphql adjunta la cookie httpOnly.
      );
      const url = metodo === 'MERCADO_PAGO' ? data.iniciarPagoMercadoPago.url : data.iniciarPagoPayPal.url;
      if (!url) throw new Error('La pasarela no devolvio una URL de pago.');
      window.location.assign(url);
    } catch (err) {
      setError(`No se pudo iniciar el pago: ${err.message}`);
      enProceso.current = false;
      setProcesando(false);
    }
  };

  // --- Paso 2: elegir metodo de pago --------------------------------
  if (pedido) {
    return (
      <div className="checkout-metodo">
        <h2>Elige cómo pagar</h2>
        <p>
          Pedido <strong>#{pedido.id}</strong> — Total:{' '}
          <strong>${Number(pedido.total).toFixed(2)} MXN</strong>
        </p>

        <div className="checkout-metodo__opciones">
          <button
            className="tarjeta-pago"
            onClick={() => pagarCon('MERCADO_PAGO')}
            disabled={procesando}
          >
            <strong>Mercado Pago</strong>
            <span>Tarjeta, saldo o transferencia redirigiendo a Mercado Pago.</span>
          </button>
          <button
            className="tarjeta-pago"
            onClick={() => pagarCon('PAYPAL')}
            disabled={procesando}
          >
            <strong>PayPal</strong>
            <span>Paga con tu cuenta PayPal (sandbox) en pocos clics.</span>
          </button>
        </div>

        {error && <p className="checkout-metodo__error">{error}</p>}
        {procesando && <p className="checkout-metodo__aviso">Redirigiendo a la pasarela…</p>}

        <a href="/" className="boton boton--texto">
          Volver al catálogo
        </a>

        <style>{`
          .checkout-metodo { display: flex; flex-direction: column; gap: 14px; }
          .checkout-metodo__opciones { display: flex; flex-direction: column; gap: 12px; }
          .tarjeta-pago {
            cursor: pointer; text-align: left; font: inherit;
            background: var(--surface); border: 1px solid var(--border);
            border-radius: var(--radius-lg); padding: 16px;
            display: flex; flex-direction: column; gap: 4px;
          }
          .tarjeta-pago:hover:not(:disabled) { border-color: var(--violeta); }
          .tarjeta-pago:disabled { opacity: 0.6; cursor: wait; }
          .tarjeta-pago span { color: var(--texto-secundario); font-size: 13px; }
          .checkout-metodo__error { color: var(--error); font-size: 14px; }
          .checkout-metodo__aviso { color: var(--texto-secundario); font-size: 14px; }
        `}</style>
      </div>
    );
  }

  // --- Sin sesion / carrito vacio / paso 1 (confirmar) ---------------
  if (carrito.length === 0) {
    return (
      <div className="carrito-vacio">
        <p>Tu carrito esta vacio.</p>
        <a href="/" className="boton boton--secundario">
          Ver catalogo
        </a>
      </div>
    );
  }

  return (
    <div className="carrito">
      <ul className="carrito__lista">
        {carrito.map((r) => {
          const invalido = Number(r.stock) > 0 && (r.cantidad || 0) > Number(r.stock);
          return (
            <li
              key={r.productoId}
              className={`carrito__renglon${invalido ? ' carrito__renglon--invalido' : ''}`}
            >
              <span className="carrito__nombre">
                {r.nombre} <small>x{r.cantidad}</small>
                {typeof r.stock === 'number' && (
                  <small className="carrito__stock">
                    {' '}
                    · {r.stock} disp.
                  </small>
                )}
              </span>
              <span>${(r.precio * r.cantidad).toFixed(2)}</span>
              <button
                className="boton boton--texto boton--peligro"
                onClick={() => quitarDelCarrito(r.productoId)}
              >
                Quitar
              </button>
            </li>
          );
        })}
      </ul>

      <div className="carrito__total">
        <strong>Total: ${total.toFixed(2)} MXN</strong>
      </div>

      {renglonesInvalidos.length > 0 && (
        <p className="carrito__aviso carrito__aviso--alerta">
          Hay productos que ya exceden su existencia. Ajusta las cantidades antes de continuar.
        </p>
      )}

      {!sesion ? (
        <p className="carrito__aviso">
          <a href="/login">Inicia sesión</a> para confirmar tu pedido.
        </p>
      ) : (
        <button
          className="boton boton--primario"
          onClick={confirmarPedido}
          disabled={procesando || renglonesInvalidos.length > 0}
        >
          {procesando ? 'Procesando...' : 'Confirmar pedido'}
        </button>
      )}

      {error && <p className="carrito__error">{error}</p>}

      <style>{`
        .carrito__lista { list-style: none; padding: 0; margin: 0 0 20px; }
        .carrito__renglon {
          display: flex; justify-content: space-between; align-items: center;
          gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border);
        }
        .carrito__renglon--invalido .carrito__nombre { color: var(--error); }
        .carrito__nombre small { color: var(--texto-secundario); }
        .carrito__stock { color: var(--texto-secundario); }
        .carrito__total { font-size: 18px; margin-bottom: 16px; }
        .carrito__aviso { color: var(--texto-secundario); font-size: 14px; }
        .carrito__aviso--alerta { color: var(--error); }
        .carrito__error { color: var(--error); margin-top: 10px; }
        .carrito-vacio, .checkout-ok { text-align: center; padding: 40px 0; }
      `}</style>
    </div>
  );
}