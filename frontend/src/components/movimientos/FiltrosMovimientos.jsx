import { useState } from 'react';
import { useCatalog } from '../../context/CatalogContext.jsx';

export default function FiltrosMovimientos({ onFiltrar }) {
  const { catGasto, catIngreso, metodos } = useCatalog();
  const [mes, setMes] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [metodoVal, setMetodoVal] = useState('');

  const aplicar = () => {
    const params = {};
    if (mes) params.mes = mes;
    if (categoriaId) params.categoria_id = categoriaId;
    if (metodoVal) {
      if (metodoVal.startsWith('Tarjeta:')) {
        params.metodo = 'Tarjeta';
        params.tarjeta_id = metodoVal.split(':')[1];
      } else params.metodo = metodoVal;
    }
    onFiltrar(params);
  };

  return (
    <div className="filtros">
      <input type="month" value={mes} onChange={e => setMes(e.target.value)} />
      <select value={categoriaId} onChange={e => setCategoriaId(e.target.value)}>
        <option value="">Todas las categorías</option>
        {[...catGasto, ...catIngreso].map(c => (
          <option key={`${c.tipo}-${c.id}`} value={c.id}>{c.nombre} ({c.tipo})</option>
        ))}
      </select>
      <select value={metodoVal} onChange={e => setMetodoVal(e.target.value)}>
        <option value="">Todos los métodos</option>
        {metodos.map(m => {
          const val = m.tarjeta_id ? `Tarjeta:${m.tarjeta_id}` : m.metodo;
          return <option key={val} value={val}>{m.etiqueta}</option>;
        })}
      </select>
      <button className="mini-btn ancho" onClick={aplicar}>Filtrar</button>
    </div>
  );
}
