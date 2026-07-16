import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getCategorias, crearCategoria, renombrarCategoria, toggleCategoria } from '../../api/categorias.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { filaAcciones, filaItem } from './ajustes.styles.js';

export default function CategoriaManager() {
  const { refetch } = useCatalog();
  const toast = useToast();
  const [cats, setCats] = useState([]);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('gasto');

  const cargar = useCallback(async () => setCats(await getCategorias({ incluirInactivas: true })), []);
  useEffect(() => { cargar(); }, [cargar]);

  const agregar = async (e) => {
    e.preventDefault();
    try {
      await crearCategoria({ nombre, tipo });
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
      await renombrarCategoria(c.id, nuevo);
      toast('Categoría renombrada ✓');
      await refetch();
      await cargar();
    } catch (err) { toast(err.message, true); }
  };

  const toggle = async (c) => {
    try {
      await toggleCategoria(c.id, !c.activa);
      toast('Categoría actualizada ✓');
      await refetch();
      await cargar();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card component="section" aria-labelledby="sec-categorias" className="p-4 flex flex-col gap-4">
      <Typography id="sec-categorias" variant="h6">Categorías</Typography>
      <Stack component="form" direction="row" sx={filaAcciones} autoComplete="off" onSubmit={agregar}>
        <TextField label="Nueva categoría" required value={nombre} onChange={e => setNombre(e.target.value)} />
        <TextField select label="Tipo" value={tipo} onChange={e => setTipo(e.target.value)}>
          <MenuItem value="gasto">Gasto</MenuItem>
          <MenuItem value="ingreso">Ingreso</MenuItem>
        </TextField>
        <Button type="submit" variant="outlined" size="small">Agregar</Button>
      </Stack>
      {cats.map(c => (
        <Stack direction="row" sx={filaItem} key={c.id} className="border-t border-[var(--borde)] pt-2">
          <span className={c.activa ? '' : 'opacity-50'}>{c.nombre} <small>({c.tipo})</small></span>
          <Stack direction="row" sx={filaAcciones}>
            <Button size="small" variant="outlined" onClick={() => renombrar(c)}>Renombrar</Button>
            <Button size="small" variant="outlined" onClick={() => toggle(c)}>{c.activa ? 'Desactivar' : 'Activar'}</Button>
          </Stack>
        </Stack>
      ))}
    </Card>
  );
}
