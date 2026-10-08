import { query, queryOne, withTransaction } from './db.js';
import { requerirAdmin, requerirPanel, requerirUsuario } from './auth/context.js';
import { firmarToken } from './auth/jwt.js';
import { verificarIdTokenGoogle, buscarOCrearUsuarioGoogle } from './auth/google.js';
import { crearHash, verificarPassword } from './auth/password.js';
import {
  crearPreferencia as crearPreferenciaMercadoPago,
  consultarPagoPorReferencia,
} from './pagos/mercadopago.js';
import { crearOrden as crearOrdenPayPal, capturarOrden, consultarOrden } from './pagos/paypal.js';
import { marcarPagoAprobado, marcarPagoCancelado, marcarPagoFallido, devolverStock } from './pagos/estado-pedido.js';

// Estados siguientes permitidos al cambiar el estado de un pedido desde el
// panel. La cancelacion se permite desde PENDING/CONFIRMED/SHIPPED y devuelve
// el stock. Estados terminales (DELIVERED, CANCELLED) no cambian.
const TRANSICIONES = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: [],
  CANCELLED: [],
};

/** Valida la entrada de crear/actualizar producto antes de tocar la base. */
function validarProductoInput(datos) {
  const nombre = (datos.nombre || '').trim();
  if (!nombre) throw new Error('El nombre del producto es obligatorio.');
  const precio = Number(datos.precio);
  const stock = Number(datos.stock);
  if (!Number.isFinite(precio) || precio < 0) {
    throw new Error('El precio debe ser un numero mayor o igual a cero.');
  }
  if (!Number.isFinite(stock) || !Number.isInteger(stock) || stock < 0) {
    throw new Error('El stock debe ser un entero mayor o igual a cero.');
  }
  return { ...datos, nombre, precio, stock };
}

/** Valida que el usuario pueda ver/operar un pedido (dueno o equipo del panel). */
async function pedidoAutorizado(id, usuario) {
  const pedido = await queryOne('SELECT * FROM pedidos WHERE id = $1', [id]);
  if (!pedido) {
    throw new Error(`No existe un pedido con id ${id}`);
  }
  const esEquipoPanel = usuario.rol === 'ADMIN' || usuario.rol === 'OPERADOR';
  if (!esEquipoPanel && pedido.usuario_id !== usuario.id) {
    throw new Error('Este pedido no te pertenece.');
  }
  return pedido;
}

/** Renglones de un pedido con los datos del producto (para la pasarela). */
async function renglonesConProducto(pedidoId) {
  const renglones = await query(
    `SELECT dp.producto_id AS "productoId", dp.cantidad, dp.precio_unitario AS "precioUnitario",
            p.nombre
       FROM detalle_pedido dp
       JOIN productos p ON p.id = dp.producto_id
      WHERE dp.pedido_id = $1
      ORDER BY dp.id`,
    [pedidoId]
  );
  return renglones;
}

