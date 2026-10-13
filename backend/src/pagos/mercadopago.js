// Integracion con Mercado Pago (Checkout API / Checkout Transparente,
// ambiente de prueba/sandbox).
//
// Flujo:
//   1. El navegador tokeniza la tarjeta con la Public Key (MercadoPago.js v2)
//      y manda el token al backend via procesarPagoMercadoPago.
//   2. crearPago() llama a POST /v1/payments con ese token y el monto del
//      pedido (external_reference = id de nuestro pedido). Mercado Pago
//      responde el estado del cobro en el momento (approved | rejected |
//      pending | in_process).
//   3. Si el pago queda pendiente, al volver a /pago/resultado se consulta el
//      estado real por external_reference y se actualiza estado_pago.
//
// Webhook: Mercado Pago firma cada notificacion con el header x-signature
// (algoritmo HMAC-SHA256). En sandbox local los webhooks no llegan (no hay
// URL publica), asi que la verificacion principal es la consulta por API.
import { createHash } from 'node:crypto';

const MERCADOPAGO_URL = 'https://api.mercadopago.com';

function tokenAcceso() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('Falta MP_ACCESS_TOKEN en las variables de entorno.');
  }
  return token;
}

async function apiMercadoPago(ruta, { metodo = 'GET', cuerpo, encabezados = {} } = {}) {
  const respuesta = await fetch(`${MERCADOPAGO_URL}${ruta}`, {
    method: metodo,
    headers: {
      Authorization: `Bearer ${tokenAcceso()}`,
      'Content-Type': 'application/json',
      ...encabezados,
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
 * Procesa un pago con Checkout API (Checkout Transparente). Recibe el token
 * de tarjeta generado en el navegador con la Public Key y cobra el monto del
 * pedido. external_reference = id del pedido, para encontrarlo despues.
 * Devuelve { estado, idPago, statusDetail }.
 */
export async function crearPago({
  pedidoId,
  monto,
  token,
  paymentMethodId,
  installments = 1,
  issuerId,
  payerEmail,
  descripcion,
}) {
  // Idempotencia: la clave se deriva del pedido + token de tarjeta, que es
  // de un solo uso. Si el navegador reintenta el MISMO intento (timeout sin
  // respuesta clara), Mercado Pago devuelve el pago ya creado en vez de
  // generar DOS cobros por el mismo pedido.
  const idempotencyKey = createHash('sha256')
    .update(`${pedidoId}:${token}`)
    .digest('hex');

  const pago = await apiMercadoPago('/v1/payments', {
    metodo: 'POST',
    encabezados: { 'X-Idempotency-Key': idempotencyKey },
    cuerpo: {
      transaction_amount: Number(Number(monto).toFixed(2)),
      description: descripcion || `Pedido #${pedidoId} - NexoPlay`,
      external_reference: String(pedidoId),
      installments: Number(installments) || 1,
      payment_method_id: paymentMethodId,
      issuer_id: issuerId ? Number(issuerId) : undefined,
      token,
      payer: {
        email: payerEmail,
      },
      metadata: { pedido_id: String(pedidoId) },
    },
  });

  return {
    estado: pago.status,
    idPago: pago.id,
    statusDetail: pago.status_detail,
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