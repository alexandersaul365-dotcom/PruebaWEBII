import { useEffect, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';

const TRANSICIONES = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

const FILTROS = ['', 'PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

const formatoMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

export default function AdminOrdenes() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState('');
  const [pedidos, setPedidos] = useState([]);
  const [desplegado, setDesplegado] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    graphqlRequest(QUERIES.pedidosAdmin, filtro ? { estado: filtro } : {})
      .then((d) => setPedidos(d.pedidos))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, [filtro]);

  const abrirDetalle = async (id) => {
    if (desplegado === id) {
      setDesplegado(null);
      setDetalle(null);
      return;
    }
    setDesplegado(id);
    setDetalle(null);
    try {
      const d = await graphqlRequest(QUERIES.pedidoDetalleAdmin, { id: String(id) });
      setDetalle(d.pedido);
    } catch (err) {
      setDetalle({ error: err.message });
    }
  };

  const cambiarEstado = async (id, actual, nuevo) => {
    setProcesando(true);
    setError(null);
    try {
      await graphqlRequest(MUTATIONS.actualizarEstadoPedido, {
        id: String(id),
        estado: nuevo,
      });
      // Refresca la lista y el detalle si esta abierto.
      const d = await graphqlRequest(QUERIES.pedidosAdmin, filtro ? { estado: filtro } : {});
      setPedidos(d.pedidos);
      if (desplegado === id) {
        const det = await graphqlRequest(QUERIES.pedidoDetalleAdmin, { id: String(id) });
        setDetalle(det.pedido);
      }
    } catch (err) {
      setError(`No se pudo actualizar el estado: ${err.message}`);
    } finally {
      setProcesando(false);
    }
  };

  if (cargando) return <p className="panel-cargando">Cargando órdenes…</p>;

  return (
    <div>
      {error && <p className="panel-error">{error}</p>}

      <div className="filtros">
        <label>
          Estado de envío
          <select value={filtro} onChange={(e) => setFiltro(e.target.value)}>
            {FILTROS.map((f) => (
              <option key={f} value={f}>
                {f ? f : 'Todos'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pedidos.length === 0 ? (
        <p className="panel-cargando">No hay órdenes que coincidan.</p>
      ) : (
        <table className="tabla" style="margin-top: 16px;">
          <thead>
            <tr>
              <th>ID</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Pago</th>
              <th>Cobro</th>
              <th>Envío</th>
            </tr>
          </thead>
          <tbody>
            {pedidos.map((p) => (
              <PedidoFila
                key={p.id}
                p={p}
                desplegado={desplegado}
                detalle={detalle}
                procesando={procesando}
                onToggle={() => abrirDetalle(p.id)}
                onCambiarEstado={cambiarEstado}
              />
            ))}
          </tbody>
        </table>
      )}

      <style>{`
        .filtros label { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; }
        .filtros select { padding: 8px 10px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px; }
        .fila-con-toggle { cursor: pointer; }
        .fila-detalle td { background: var(--surface-muted); }
        .detalle-items { list-style: none; margin: 0 0 6px; padding: 0; font-size: 13px; }
        .detalle-items li { padding: 3px 0; }
        .detalle-meta { font-size: 12px; color: var(--texto-secundario); }
        .select-estado { padding: 5px 8px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; }
      `}</style>
    </div>
  );
}

function PedidoFila({ p, desplegado, detalle, procesando, onToggle, onCambiarEstado }) {
  const opciones = TRANSICIONES[p.status] || [];
  const mostrarDetalle = desplegado === p.id;
  const nombreCliente = p.usuario?.nombre || p.usuario?.email || '—';
  const fecha = new Date(p.fecha).toLocaleString('es-MX', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <>
      <tr className="fila-con-toggle" onClick={onToggle}>
        <td>#{p.id}</td>
        <td>{fecha}</td>
        <td>{nombreCliente}</td>
        <td>{formatoMXN.format(Number(p.total))}</td>
        <td>{p.metodoPago ? p.metodoPago.replace('_', ' ') : '—'}</td>
        <td>
          <span className={`badge badge--${p.estadoPago}`}>{p.estadoPago}</span>
        </td>
        <td>
          <span className={`badge badge--${p.status}`}>{p.status}</span>
        </td>
      </tr>

      {mostrarDetalle && (
        <tr className="fila-detalle">
          <td colSpan={7}>
            {!detalle ? (
              <p className="panel-cargando">Cargando detalle…</p>
            ) : detalle.error ? (
              <p className="panel-error">{detalle.error}</p>
            ) : (
              <>
                <ul className="detalle-items">
                  {detalle.detalles.map((r, i) => (
                    <li key={i}>
                      {r.producto?.nombre} × {r.cantidad} ={' '}
                      {formatoMXN.format(Number(r.subtotal))}
                    </li>
                  ))}
                </ul>
                <p className="detalle-meta">
                  Referencia: {detalle.referenciaPago || '—'} · ID pago:{' '}
                  {detalle.idPago || '—'} · Fecha pago:{' '}
                  {detalle.fechaPago ? new Date(detalle.fechaPago).toLocaleString('es-MX') : '—'}
                </p>
                {opciones.length > 0 && (
                  <div>
                    <label className="detalle-meta" style="margin-right: 8px;">
                      Estado de envío
                    </label>
                    <select
                      className="select-estado"
                      // Se detiene la propagacion para no colapsar el detalle.
                      onClick={(e) => e.stopPropagation()}
                      defaultValue={p.status}
                      onChange={(e) => onCambiarEstado(p.id, p.status, e.target.value)}
                      disabled={procesando}
                    >
                      <option value={p.status} disabled>
                        {p.status} (actual)
                      </option>
                      {opciones.map((op) => (
                        <option key={op} value={op}>
                          {op}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}