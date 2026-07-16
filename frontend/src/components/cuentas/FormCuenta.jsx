import { useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { crearCuenta, actualizarCuenta } from '../../api/cuentas.js';
import { useToast } from '../shared/Toast.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';

const VACIO = { banco: '', nombre: '', tipo: 'Monetaria', saldo_inicial: '0', activa: true };

export default function FormCuenta({ editando, onGuardado, onCancelar }) {
  const { refetch } = useCatalog();
  const toast = useToast();
  const [form, setForm] = useState(VACIO);

  useEffect(() => {
    setForm(editando ? {
      banco: editando.banco, nombre: editando.nombre, tipo: editando.tipo,
      saldo_inicial: String(editando.saldo_inicial), activa: !!editando.activa,
    } : VACIO);
  }, [editando]);

  const submit = async (e) => {
    e.preventDefault();
    const body = {
      banco: form.banco, nombre: form.nombre, tipo: form.tipo,
      saldo_inicial: parseFloat(form.saldo_inicial || 0), activa: form.activa,
    };
    try {
      if (editando) await actualizarCuenta(editando.id, body);
      else await crearCuenta(body);
      toast('Cuenta guardada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card component="section" aria-labelledby="sec-form-cuenta" className="p-4 flex flex-col gap-4">
      <Typography id="sec-form-cuenta" variant="h6">{editando ? `Editar: ${editando.nombre}` : 'Nueva cuenta (Monetaria / Ahorro)'}</Typography>
      <form className="grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={submit}>
        <TextField label="Banco" placeholder="ej. BI" required
          value={form.banco} onChange={e => setForm(f => ({ ...f, banco: e.target.value }))} />
        <TextField label="Nombre único" placeholder="ej. Monetaria BI" required
          value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
        <TextField select label="Tipo" value={form.tipo}
          onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
          <MenuItem value="Monetaria">Monetaria</MenuItem>
          <MenuItem value="Ahorro">Ahorro</MenuItem>
        </TextField>
        <TextField label="Saldo actual (Q)" type="number" inputProps={{ step: 0.01, min: 0 }}
          helperText="Opcional, lo que tenés hoy"
          value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
        <FormControlLabel
          control={<Checkbox checked={form.activa} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} />}
          label="Activa"
        />
        <Stack direction="row" sx={{ gap: 1 }} className="sm:col-span-2">
          <Button type="submit" variant="contained">Guardar cuenta</Button>
          {onCancelar && <Button type="button" variant="outlined" size="small" onClick={onCancelar}>{editando ? 'Cancelar edición' : 'Cancelar'}</Button>}
        </Stack>
      </form>
    </Card>
  );
}
