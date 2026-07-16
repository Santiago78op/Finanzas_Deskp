import { useState } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useCatalog } from '../../context/CatalogContext.jsx';

export default function FiltrosMovimientos({ onFiltrar }) {
  const { catGasto, catIngreso, metodos } = useCatalog();
  const [mes, setMes] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [metodoVal, setMetodoVal] = useState('');

  const aplicar = (e) => {
    e?.preventDefault();
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
    <Stack component="form" aria-label="Filtrar movimientos" onSubmit={aplicar}
      direction="row" sx={{ flexWrap: 'wrap', gap: 2 }} className="items-center mb-3">
      <TextField type="month" value={mes} onChange={e => setMes(e.target.value)} />
      <TextField select label="Categoría" value={categoriaId} onChange={e => setCategoriaId(e.target.value)}
        className="!min-w-[220px]">
        <MenuItem value="">Todas las categorías</MenuItem>
        {[...catGasto, ...catIngreso].map(c => (
          <MenuItem key={`${c.tipo}-${c.id}`} value={c.id}>{c.nombre} ({c.tipo})</MenuItem>
        ))}
      </TextField>
      <TextField select label="Método" value={metodoVal} onChange={e => setMetodoVal(e.target.value)}
        className="!min-w-[200px]">
        <MenuItem value="">Todos los métodos</MenuItem>
        {metodos.map(m => {
          const val = m.tarjeta_id ? `Tarjeta:${m.tarjeta_id}` : m.metodo;
          return <MenuItem key={val} value={val}>{m.etiqueta}</MenuItem>;
        })}
      </TextField>
      <Button type="submit" variant="contained">Filtrar</Button>
    </Stack>
  );
}
