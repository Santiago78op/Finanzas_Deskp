import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';

export default function CategoriaManager() {
  const { refetch } = useCatalog();
  const toast = useToast();
  const [cats, setCats] = useState([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('gasto');

  const cargar = useCallback(async () => setCats(await api('/api/categorias?incluir_inactivas=true')), []);
  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async (e) => {
    e.preventDefault();
    try {
      await api('/api/categorias', { method: 'POST', body: { nombre, tipo } });
      toast('Categoría agregada ✓');
      setNombre('');
      await refetch();
      await cargar();
    } catch (err) { toast(err.message, true); }
  };

  const renombrar = async (c) => {
    const nuevo = prompt('Nuevo nombre de la categoría:', c.nombre);
    if (!nuevo || nuevo === c.nombre) return;
    try {
      await api(`/api/categorias/${c.id}`, { method: 'PUT', body: { nombre: nuevo } });
      toast('Categoría renombrada ✓');
      await refetch();
      await cargar();
    } catch (err) { toast(err.message, true); }
  };

  const toggle = async (c) => {
    try {
      await api(`/api/categorias/${c.id}`, { method: 'PUT', body: { activa: !c.activa } });
      toast('Categoría actualizada ✓');
      await refetch();
      await cargar();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <div className="panel">
      <h3>Categorías</h3>
      <form className="form-inline" autoComplete="off" onSubmit={agregar}>
        <input type="text" placeholder="Nueva categoría" required value={nombre} onChange={e => setNombre(e.target.value)} />
        <select value={tipo} onChange={e => setTipo(e.target.value)}>
          <option value="gasto">Gasto</option>
          <option value="ingreso">Ingreso</option>
        </select>
        <button type="submit" className="mini-btn">Agregar</button>
      </form>
      {cats.map(c => (
        <div className="item-lista" key={c.id}>
          <span className={c.activa ? '' : 'inactivo'}>{c.nombre} <small>({c.tipo})</small></span>
          <span>
            <button className="mini-btn" onClick={() => renombrar(c)}>Renombrar</button>
            <button className="mini-btn" onClick={() => toggle(c)}>{c.activa ? 'Desactivar' : 'Activar'}</button>
          </span>
        </div>
      ))}
    </div>
  );
}
