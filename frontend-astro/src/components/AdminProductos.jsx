import { useCallback, useEffect, useState } from 'react';
import { graphqlRequest } from '../lib/graphql.js';
import { QUERIES, MUTATIONS } from '../lib/queries.js';

const formatoMXN = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

// CRUD de productos del panel. Cada producto se puede editar inline y al
// guardar se vuelve a cargar el catalogo.
export default function AdminProductos() {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);

  const [nuevo, setNuevo] = useState({ nombre: '', precio: '', stock: '', imagen: '', categoriaId: '' });
  const [procesando, setProcesando] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const d = await graphqlRequest(QUERIES.catalogoAdmin);
      setCategorias(d.categorias);
      setProductos(d.productos);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregar = async (e) => {
    e.preventDefault();
    setProcesando(true);
    setError(null);
    try {
      await graphqlRequest(MUTATIONS.crearProducto, {
        datos: {
          nombre: nuevo.nombre,
          precio: Number(nuevo.precio),
          stock: Number(nuevo.stock),
          imagen: nuevo.imagen || null,
          categoriaId: nuevo.categoriaId || null,
        },
      });
      setNuevo({ nombre: '', precio: '', stock: '', imagen: '', categoriaId: '' });
      await cargar();
    } catch (err) {
      setError(`No se pudo crear el producto: ${err.message}`);
    } finally {
      setProcesando(false);
    }
  };

  const actualizar = async (producto) => {
    setProcesando(true);
    setError(null);
    try {
      await graphqlRequest(MUTATIONS.actualizarProducto, {
        id: String(producto.id),
        datos: {
          nombre: producto.nombre,
          precio: Number(producto.precio),
          stock: Number(producto.stock),
          imagen: producto.imagen || null,
          categoriaId: producto.categoria?.id ? String(producto.categoria.id) : null,
        },
      });
      await cargar();
    } catch (err) {
      setError(`No se pudo guardar el producto: ${err.message}`);
    } finally {
      setProcesando(false);
    }
  };

  const eliminar = async (id) => {
    if (!window.confirm('¿Eliminar este producto? Esta acción no se puede deshacer.')) return;
    setProcesando(true);
    setError(null);
    try {
      await graphqlRequest(MUTATIONS.eliminarProducto, { id: String(id) });
      await cargar();
    } catch (err) {
      setError(`No se pudo eliminar: ${err.message}`);
    } finally {
      setProcesando(false);
    }
  };

  const cambiarFila = (id, campo, valor) => {
    setProductos((lista) =>
      lista.map((p) => (p.id === id ? { ...p, [campo]: valor } : p))
    );
  };

  if (cargando) return <p className="panel-cargando">Cargando productos…</p>;

  return (
    <div>
      {error && <p className="panel-error">{error}</p>}

      <form className="alta" onSubmit={agregar}>
        <input
          placeholder="Nombre"
          value={nuevo.nombre}
          onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
          required
        />
        <input
          placeholder="Precio"
          type="number"
          min="0"
          step="0.01"
          value={nuevo.precio}
          onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
          required
        />
        <input
          placeholder="Stock"
          type="number"
          min="0"
          step="1"
          value={nuevo.stock}
          onChange={(e) => setNuevo({ ...nuevo, stock: e.target.value })}
          required
        />
        <select
          value={nuevo.categoriaId}
          onChange={(e) => setNuevo({ ...nuevo, categoriaId: e.target.value })}
        >
          <option value="">Sin categoría</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <button className="boton boton--primario" disabled={procesando}>
          Agregar
        </button>
      </form>

      <table className="tabla" style="margin-top: 20px;">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Precio</th>
            <th>Stock</th>
            <th>Categoría</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id}>
              <td>
                <input
                  className="celda"
                  value={p.nombre}
                  onChange={(e) => cambiarFila(p.id, 'nombre', e.target.value)}
                />
              </td>
              <td>
                <input
                  className="celda celda--num"
                  type="number"
                  min="0"
                  step="0.01"
                  value={p.precio}
                  onChange={(e) => cambiarFila(p.id, 'precio', e.target.value)}
                />
              </td>
              <td>
                <input
                  className="celda celda--num"
                  type="number"
                  min="0"
                  step="1"
                  value={p.stock}
                  onChange={(e) => cambiarFila(p.id, 'stock', e.target.value)}
                />
              </td>
              <td>
                <select
                  className="celda"
                  value={String(p.categoria?.id || '')}
                  onChange={(e) =>
                    cambiarFila(p.id, 'categoria', { id: Number(e.target.value), nombre: '' })
                  }
                >
                  <option value="">Sin categoría</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </td>
              <td className="celda--acciones">
                <button
                  className="boton boton--secundario"
                  onClick={() => actualizar(p)}
                  disabled={procesando}
                >
                  Guardar
                </button>
                <button
                  className="boton boton--texto boton--peligro"
                  onClick={() => eliminar(p.id)}
                  disabled={procesando}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <style>{`
        .alta { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 10px; align-items: center; }
        .alta input, .alta select {
          padding: 9px 11px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 14px;
        }
        .celda { padding: 6px 8px; border: 1px solid var(--border); border-radius: var(--radius); font-size: 13px; width: 100%; }
        .celda--num { max-width: 110px; }
        .celda--acciones { display: flex; gap: 8px; white-space: nowrap; }
      `}</style>
    </div>
  );
}