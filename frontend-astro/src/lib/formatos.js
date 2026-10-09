// Utilidades de formato compartidas entre el servidor (Astro) y las islas
// de React. Solo datos de presentación: no dependen de entorno.

const formatoMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

/**
 * "$8,841.00 MXN" — miles con separador y moneda explícita, igual en la
 * tienda y en el panel.
 */
export function formatoMoneda(valor) {
  return `${formatoMXN.format(Number(valor) || 0)} MXN`;
}

// --- Estados de cobro -> español -----------------------------------------
const COBRO_ES = {
  APROBADO: 'Pagado',
  PENDIENTE: 'Pendiente',
  RECHAZADO: 'Rechazado',
  REEMBOLSADO: 'Reembolsado',
  CANCELADO: 'Cancelado',
};

// --- Estados de envío -> español -----------------------------------------
const ENVIO_ES = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregado',
  CANCELLED: 'Cancelado',
};

export function estadoCobroEs(estado) {
  return COBRO_ES[estado] || (estado ? estado.toLowerCase() : 'Pendiente');
}

export function estadoEnvioEs(estado) {
  return ENVIO_ES[estado] || (estado || '—');
}

// Tono del badge según el estado (usa los tokens --st-*).
export function tonoCobro(estado) {
  switch (estado) {
    case 'APROBADO':
      return 'ok';
    case 'PENDIENTE':
      return 'pending';
    case 'RECHAZADO':
    case 'CANCELADO':
      return 'bad';
    case 'REEMBOLSADO':
      return 'refund';
    default:
      return 'neutral';
  }
}

export function tonoEnvio(estado) {
  switch (estado) {
    case 'DELIVERED':
      return 'ok';
    case 'PENDING':
      return 'pending';
    case 'CANCELLED':
      return 'bad';
    case 'CONFIRMED':
    case 'SHIPPED':
      return 'refund';
    default:
      return 'neutral';
  }
}

export function nombreRolEs(rol) {
  switch (rol) {
    case 'ADMIN':
      return 'Administrador';
    case 'OPERADOR':
      return 'Operador';
    default:
      return 'Cliente';
  }
}