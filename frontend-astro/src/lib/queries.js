// Queries y mutations de GraphQL, en un archivo aparte y sin ninguna
// dependencia de entorno, para que lo puedan importar tanto el servidor
// (paginas .astro y endpoints) como las islas de React sin arrastrar
// variables secretas al bundle del navegador.
//
// Documentos GraphQL plano: aqui no hay ni un fetch ni un import.meta.env.
export const QUERIES = {
  categorias: `
    query Categorias {
      categorias { id nombre productos { id } }
    }
  `,
  categoria: `
    query Categoria($id: ID!) {
      categoria(id: $id) {
        id
        nombre
        productos { id nombre precio imagen stock }
      }
    }
  `,
  producto: `
    query Producto($id: ID!) {
      producto(id: $id) {
        id
        nombre
        precio
        imagen
        stock
        categoria { id nombre }
      }
    }
  `,
  productosDestacados: `
    query ProductosDestacados($limite: Int) {
      productos(limite: $limite, desde: 0) {
        id nombre precio imagen stock categoria { id nombre }
      }
    }
  `,
  // Productos + categorias completas para el panel de administracion.
  catalogoAdmin: `
    query CatalogoAdmin {
      categorias { id nombre }
      productos(limite: 500) {
        id nombre precio imagen stock categoria { id nombre }
      }
    }
  `,
  pedidosAdmin: `
    query PedidosAdmin($estado: EstadoPedido) {
      pedidos(estado: $estado) {
        id
        fecha
        total
        status
        metodoPago
        estadoPago
        usuario { id nombre email }
      }
    }
  `,
  pedidoDetalleAdmin: `
    query PedidoDetalleAdmin($id: ID!) {
      pedido(id: $id) {
        id
        fecha
        total
        status
        metodoPago
        estadoPago
        referenciaPago
        idPago
        usuario { id nombre email }
        detalles {
          cantidad
          precioUnitario
          subtotal
          producto { id nombre }
        }
      }
    }
  `,
  estadisticasPanel: `
    query EstadisticasPanel {
      estadisticasPanel {
        ingresosTotales
        ticketPromedio
        totalPedidos
        pedidosPorEstado { estado cantidad }
        stockBajo { id nombre stock precio }
        pedidosRecientes {
          id fecha total status estadoPago
          usuario { nombre email }
        }
      }
    }
  `,
  misPedidos: `
    query MisPedidos {
      pedidos {
        id
        fecha
        total
        status
        metodoPago
        estadoPago
        detalles { cantidad producto { nombre } }
      }
    }
  `,
  pedidoResultado: `
    query PedidoResultado($id: ID!) {
      pedido(id: $id) {
        id
        total
        status
        metodoPago
        estadoPago
        fechaPago
        detalles { cantidad producto { nombre } }
      }
    }
  `,
};

export const MUTATIONS = {
  crearPedido: `
    mutation CrearPedido($d: PedidoInput!) {
      crearPedido(datos: $d) {
        id
        total
        status
        estadoPago
        detalles { cantidad subtotal producto { nombre } }
      }
    }
  `,
  iniciarSesionGoogle: `
    mutation IniciarSesionGoogle($idToken: String!) {
      iniciarSesionGoogle(idToken: $idToken) {
        token
        usuario { id nombre email rol avatarUrl }
      }
    }
  `,
  iniciarSesion: `
    mutation IniciarSesion($email: String!, $password: String!) {
      iniciarSesion(email: $email, password: $password) {
        token
        usuario { id nombre email rol avatarUrl }
      }
    }
  `,
  registrarse: `
    mutation Registrarse($datos: RegistroInput!) {
      registrarse(datos: $datos) {
        token
        usuario { id nombre email rol }
      }
    }
  `,
  iniciarPagoMercadoPago: `
    mutation IniciarPagoMercadoPago($pedidoId: ID!) {
      iniciarPagoMercadoPago(pedidoId: $pedidoId) { id url }
    }
  `,
  iniciarPagoPayPal: `
    mutation IniciarPagoPayPal($pedidoId: ID!) {
      iniciarPagoPayPal(pedidoId: $pedidoId) { id url }
    }
  `,
  confirmarPagoPayPal: `
    mutation ConfirmarPagoPayPal($pedidoId: ID!, $orderId: String!) {
      confirmarPagoPayPal(pedidoId: $pedidoId, orderId: $orderId) {
        id status estadoPago
      }
    }
  `,
  verificarPago: `
    mutation VerificarPago($pedidoId: ID!) {
      verificarPago(pedidoId: $pedidoId) {
        id status estadoPago fechaPago
      }
    }
  `,
  crearProducto: `
    mutation CrearProducto($datos: ProductoInput!) {
      crearProducto(datos: $datos) {
        id nombre precio imagen stock categoria { id }
      }
    }
  `,
  actualizarProducto: `
    mutation ActualizarProducto($id: ID!, $datos: ProductoInput!) {
      actualizarProducto(id: $id, datos: $datos) {
        id nombre precio imagen stock categoria { id }
      }
    }
  `,
  eliminarProducto: `
    mutation EliminarProducto($id: ID!) {
      eliminarProducto(id: $id)
    }
  `,
  actualizarEstadoPedido: `
    mutation ActualizarEstadoPedido($id: ID!, $estado: EstadoPedido!) {
      actualizarEstadoPedido(id: $id, estado: $estado) {
        id status estadoPago
      }
    }
  `,
};