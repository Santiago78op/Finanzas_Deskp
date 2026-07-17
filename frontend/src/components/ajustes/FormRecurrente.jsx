import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getRecurrentes, crearRecurrente, actualizarRecurrente, eliminarRecurrente } from '../../api/recurrentes.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { fmtQ } from '../../utils.js';
import { filaAcciones, filaItem } from './ajustes.styles.js';

const VACIO = { descripcion: '', categoria_id: '', frecuencia: 'Mensual', monto: '', dia_mes: '', dia_mes_2: '', activo: true };

export default function FormRecurrente({ onCambio }) {
  const { catIngreso } = useCatalog();
  const toast = useToast();
  const confirmar = useConfirm();
  const [recs, setRecs] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  const cargar = useCallback(async () => setRecs(await getRecurrentes()), []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    setForm(editando ? {
      descripcion: editando.descripcion, categoria_id: String(editando.categoria_id),
      frecuencia: editando.frecuencia || 'Mensual', monto: String(editando.monto),
      dia_mes: String(editando.dia_mes), dia_mes_2: editando.dia_mes_2 ? String(editando.dia_mes_2) : '',
      activo: !!editando.activo,
    } : { ...VACIO, categoria_id: catIngreso[0] ? String(catIngreso[0].id) : '' });
  }, [editando, catIngreso]);

  const esQuincenal = form.frecuencia === 'Quincenal';

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      descripcion: form.descripcion, categoria_id: parseInt(form.categoria_id),
      monto: parseFloat(form.monto), dia_mes: parseInt(form.dia_mes),
      frecuencia: form.frecuencia,
      dia_mes_2: esQuincenal ? parseInt(form.dia_mes_2) : null,
      activo: form.activo,
    };
    try {
      if (editando) await actualizarRecurrente(editando.id, body);
      else await crearRecurrente(body);
      toast('Ingreso recurrente guardado ✓');
      setEditando(null);
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  const borrar = async (r) => {
    const ok = await confirmar(
      `¿Eliminar "${r.descripcion}" definitivamente?\nLos ingresos ya registrados en Movimientos NO se borran.`,
      { peligro: true },
    );
    if (!ok) return;
    try {
      await eliminarRecurrente(r.id);
      toast('Ingreso recurrente eliminado ✓');
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card component="section" aria-labelledby="sec-ingresos-recurrentes" className="p-5 flex flex-col gap-4">
      <Typography id="sec-ingresos-recurrentes" variant="h6">{editando ? `Editar: ${editando.descripcion}` : 'Ingresos recurrentes (salario)'}</Typography>
      <form className="grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={submit}>
        <TextField label="Descripción" placeholder="ej. Salario" required
          value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
        <TextField select label="Categoría" value={form.categoria_id}
          onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
          {catIngreso.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
        </TextField>
        <TextField select label="Frecuencia" value={form.frecuencia}
          onChange={e => setForm(f => ({ ...f, frecuencia: e.target.value }))}>
          <MenuItem value="Mensual">Mensual (una vez al mes)</MenuItem>
          <MenuItem value="Quincenal">Quincenal (dos veces al mes)</MenuItem>
        </TextField>
        <TextField label={esQuincenal ? 'Monto por quincena (Q)' : 'Monto (Q)'} type="number"
          inputProps={{ step: 0.01, min: 0.01 }} required
          value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
        <TextField label="Día de pago" type="number" inputProps={{ min: 1, max: 31 }} required
          value={form.dia_mes} onChange={e => setForm(f => ({ ...f, dia_mes: e.target.value }))} />
        {esQuincenal && (
          <TextField
            label="Segundo día de pago" type="number" inputProps={{ min: 1, max: 31 }} required={esQuincenal}
            title="El primer día de pago ya lo pusiste arriba — acá va la segunda fecha del mes (ej. si cobrás los 15 y los 30, acá va 30)."
            value={form.dia_mes_2} onChange={e => setForm(f => ({ ...f, dia_mes_2: e.target.value }))}
          />
        )}
        <FormControlLabel
          control={<Checkbox checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />}
          label="Activo"
        />
        <Stack direction="row" sx={filaAcciones} className="sm:col-span-2">
          <Button type="submit" variant="contained">Guardar</Button>
          {editando && <Button type="button" variant="outlined" onClick={() => setEditando(null)}>Cancelar edición</Button>}
        </Stack>
      </form>

      {!recs.length && <Typography variant="body2" className="text-[var(--suave)]">Configurá tu salario acá para que la app lo registre cada mes.</Typography>}
      {recs.map(r => (
        <Stack direction="row" sx={filaItem} key={r.id} className="border-t border-[var(--borde)] pt-2">
          <span className={r.activo ? '' : 'opacity-50'}>
            <b>{r.descripcion}</b> ({r.categoria}) —{' '}
            {r.frecuencia === 'Quincenal'
              ? `${fmtQ(r.monto)} por quincena, los días ${r.dia_mes} y ${r.dia_mes_2}`
              : `${fmtQ(r.monto)} el día ${r.dia_mes}`}
          </span>
          <Stack direction="row" sx={filaAcciones}>
            <Button size="small" variant="outlined" onClick={() => setEditando(r)}>Editar</Button>
            <Button size="small" variant="outlined" color="error" onClick={() => borrar(r)}>Eliminar</Button>
          </Stack>
        </Stack>
      ))}
    </Card>
  );
}
