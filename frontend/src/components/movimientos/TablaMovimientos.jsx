import { fmtFecha, fmtQ } from '../../utils.js';

export default function TablaMovimientos({ movs, onEditar, onEliminar }) {
  if (!movs.length) return <p className="texto-suave">No hay movimientos con esos filtros.</p>;

  return (
    <div className="tabla-scroll">
      <table>
        <tbody>
          <tr>
            <th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Categoría</th>
            <th>Método</th><th style={{ textAlign: 'right' }}>Monto</th><th></th>
          </tr>
          {movs.map((m, i) => (
            <tr key={`${m.tipo}-${m.id}`} className={`mov-${m.tipo}`}>
              <td>{fmtFecha(m.fecha)}</td>
              <td><span className={`etq ${m.tipo}`}>{m.tipo}</span></td>
              <td>{m.descripcion || '—'}</td>
              <td>{m.categoria || '—'}</td>
              <td>{m.metodo_etiqueta}</td>
              <td className="num">{m.tipo === 'ingreso' ? '+' : '−'}{fmtQ(m.monto)}</td>
              <td>
                <button className="accion" title="Editar" onClick={() => onEditar(i)}>✏️</button>
                <button className="accion" title="Eliminar" onClick={() => onEliminar(i)}>🗑️</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
