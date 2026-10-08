export const typeDefs = `#graphql
  """Rol que puede tener un usuario del sistema."""
  enum RolUsuario {
    ADMIN
    OPERADOR
    CLIENTE
  }

  """Proveedor con el que el usuario inicio sesion."""
  enum ProveedorAuth {
    LOCAL
    GOOGLE
  }

  """Estado del ciclo de vida de un pedido."""
  enum EstadoPedido {
    PENDING
    CONFIRMED
    SHIPPED
    DELIVERED
    CANCELLED
  }

  """Pasarela de pago elegida por el cliente para pagar un pedido."""
  enum MetodoPago {
    MERCADO_PAGO
    PAYPAL
  }

  """Estado del cobro, independiente del estado del pedido."""
  enum EstadoPago {
    PENDIENTE
    APROBADO
    RECHAZADO
    CANCELADO
  }

  """Categoria del catalogo (tabla categorias)."""
  type Categoria {
    id: ID!
    nombre: String!
    "Productos que pertenecen a esta categoria (resolver de campo, relacion 1-N)."
    productos: [Producto!]!
  }

  """Producto disponible en el catalogo (tabla productos)."""
  type Producto {
    id: ID!
    nombre: String!
    precio: Float!
    imagen: String
    stock: Int!
    "Categoria a la que pertenece este producto (nula si no tiene)."
    categoria: Categoria
  }

  """Usuario que compra en la plataforma (tabla usuarios)."""
  type Usuario {
    id: ID!
    nombre: String!
    email: String!
    rol: RolUsuario!
    avatarUrl: String
    authProvider: ProveedorAuth!
    "Historial de pedidos de este usuario (resolver de campo, relacion 1-N)."
    pedidos: [Pedido!]!
  }

  """Un renglon del pedido: un producto con la cantidad comprada (tabla detalle_pedido)."""
  type DetallePedido {
    id: ID!
    "Producto de este renglon (resolver de campo)."
    producto: Producto!
    cantidad: Int!
    precioUnitario: Float!
    subtotal: Float!
  }

  """Pedido realizado por un usuario (tabla pedidos)."""
  type Pedido {
    id: ID!
    fecha: String!
    total: Float!
    status: EstadoPedido!
    "Pasarela con la que el cliente dijo que iba a pagar (si ya eligio)."
    metodoPago: MetodoPago
    "Estado del cobro (PENDIENTE hasta que la pasarela lo acredite)."
    estadoPago: EstadoPago!
    "Id de la preferencia (Mercado Pago) u orden (PayPal) en la pasarela."
    referenciaPago: String
    "Id del pago ya capturado en la pasarela (si aprobo)."
    idPago: String
    "Fecha en que se acredito el pago."
    fechaPago: String
    "Usuario que realizo el pedido (resolver de campo)."
    usuario: Usuario!
    "Renglones del pedido, cada uno con su producto y cantidad (relacion N-N via detalle_pedido)."
    detalles: [DetallePedido!]!
  }

  """Respuesta de una pasarela: a donde hay que redirigir al cliente."""
  type UrlPago {
    id: String!
    url: String
  }

  """Resultado de iniciar sesion: el usuario autenticado y un JWT propio.
  Ese mismo JWT sirve para autorizar tanto este API de GraphQL (claim "rol")
  como las llamadas directas a PostgREST (claim "role", usado para SET ROLE)."""
  type SesionAuth {
    token: String!
    usuario: Usuario!
  }

  """Conteo de pedidos en un mismo estado (para el panel)."""
  type ConteoEstado {
    estado: EstadoPedido!
    cantidad: Int!
  }

  """Metricas basicas del panel administrativo."""
  type EstadisticasPanel {
    "Suma de los pedidos no cancelados."
    ingresosTotales: Float!
    "Total ingresado / total de pedidos no cancelados."
    ticketPromedio: Float!
    "Cantidad de pedidos (todos los estados)."
    totalPedidos: Int!
    "Pedidos por estado (PENDING, CONFIRMED, ...)."
    pedidosPorEstado: [ConteoEstado!]!
    "Productos con stock bajo (menor o igual al limite indicado)."
    stockBajo: [Producto!]!
    "Los pedidos mas recientes (tope indicado)."
    pedidosRecientes: [Pedido!]!
  }

  """Datos para crear o actualizar un producto."""
  input ProductoInput {
    nombre: String!
    precio: Float!
    imagen: String
    stock: Int!
    "Categoria del producto (nula si el producto no pertenece a ninguna)."
    categoriaId: ID
  }

  """Un renglon (producto + cantidad) al armar un pedido nuevo."""
  input DetallePedidoInput {
    productoId: ID!
    cantidad: Int!
  }

  """Datos para registrar un pedido nuevo.
  El usuario del pedido se toma del JWT autenticado, nunca del cliente."""
  input PedidoInput {
    metodoPago: MetodoPago
    detalles: [DetallePedidoInput!]!
  }

  """Datos para crear una cuenta local (login con correo/contraseña)."""
  input RegistroInput {
    nombre: String!
    email: String!
    password: String!
  }

  """Operaciones de lectura (no cambian el estado del sistema)."""
  type Query {
    "Lista las categorias; cada una resuelve sus propios productos (consulta anidada)."
    categorias: [Categoria!]!
    "Consulta una categoria por su identificador."
    categoria(id: ID!): Categoria

    "Catalogo de productos, paginado."
    productos(limite: Int, desde: Int): [Producto!]!
    "Consulta un producto por su identificador."
    producto(id: ID!): Producto

    "Historial de pedidos. Un CLIENTE solo ve los suyos; el equipo del panel ve todos."
    pedidos(estado: EstadoPedido): [Pedido!]!

    "Consulta un pedido por su id (el dueno del pedido o el equipo del panel)."
    pedido(id: ID!): Pedido

    "Metricas del panel administrativo. Requiere rol ADMIN u OPERADOR."
    estadisticasPanel(limiteStock: Int, topeRecientes: Int): EstadisticasPanel!

    "Usuario actualmente autenticado (segun el JWT enviado), o null si no hay sesion."
    yo: Usuario
  }

  """Operaciones de escritura (registran, actualizan o eliminan datos)."""
  type Mutation {
    "Registra un producto nuevo en el catalogo. Requiere rol ADMIN u OPERADOR."
    crearProducto(datos: ProductoInput!): Producto!
    "Actualiza los datos de un producto existente. Requiere rol ADMIN u OPERADOR."
    actualizarProducto(id: ID!, datos: ProductoInput!): Producto
    "Elimina un producto del catalogo. Requiere rol ADMIN u OPERADOR."
    eliminarProducto(id: ID!): Boolean!

    "Registra un pedido nuevo junto con sus renglones. Requiere sesion iniciada."
    crearPedido(datos: PedidoInput!): Pedido!

    "Cambia el estado de un pedido (confirmar, enviar, entregar, cancelar). Requiere rol ADMIN u OPERADOR."
    actualizarEstadoPedido(id: ID!, estado: EstadoPedido!): Pedido

    "Crea una cuenta local (rol CLIENTE) y devuelve la sesion ya iniciada."
    registrarse(datos: RegistroInput!): SesionAuth!

    "Inicia sesion con correo y contrasena local. Devuelve la sesion y su JWT."
    iniciarSesion(email: String!, password: String!): SesionAuth!

    """
    Inicia sesion con un ID token de Google (obtenido en el frontend via
    Google Identity Services). Crea el usuario si es su primera vez, o lo
    vincula a una cuenta LOCAL existente con el mismo correo.
    """
    iniciarSesionGoogle(idToken: String!): SesionAuth!

    "Crea la preferencia de Mercado Pago para un pedido y devuelve la URL de pago."
    iniciarPagoMercadoPago(pedidoId: ID!): UrlPago!

    "Crea la orden de pago en PayPal para un pedido y devuelve la URL de aprobacion."
    iniciarPagoPayPal(pedidoId: ID!): UrlPago!

    "Captura en PayPal una orden ya aprobada por el comprador (se llama al volver)."
    confirmarPagoPayPal(pedidoId: ID!, orderId: String!): Pedido!

    "Consulta el estado real del cobro contra la pasarela y actualiza la orden si procede."
    verificarPago(pedidoId: ID!): Pedido!
  }
`;