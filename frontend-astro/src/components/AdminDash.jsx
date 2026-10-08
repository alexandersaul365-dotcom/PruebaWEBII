import { useEffect, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES } from '../lib/queries.js';

const formatoMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

export default function AdminDash() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    graphqlRequest(QUERIES.estadisticasPanel)
      .then((d) => setStats(d.estadisticasPanel))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  if (cargando) return <p className="panel-cargando">Cargando estadísticas…</p>;
  if (error) return <p className="panel-error">{error}</p>;

  const ordenEstados = ['PENDIENTE', 'APROBADO', 'RECHAZADO', 'REEMBOLSADO'];

  return (
    <div className="admin-dash">
      <div className="kpis">
        <article>
          <span>Ingresos (pagado)</span>
          <strong>{formatoMXN.format(stats.ingresosTotales || 0)}</strong>
        </article>
        <article>
          <span>Ticket promedio</span>
          <strong>{formatoMXN.format(stats.ticketPromedio || 0)}</strong>
        </article>
        <article>
          <span>Pedidos</span>
          <strong>{stats.totalPedidos}</strong>
        </article>
        <article>
          <span>Productos con stock bajo (≤ 5)</span>
          <strong>{(stats.stockBajo || []).length}</strong>
        </article>
      </div>

      <div className="dash-seccion">
        <h2>Pedidos por estado</h2>
        <ul className="dash-lista">
          {ordenEstados.map((estado) => {
            const encontrado = (stats.pedidosPorEstado || []).find((p) => p.estado === estado);
            return (
              <li key={estado}>
                <span className={`badge badge--${estado}`}>{estado}</span>
                <em>{encontrado?.cantidad || 0}</em>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="dash-seccion">
        <h2>Stock bajo</h2>
        {stats.stockBajo.length === 0 ? (
          <p className="panel-cargando">No hay productos con stock bajo.</p>
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
                  <td>{formatoMXN.format(Number(p.precio))}</td>
                  <td>{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="dash-seccion">
        <h2>Últimos pedidos</h2>
        {stats.pedidosRecientes.length === 0 ? (
          <p className="panel-cargando">Aún no hay pedidos.</p>
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
                  <td>{p.usuario?.nombre || p.usuario?.email}</td>
                  <td>{formatoMXN.format(Number(p.total))}</td>
                  <td>
                    <span className={`badge badge--${p.estadoPago}`}>{p.estadoPago}</span>
                  </td>
                  <td>
                    <span className={`badge badge--${p.status}`}>{p.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .dash-seccion { margin-top: 28px; }
        .dash-seccion h2 { font-size: 16px; font-family: var(--font-display); margin: 0 0 10px; }
        .dash-lista { list-style: none; margin: 0; padding: 0; display: flex; gap: 12px; flex-wrap: wrap; }
        .dash-lista li { display: flex; align-items: center; gap: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 10px 14px; }
        .dash-lista em { font-style: normal; font-weight: 700; }
      `}</style>
    </div>
  );
}