// Actualizacion del estado de cobro/orden en la base, compartida por los
// flujos de Mercado Pago, PayPal y el panel administrativo.
//
// Regla de negocio:
//   - Un pago APROBADO confirma la orden (status CONFIRMED) y guarda la
//     referencia/id del pago y la fecha en que se acredito.
//   - Un pago RECHAZADO deja la orden en PENDING (el cliente puede volver a
//     intentarlo con otro metodo), solo se registra el estado del cobro.
//   - Al CANCELAR una orden que ya habia descontado stock, el stock se
//     devuelve al catalogo.
import { queryOne, withTransaction } from '../db.js';

export async function marcarPagoAprobado(pedidoId, { metodoPago, idPago }) {
  return withTransaction(async (client) => {
    // Solo se "confirma" la orden si aun esta pendiente; un pedido ya
    // enviado/entregado no retrocede por un pago tardio.
    await client.queryOne(
      `UPDATE pedidos
         SET estado_pago = 'APROBADO',
             id_pago = $2,
             fecha_pago = now(),
             status = CASE WHEN status = 'PENDING' THEN 'CONFIRMED' ELSE status END,
             metodo_pago = COALESCE($3, metodo_pago)
       WHERE id = $1
       RETURNING id`,
      [pedidoId, idPago, metodoPago]
    );
    return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
  });
}

export async function marcarPagoFallido(pedidoId) {
  return queryOne(
    `UPDATE pedidos
        SET estado_pago = 'RECHAZADO'
      WHERE id = $1
      RETURNING *`,
    [pedidoId]
  );
}

export async function marcarPagoCancelado(pedidoId) {
  return queryOne(
    `UPDATE pedidos
        SET estado_pago = 'CANCELADO'
      WHERE id = $1
      RETURNING *`,
    [pedidoId]
  );
}

/** Devuelve al stock los renglones de una orden cancelada. */
export async function devolverStock(pedidoId) {
  return withTransaction(async (client) => {
    const renglones = await client.query(
      'SELECT producto_id, cantidad FROM detalle_pedido WHERE pedido_id = $1',
      [pedidoId]
    );
    for (const r of renglones) {
      await client.queryOne(
        'UPDATE productos SET stock = stock + $2 WHERE id = $1',
        [r.producto_id, r.cantidad]
      );
    }
  });
}