export const resolvers = {
  Query: {
    categorias: () => query('SELECT * FROM categorias ORDER BY id'),
    categoria: (_, { id }) => queryOne('SELECT * FROM categorias WHERE id = $1', [id]),

    productos: (_, { limite = 20, desde = 0 }) =>
      query('SELECT * FROM productos ORDER BY id LIMIT $1 OFFSET $2', [limite, desde]),
    producto: (_, { id }) => queryOne('SELECT * FROM productos WHERE id = $1', [id]),

    // Un CLIENTE solo ve sus propios pedidos; el equipo del panel los ve todos.
    pedidos: (_, { estado }, context) => {
      const usuario = requerirUsuario(context);
      const esEquipoPanel = usuario.rol === 'ADMIN' || usuario.rol === 'OPERADOR';

      if (esEquipoPanel) {
        const parametros = estado ? [estado] : [];
        const clausula = estado ? ' WHERE status = $1' : '';
        return query(`SELECT * FROM pedidos${clausula} ORDER BY id DESC`, parametros);
      }

      const parametros = estado ? [usuario.id, estado] : [usuario.id];
      const clausula = estado
        ? ' WHERE usuario_id = $1 AND status = $2'
        : ' WHERE usuario_id = $1';
      return query(`SELECT * FROM pedidos${clausula} ORDER BY id DESC`, parametros);
    },

    pedido: async (_, { id }, context) => {
      const usuario = requerirUsuario(context);
      return pedidoAutorizado(id, usuario);
    },

    estadisticasPanel: async (_, { limiteStock = 10, topeRecientes = 5 }, context) => {
      requerirPanel(context);
      const [ingresos, total, porEstado, stockBajo, recientes] = await Promise.all([
        queryOne(
          `SELECT COALESCE(SUM(total), 0) AS ingresos,
                  COALESCE(AVG(total), 0) AS ticket
             FROM pedidos
            WHERE status <> 'CANCELLED' AND estado_pago = 'APROBADO'`
        ),
        queryOne('SELECT COUNT(*)::int AS total FROM pedidos'),
        query('SELECT status AS estado, COUNT(*)::int AS cantidad FROM pedidos GROUP BY status ORDER BY estado'),
        query('SELECT * FROM productos WHERE stock <= $1 ORDER BY stock ASC LIMIT $2', [limiteStock, 20]),
        query('SELECT * FROM pedidos ORDER BY id DESC LIMIT $1', [topeRecientes]),
      ]);

      return {
        ingresosTotales: Number(ingresos.ingresos || 0),
        ticketPromedio: Number(ingresos.ticket || 0),
        totalPedidos: total.total,
        pedidosPorEstado: porEstado,
        stockBajo,
        pedidosRecientes: recientes,
      };
    },

    yo: (_, __, context) => {
      if (!context.usuario) return null;
      return queryOne('SELECT * FROM usuarios WHERE id = $1', [context.usuario.id]);
    },
  },

  Mutation: {
    // --- Gestion de productos (equipo del panel) ------------------------
    crearProducto: async (_, { datos }, context) => {
      requerirPanel(context);
      const validos = validarProductoInput(datos);
      return queryOne(
        `INSERT INTO productos (nombre, precio, imagen, stock, categoria_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [validos.nombre, validos.precio, validos.imagen ?? null, validos.stock, validos.categoriaId]
      );
    },

    actualizarProducto: async (_, { id, datos }, context) => {
      requerirPanel(context);
      const validos = validarProductoInput(datos);
      const existente = await queryOne('SELECT * FROM productos WHERE id = $1', [id]);
      if (!existente) return null;
      return queryOne(
        `UPDATE productos
           SET nombre = $1, precio = $2, imagen = $3, stock = $4, categoria_id = $5
         WHERE id = $6
         RETURNING *`,
        [validos.nombre, validos.precio, validos.imagen ?? null, validos.stock, validos.categoriaId, id]
      );
    },

    eliminarProducto: async (_, { id }, context) => {
      requerirPanel(context);
      const rows = await query('DELETE FROM productos WHERE id = $1 RETURNING id', [id]);
      return rows.length > 0;
    },

    // --- Pedidos ---------------------------------------------------------
    crearPedido: async (_, { datos }, context) => {
      const usuario = requerirUsuario(context);

      if (!datos.detalles || datos.detalles.length === 0) {
        throw new Error('El pedido necesita al menos un renglon (producto + cantidad).');
      }

      // Dentro de una transaccion real: se valida y DESCUENTA el stock (con
      // lock de fila para que dos compradores no vendan la ultima unidad a la
      // vez), y se inserta el pedido junto con sus renglones. O no se crea
      // nada si cualquier paso falla.
      const pedidoId = await withTransaction(async (client) => {
        let total = 0;
        const renglones = [];

        for (const r of datos.detalles) {
          const producto = await client.queryOne(
            'SELECT * FROM productos WHERE id = $1 FOR UPDATE',
            [r.productoId]
          );
          if (!producto) {
            throw new Error(`No existe un producto con id ${r.productoId}`);
          }
          if (r.cantidad <= 0) {
            throw new Error('La cantidad debe ser mayor a cero.');
          }
          if (producto.stock < r.cantidad) {
            throw new Error(
              `Stock insuficiente para "${producto.nombre}": quedan ${producto.stock} disponible(s).`
            );
          }
          await client.queryOne(
            'UPDATE productos SET stock = stock - $2 WHERE id = $1',
            [producto.id, r.cantidad]
          );
          total += Number(producto.precio) * r.cantidad;
          renglones.push({
            productoId: producto.id,
            cantidad: r.cantidad,
            precioUnitario: producto.precio,
          });
        }

        const pedido = await client.queryOne(
          `INSERT INTO pedidos (usuario_id, total, status, metodo_pago)
           VALUES ($1, $2, 'PENDING', $3)
           RETURNING id`,
          [usuario.id, total, datos.metodoPago ?? null]
        );

        for (const r of renglones) {
          await client.queryOne(
            `INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario)
             VALUES ($1, $2, $3, $4)`,
            [pedido.id, r.productoId, r.cantidad, r.precioUnitario]
          );
        }

        return pedido.id;
      });

      return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
    },

    actualizarEstadoPedido: async (_, { id, estado }, context) => {
      requerirPanel(context);
      const pedido = await queryOne('SELECT * FROM pedidos WHERE id = $1', [id]);
      if (!pedido) return null;

      const permitidos = TRANSICIONES[pedido.status] || [];
      if (!permitidos.includes(estado)) {
        throw new Error(
          `No se puede pasar un pedido de "${pedido.status}" a "${estado}".`
        );
      }

      if (estado === 'CANCELLED') {
        await devolverStock(id);

        // Si el pedido aun no se habia pagado, el cobro tampoco tiene sentido:
        // pasa a CANCELADO (el enum EstadoPago ya lo contempla). Un pedido ya
        // pagado conserva su APROBADO (el reembolso real seria REEMBOLSADO y
        // no lo gestiona este panel).
        if (pedido.estado_pago === 'PENDIENTE') {
          await marcarPagoCancelado(id);
        }

        return queryOne(
          `UPDATE pedidos SET status = 'CANCELLED' WHERE id = $1 RETURNING *`,
          [id]
        );
      }

      return queryOne(
        `UPDATE pedidos SET status = $2 WHERE id = $1 RETURNING *`,
        [id, estado]
      );
    },

    // --- Autenticacion local ---------------------------------------------
    registrarse: async (_, { datos }) => {
      const nombre = (datos.nombre || '').trim();
      const email = (datos.email || '').trim().toLowerCase();
      if (!nombre) throw new Error('El nombre es obligatorio.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('El correo no tiene un formato valido.');
      }
      if (!datos.password || datos.password.length < 6) {
        throw new Error('La contrasena debe tener al menos 6 caracteres.');
      }

      const existente = await queryOne('SELECT id FROM usuarios WHERE email = $1', [email]);
      if (existente) {
        throw new Error('Ya existe una cuenta con ese correo.');
      }

      const usuario = await queryOne(
        `INSERT INTO usuarios (nombre, email, password, auth_provider, rol)
         VALUES ($1, $2, $3, 'LOCAL', 'CLIENTE')
         RETURNING *`,
        [nombre, email, await crearHash(datos.password)]
      );
      return { token: firmarToken(usuario), usuario };
    },

    iniciarSesion: async (_, { email, password }) => {
      const usuario = await queryOne(
        'SELECT * FROM usuarios WHERE email = $1',
        [(email || '').trim().toLowerCase()]
      );
      if (!usuario || !(await verificarPassword(password, usuario.password))) {
        throw new Error('Correo o contrasena incorrectos.');
      }
      return { token: firmarToken(usuario), usuario };
    },

    iniciarSesionGoogle: async (_, { idToken }) => {
      const datosGoogle = await verificarIdTokenGoogle(idToken);
      const usuario = await buscarOCrearUsuarioGoogle(datosGoogle);
      const token = firmarToken(usuario);
      return { token, usuario };
    },

    // --- Pasarelas de pago ----------------------------------------------
    iniciarPagoMercadoPago: async (_, { pedidoId }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));
      if (pedido.status === 'CANCELLED') {
        throw new Error('Un pedido cancelado no se puede pagar.');
      }
      if (pedido.estado_pago === 'APROBADO') {
        throw new Error('Este pedido ya esta pagado.');
      }

      const renglones = await renglonesConProducto(pedidoId);
      const preferencia = await crearPreferenciaMercadoPago({
        pedidoId,
        titulo: `Pedido #${pedidoId} - NexoPlay`,
        total: pedido.total,
        items: renglones,
      });

      await queryOne(
        `UPDATE pedidos
            SET metodo_pago = COALESCE(metodo_pago, 'MERCADO_PAGO'),
                referencia_pago = $2
          WHERE id = $1`,
        [pedidoId, preferencia.id]
      );

      return { id: preferencia.id, url: preferencia.url };
    },

    iniciarPagoPayPal: async (_, { pedidoId }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));
      if (pedido.status === 'CANCELLED') {
        throw new Error('Un pedido cancelado no se puede pagar.');
      }
      if (pedido.estado_pago === 'APROBADO') {
        throw new Error('Este pedido ya esta pagado.');
      }

      const orden = await crearOrdenPayPal({ pedidoId, total: pedido.total });

      await queryOne(
        `UPDATE pedidos
            SET metodo_pago = COALESCE(metodo_pago, 'PAYPAL'),
                referencia_pago = $2
          WHERE id = $1`,
        [pedidoId, orden.id]
      );

      return { id: orden.id, url: orden.url };
    },

    confirmarPagoPayPal: async (_, { pedidoId, orderId }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));

      // El orderId lo manda el navegador al volver de PayPal; debe ser EXACTO
      // el de la orden creada para este pedido (referencia_pago). Sin esto un
      // cliente podria capturar una orden ajena y marcar como pagado un pedido
      // suyo que nunca pago.
      if (!pedido.referencia_pago || orderId !== pedido.referencia_pago) {
        throw new Error('La orden de PayPal no corresponde a este pedido.');
      }

      const captura = await capturarOrden(orderId);

      if (captura.estado === 'COMPLETED') {
        await marcarPagoAprobado(pedidoId, { metodoPago: 'PAYPAL', idPago: captura.idPago });
      } else {
        await marcarPagoFallido(pedidoId);
      }

      return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
    },

    verificarPago: async (_, { pedidoId }, context) => {
      const pedido = await pedidoAutorizado(pedidoId, requerirUsuario(context));
      if (pedido.estado_pago !== 'PENDIENTE') {
        return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
      }

      if (pedido.metodo_pago === 'MERCADO_PAGO') {
        const resultado = await consultarPagoPorReferencia(String(pedidoId));
        if (resultado.estado === 'approved') {
          await marcarPagoAprobado(pedidoId, {
            metodoPago: 'MERCADO_PAGO',
            idPago: resultado.idPago,
          });
        } else if (resultado.estado === 'rejected' || resultado.estado === 'cancelled') {
          await marcarPagoFallido(pedidoId);
        }
      } else if (pedido.metodo_pago === 'PAYPAL' && pedido.referencia_pago) {
        const orden = await consultarOrden(pedido.referencia_pago);
        if (orden.estado === 'COMPLETED') {
          await marcarPagoAprobado(pedidoId, { metodoPago: 'PAYPAL', idPago: orden.id });
        } else if (orden.estado === 'APPROVED') {
          const captura = await capturarOrden(pedido.referencia_pago);
          if (captura.estado === 'COMPLETED') {
            await marcarPagoAprobado(pedidoId, { metodoPago: 'PAYPAL', idPago: captura.idPago });
          }
        }
      }

      return queryOne('SELECT * FROM pedidos WHERE id = $1', [pedidoId]);
    },
  },

  // --- Resolvers de campo (relaciones) ----------------------------------
  Categoria: {
    productos: (categoria) =>
      query('SELECT * FROM productos WHERE categoria_id = $1 ORDER BY id', [categoria.id]),
  },

  Producto: {
    categoria: (producto) =>
      queryOne('SELECT * FROM categorias WHERE id = $1', [producto.categoria_id]),
  },

  Usuario: {
    avatarUrl: (usuario) => usuario.avatar_url,
    authProvider: (usuario) => usuario.auth_provider,
    pedidos: (usuario) =>
      query('SELECT * FROM pedidos WHERE usuario_id = $1 ORDER BY id', [usuario.id]),
  },

  Pedido: {
    usuario: (pedido) => queryOne('SELECT * FROM usuarios WHERE id = $1', [pedido.usuario_id]),
    detalles: (pedido) =>
      query('SELECT * FROM detalle_pedido WHERE pedido_id = $1 ORDER BY id', [pedido.id]),
    fecha: (pedido) => pedido.fecha,
    estadoPago: (pedido) => pedido.estado_pago,
    metodoPago: (pedido) => pedido.metodo_pago,
    referenciaPago: (pedido) => pedido.referencia_pago,
    idPago: (pedido) => pedido.id_pago,
    fechaPago: (pedido) => pedido.fecha_pago,
  },

  DetallePedido: {
    producto: (detalle) =>
      queryOne('SELECT * FROM productos WHERE id = $1', [detalle.producto_id]),
    precioUnitario: (detalle) => detalle.precio_unitario,
    subtotal: (detalle) => detalle.cantidad * Number(detalle.precio_unitario),
  },
};