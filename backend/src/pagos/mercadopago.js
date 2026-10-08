// Integracion con Mercado Pago (Checkout Pro, ambiente de prueba/sandbox).
//
// Flujo:
//   1. iniciarPagoMercadoPago(pedidoId) crea una "preferencia" con los items
//      del pedido y las URLs de retorno (back_urls) apuntando al frontend.
//      La preferencia nos devuelve init_point / sandbox_init_point, a donde
//      se redirige al cliente para pagar en Mercado Pago.
//   2. Cuando el cliente vuelve (o via webhook), se consulta el pago por
//      external_reference (que guardamos SIEMPRE como el id de nuestro
//      pedido) y se actualiza estado_pago en la base.
//
// Webhook: Mercado Pago firma cada notificacion con el header x-signature
// (algoritmo HMAC-SHA256). En sandbox local los webhooks no llegan (no hay
// URL publica), asi que la verificacion principal es la consulta al volver.
import { createHash } from 'node:crypto';

const MERCADOPAGO_URL = 'https://api.mercadopago.com';

function tokenAcceso() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Falta MP_ACCESS_TOKEN en las variables de entorno.');
  }
  return token;
}

async function apiMercadoPago(ruta, { metodo = 'GET', cuerpo } = {}) {
  const respuesta = await fetch(`${MERCADOPAGO_URL}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${tokenAcceso()}`,
      'Content-Type': 'application/json',
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await respuesta.text();
  let datos = null;
  try {
    datos = texto ? JSON.parse(texto) : null;
  } catch {
    datos = { error: texto };
  }
  if (!respuesta.ok) {
    throw new Error(
      `Mercado Pago respondio ${respuesta.status}: ${datos?.message || datos?.error || 'error desconocido'}`
    );
  }
  return datos;
}

/**
 * Crea la preferencia de pago (Checkout Pro) para un pedido concreto.
 * external_reference = id del pedido, para encontrar el pago al volver.
 * Devuelve { id, url } donde url es el init_point de sandbox.
 */
export async function crearPreferencia({ pedidoId, titulo, total, items }) {
  const appUrl = process.env.APP_URL || 'http://localhost:4321';
  const query = `pedido=${pedidoId}&proveedor=mercadopago`;

  // Mercado Pago exige HTTPS para activar auto_return (te regresa solo al
  // terminar). En desarrollo local (http://localhost) se deja vacio: el
  // cliente vuelve con un boton y el estado real se consulta por
  // external_reference al llegar a /pago/resultado.
  const autoReturn = appUrl.startsWith('https://') ? 'approved' : '';

  const preferencia = await apiMercadoPago('/checkout/preferences', {
    metodo: 'POST',
    cuerpo: {
      items: items.map((r) => ({
        id: String(r.productoId),
        title: r.nombre,
        quantity: r.cantidad,
        unit_price: Math.round(Number(r.precioUnitario)),
        currency_id: 'MXN',
      })),
      external_reference: String(pedidoId),
      auto_return: autoReturn,
      back_urls: {
        success: `${appUrl}/pago/resultado?proveedor=mercadopago&${query}`,
        pending: `${appUrl}/pago/resultado?proveedor=mercadopago&estado=pending&${query}`,
        failure: `${appUrl}/pago/resultado?proveedor=mercadopago&estado=failure&${query}`,
      },
    },
  });

  return {
    id: preferencia.id,
    url: preferencia.sandbox_init_point || preferencia.init_point,
  };
}

/**
 * Consulta el estado del pago por external_reference (= id de nuestro pedido).
 * Devuelve { estado, idPago } donde estado es el status de MP:
 * approved | rejected | pending | in_process | ...
 */
export async function consultarPagoPorReferencia(externalReference) {
  const busqueda = await apiMercadoPago(
    `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}`
  );
  const resultados = busqueda?.results || [];
  if (resultados.length === 0) {
    return { estado: 'pending', idPago: null };
  }
  const pago = resultados[0];
  return { estado: pago.status, idPago: pago.id };
}

/** Consulta un pago por su id (usado por el webhook al recibir data.id). */
export async function obtenerPago(idPago) {
  const pago = await apiMercadoPago(`/v1/payments/${encodeURIComponent(idPago)}`);
  return pago;
}

/**
 * Valida la firma x-signature de un webhook de Mercado Pago, segun la
 * documentacion:
 *   firma = HMAC-SHA256(secreto, "id:{data.id};request-id:{x-request-id};ts:{ts};")
 * Devuelve true/false.
 */
export function validarFirmaWebhook({ xSignature, xRequestId, dataId }) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) return false;
  if (!xSignature || !xRequestId || !dataId) return false;

  const pares = Object.fromEntries(
    (xSignature || '')
      .split(',')
      .map((kv) => kv.split('=').map((s) => s.trim()))
  );
  const ts = pares.ts;
  const firmaRecibida = pares.v1;
  if (!ts || !firmaRecibida) return false;

  const mensaje = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const firmaCalculada = createHash('sha256').update(mensaje).digest('hex');
  return firmaCalculada === firmaRecibida;
}