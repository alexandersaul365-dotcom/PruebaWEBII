import { useEffect, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES } from '../lib/queries.js';
import {
  estadoCobroEs,
  estadoEnvioEs,
  formatoMoneda,
  tonoCobro,
  tonoEnvio,
} from '../lib/formatos.js';

const ORDEN_POR_ESTADO = [
  ['PENDING', 'Pendiente'],
  ['CONFIRMED', 'Confirmado'],
  ['SHIPPED', 'Enviado'],
  ['DELIVERED', 'Entregado'],
  ['CANCELLED', 'Cancelado'],
];

// Esqueleto de carga hasta que el panel responde.
function Esqueleto() {
  return (
    <div className="skeleton">
      <div className="skeleton__fila" />
      <div className="skeleton__fila" />
      <div className="skeleton__fila" />
    </div>
  );
}

export default function AdminDash() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    // limiteStock=5 para el aviso de existencias bajas: el backend trae un
    // tope por defecto de 10, así que se pasa explícito desde el front.
    graphqlRequest(QUERIES.estadisticasPanel, { limiteStock: 5, topeRecientes: 5 })
      .then((d) => setStats(d.estadisticasPanel))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <Esqueleto />;
  if (error) return <p className="panel-error">{error}</p>;

  const conteoPorEstado = new Map((stats.pedidosPorEstado || []).map((p) => [p.estado, p.cantidad]));

  return (
    <div>
      <div className="kpis">
        <article className="kpi-card">
          <span>Ingresos (pagado)</span>
          <strong>{formatoMoneda(stats.ingresosTotales || 0)}</strong>
        </article>
        <article className="kpi-card">
          <span>Ticket promedio</span>
          <strong>{formatoMoneda(stats.ticketPromedio || 0)}</strong>
        </article>
        <article className="kpi-card">
          <span>Pedidos</span>
          <strong>{stats.totalPedidos}</strong>
        </article>
        <article className="kpi-card">
          <span>Stock bajo (≤ 5)</span>
          <strong>{(stats.stockBajo || []).length}</strong>
        </article>
      </div>

      <section className="dash-seccion">
        <div className="dash-seccion--header">
          <h2>Pedidos por estado</h2>
        </div>
        <div className="pills">
          {ORDEN_POR_ESTADO.map(([estado, etiqueta]) => (
            <span key={estado} className={`pill pill--estado badge badge--${tonoEnvio(estado)}`}>
              {etiqueta}: {conteoPorEstado.get(estado) || 0}
            </span>
          ))}
        </div>
      </section>

      <section className="dash-seccion">
        <div className="dash-seccion--header">
          <h2>Stock bajo</h2>
          {stats.stockBajo.length > 0 && (
            <span className="badge badge--bad">{stats.stockBajo.length} productos</span>
          )}
        </div>
        {stats.stockBajo.length === 0 ? (
          <p className="panel-vacio">No hay productos con stock bajo.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Precio</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {stats.stockBajo.map((p) => (
                <tr key={p.id}>
                  <td>{p.nombre}</td>
                  <td>{formatoMoneda(p.precio)}</td>
                  <td>
                    <span className={`badge ${p.stock === 0 ? 'badge--bad' : 'badge--pending'}`}>
                      {p.stock}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="dash-seccion">
        <div className="dash-seccion--header">
          <h2>Últimos pedidos</h2>
        </div>
        {stats.pedidosRecientes.length === 0 ? (
          <p className="panel-vacio">Aún no hay pedidos.</p>
        ) : (
          <table className="tabla">
            <thead>
              <tr>
                <th>ID</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Cobro</th>
                <th>Envío</th>
              </tr>
            </thead>
            <tbody>
              {stats.pedidosRecientes.map((p) => (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td>{p.usuario?.nombre || p.usuario?.email || '—'}</td>
                  <td>{formatoMoneda(p.total)}</td>
                  <td>
                    <span className={`badge badge--${tonoCobro(p.estadoPago)}`}>
                      {estadoCobroEs(p.estadoPago)}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge--${tonoEnvio(p.status)}`}>
                      {estadoEnvioEs(p.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}