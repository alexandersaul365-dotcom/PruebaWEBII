import { useEffect, useMemo, useState } from 'react';
import { vaciarCarrito } from '../stores/carrito.js';
import { graphqlRequest } from '../lib/graphql.js';
import { MUTATIONS } from '../lib/queries.js';

const formatoMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

/**
 * Pantalla /pago/resultado?pedido=N&proveedor=...
 *
 * Al volver de la pasarela consulta el estado REAL del cobro contra la API de
 * Mercado Pago / PayPal (los webhooks no llegan a un localhost en desarrollo).
 * Si el pago quedo APROBADO se vacio el carrito (reservado al crear el pedido)
 * y se muestra el pedido confirmado.
 */
export default function ResultadoPago({ pedido, proveedor, estadoQuery }) {
  const [estado, setEstado] = useState('VIENDO'); // 'VIENDO' | 'OK' | 'ERROR' | 'ESPERA'
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  const proveedorTitulo = useMemo(
    () => (proveedor === 'paypal' ? 'PayPal' : proveedor === 'mercadopago' ? 'Mercado Pago' : 'pasarela'),
    [proveedor]
  );

  useEffect(() => {
    if (!pedido) {
      setEstado('ERROR');
      setError('Falta el identificador del pedido en la URL.');
      return;
    }

    // PayPal regresa con estado=cancelado si el comprador no aprobo; MP con
    // estado=failure si el cobro rechazo. En ambos casos no hay nada que
    // verificar: el pedido sigue pendiente y se puede reintentar.
    if (estadoQuery === 'cancelado' || estadoQuery === 'failure') {
      setEstado('ERROR');
      setError('El pago no se completó. Tu pedido sigue esperando y puedes intentarlo de nuevo cuando quieras.');
      return;
    }

    let activo = true;
    const consultar = async () => {
      setEstado('VIENDO');
      setError(null);
      try {
        const resultado = await graphqlRequest(MUTATIONS.verificarPago, { pedidoId: String(pedido) });
        if (!activo) return;
        const p = resultado.verificarPago;
        setInfo(p);

        const esAprobado = p.estadoPago === 'APROBADO' || p.status === 'DELIVERED';
        const esTerminal = ['APROBADO', 'RECHAZADO', 'REEMBOLSADO'].includes(p.estadoPago);

        if (esAprobado) {
          // El pago quedo registrado: el carrito ya se entrego al pedido.
          vaciarCarrito();
          setEstado('OK');
        } else if (p.estadoPago === 'PENDIENTE' || p.estadoPago === null || p.estadoPago === undefined) {
          // MP a veces tarda unos segundos en reflejar el pago; damos una
          // pequena reintento antes de declararlo pendiente.
          setTimeout(() => {
            if (activo) consultar();
          }, 3000);
          setEstado('ESPERA');
        } else if (esTerminal) {
          setEstado('ERROR');
          setError('La pasarela reporto que el pago no se completo.');
        } else {
          setEstado('ERROR');
          setError('No se pudo confirmar el pago.');
        }
      } catch (err) {
        if (!activo) return;
        setEstado('ERROR');
        setError(err.message);
      }
    };

    consultar();
    return () => {
      activo = false;
    };
  }, [pedido, estadoQuery]);

  const recalcular = () => {
    // Re-consulta manual: útil si la pasarela seguia procesando.
    setEstado('VIENDO');
    setError(null);
    graphqlRequest(MUTATIONS.verificarPago, { pedidoId: String(pedido) })
      .then((r) => {
        setInfo(r.verificarPago);
        if (r.verificarPago.estadoPago === 'APROBADO') {
          vaciarCarrito();
          setEstado('OK');
        } else {
          setEstado('ERROR');
          setError('El cobro aun no aparece como aprobado.');
        }
      })
      .catch((err) => setError(err.message));
  };

  if (estado === 'ESPERA') {
    return (
      <div className="resultado resultado--espera">
        <h1>Verificando tu pago…</h1>
        <p>Estamos confirmando el cobro con la pasarela. Un momento por favor.</p>
      </div>
    );
  }

  if (estado === 'ERROR' || (estado !== 'OK' && info && info.estadoPago !== 'APROBADO')) {
    // Cuando la pasarela reporto retorno por cancelacion/rechazo el boton de
    // re-consultar no tiene sentido (no hay un cobros en vuelo): se ofrece,
    // mejor, volver a las ordenes del cliente.
    const esCancel = estadoQuery === 'cancelado' || estadoQuery === 'failure';
    return (
      <div className="resultado resultado--fallo">
        <h1>La pasarela no confirmó el cobro</h1>
        {error ? <p>{error}</p> : <p>El pago no quedó registrado.</p>}
        <div className="resultado__acciones">
          <a href="/" className="boton boton--secundario">Seguir comprando</a>
          {esCancel ? (
            <a href="/mis-ordenes" className="boton boton--texto">Ver mis órdenes</a>
          ) : (
            <button className="boton boton--texto" onClick={recalcular}>
              Volver a consultar
            </button>
          )}
        </div>
      </div>
    );
  }

  if (estado === 'OK' && info) {
    return (
      <div className="resultado resultado--ok">
        <h1>¡Pago aprobado!</h1>
        <p>
          Tu pedido <strong>#{info.id}</strong> se pagó con {proveedorTitulo} por{' '}
          <strong>{formatoMXN.format(Number(info.total))}</strong>.
        </p>
        {info.fechaPago && (
          <p className="resultado__meta">
            Pagado el {new Date(info.fechaPago).toLocaleString('es-MX')}
          </p>
        )}
        <div className="resultado__acciones">
          <a href="/mis-ordenes" className="boton boton--primario">
            Ver mis órdenes
          </a>
          <a href="/" className="boton boton--texto">Seguir comprando</a>
        </div>
      </div>
    );
  }

  return <div className="panel-cargando">Verificando pago…</div>;
}