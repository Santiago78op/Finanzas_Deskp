import { useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';

const VACIO = { banco: '', nombre: '', limite: '', dia_corte: '', dia_pago: '', saldo_inicial: '0', activa: true };

export default function FormTarjeta({ editando, onGuardado, onCancelar }) {
  const { refetch } = useCatalog();
  const toast = useToast();
  const [form, setForm] = useState(VACIO);

  useEffect(() => {
    setForm(editando ? {
      banco: editando.banco, nombre: editando.nombre, limite: String(editando.limite),
      dia_corte: String(editando.dia_corte), dia_pago: String(editando.dia_pago),
      saldo_inicial: String(editando.saldo_inicial), activa: !!editando.activa,
    } : VACIO);
  }, [editando]);

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      banco: form.banco, nombre: form.nombre, limite: parseFloat(form.limite),
      dia_corte: parseInt(form.dia_corte), dia_pago: parseInt(form.dia_pago),
      saldo_inicial: parseFloat(form.saldo_inicial || 0), activa: form.activa,
    };
    try {
      if (editando) await api(`/api/tarjetas/${editando.id}`, { method: 'PUT', body });
      else await api('/api/tarjetas', { method: 'POST', body });
      toast('Tarjeta guardada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card className="p-4 flex flex-col gap-4">
      <Typography variant="h6">{editando ? `Editar: ${editando.nombre}` : 'Nueva tarjeta'}</Typography>
      <form className="grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={submit}>
        <TextField label="Banco" placeholder="ej. BI" required
          value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
        <TextField label="Nombre único" placeholder="ej. Visa BI" required
          value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
        <TextField label="Límite (Q)" type="number" inputProps={{ step: 0.01, min: 0.01 }} required
          value={form.limite} onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} />
        <TextField label="Día de corte" type="number" inputProps={{ min: 1, max: 31 }} required
          value={form.dia_corte} onChange={e => setForm(f => ({ ...f, dia_corte: e.target.value }))} />
        <TextField label="Día de pago" type="number" inputProps={{ min: 1, max: 31 }} required
          value={form.dia_pago} onChange={e => setForm(f => ({ ...f, dia_pago: e.target.value }))} />
        <TextField label="Saldo pendiente hoy (Q)" type="number" inputProps={{ step: 0.01, min: 0 }}
          helperText="Opcional, deuda que ya traés (puede ser 0)"
          value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
        <FormControlLabel
          control={<Checkbox checked={form.activa} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} />}
          label="Activa"
        />
        <Stack direction="row" gap={1} className="sm:col-span-2">
          <Button type="submit" variant="contained">Guardar tarjeta</Button>
          {editando && <Button type="button" variant="outlined" size="small" onClick={onCancelar}>Cancelar edición</Button>}
        </Stack>
      </form>
    </Card>
  );
}
