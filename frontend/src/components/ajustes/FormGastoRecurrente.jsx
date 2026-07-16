import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { api } from '../../api.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { fmtQ } from '../../utils.js';

const VACIO = {
  descripcion: '', categoria_id: '', frecuencia: 'Mensual', monto: '', dia_mes: '', dia_mes_2: '',
  metodo: '', cuenta_id: '', activo: true,
};

export default function FormGastoRecurrente({ onCambio }) {
  const { catGasto, metodos, cuentas } = useCatalog();
  const toast = useToast();
  const confirmar = useConfirm();
  const [recs, setRecs] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  const cargar = useCallback(async () => setRecs(await api('/api/gastos_recurrentes')), []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (editando) {
      setForm({
        descripcion: editando.descripcion, categoria_id: String(editando.categoria_id),
        frecuencia: editando.frecuencia || 'Mensual', monto: String(editando.monto),
        dia_mes: String(editando.dia_mes), dia_mes_2: editando.dia_mes_2 ? String(editando.dia_mes_2) : '',
        metodo: editando.metodo === 'Tarjeta' ? `Tarjeta:${editando.tarjeta_id}` : editando.metodo,
        cuenta_id: editando.cuenta_id ? String(editando.cuenta_id) : '',
        activo: !!editando.activo,
      });
    } else {
      const primerMetodo = metodos[0] ? (metodos[0].tarjeta_id ? `Tarjeta:${metodos[0].tarjeta_id}` : metodos[0].metodo) : '';
      setForm({ ...VACIO, categoria_id: catGasto[0] ? String(catGasto[0].id) : '', metodo: primerMetodo });
    }
  }, [editando, catGasto, metodos]);

  const esQuincenal = form.frecuencia === 'Quincenal';
  const usaCuenta = (form.metodo === 'Débito' || form.metodo === 'Transferencia') && cuentas.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    const esTarjeta = form.metodo.startsWith('Tarjeta:');
    const body = {
      descripcion: form.descripcion, categoria_id: parseInt(form.categoria_id),
      monto: parseFloat(form.monto), dia_mes: parseInt(form.dia_mes),
      frecuencia: form.frecuencia,
      dia_mes_2: esQuincenal ? parseInt(form.dia_mes_2) : null,
      metodo: esTarjeta ? 'Tarjeta' : form.metodo,
      tarjeta_id: esTarjeta ? parseInt(form.metodo.split(':')[1]) : null,
      cuenta_id: form.cuenta_id ? parseInt(form.cuenta_id) : null,
      activo: form.activo,
    };
    try {
      if (editando) await api(`/api/gastos_recurrentes/${editando.id}`, { method: 'PUT', body });
      else await api('/api/gastos_recurrentes', { method: 'POST', body });
      toast('Pago frecuente guardado ✓');
      setEditando(null);
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  const borrar = async (r) => {
    const ok = await confirmar(
      `¿Eliminar el pago frecuente "${r.descripcion}" definitivamente?\nLos gastos ya registrados en Movimientos NO se borran.`,
      { peligro: true },
    );
    if (!ok) return;
    try {
      await api(`/api/gastos_recurrentes/${r.id}`, { method: 'DELETE' });
      toast('Pago frecuente eliminado ✓');
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card component="section" aria-labelledby="sec-pagos-frecuentes" className="p-4 flex flex-col gap-4">
      <Typography id="sec-pagos-frecuentes" variant="h6">{editando ? `Editar pago frecuente: ${editando.descripcion}` : 'Pagos frecuentes (renta, internet, colegio...)'}</Typography>
      <Typography variant="body2" className="text-[var(--suave)]">La app te pedirá confirmar cada pago en su fecha y creará el gasto con el método configurado.</Typography>
      <form className="grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={submit}>
        <TextField label="Descripción" placeholder="ej. Renta" required
          value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
        <TextField select label="Categoría" value={form.categoria_id}
          onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
          {catGasto.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
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
            title="El primer día de pago ya lo pusiste arriba — acá va la segunda fecha del mes (ej. si pagás los 15 y los 30, acá va 30)."
            value={form.dia_mes_2} onChange={e => setForm(f => ({ ...f, dia_mes_2: e.target.value }))}
          />
        )}
        <TextField select label="Método de pago" value={form.metodo}
          onChange={e => setForm(f => ({ ...f, metodo: e.target.value }))}>
          {metodos.map(m => {
            const val = m.tarjeta_id ? `Tarjeta:${m.tarjeta_id}` : m.metodo;
            return <MenuItem key={val} value={val}>{m.etiqueta}</MenuItem>;
          })}
        </TextField>
        {usaCuenta && (
          <TextField select label="Cuenta de la que sale" value={form.cuenta_id}
            onChange={e => setForm(f => ({ ...f, cuenta_id: e.target.value }))}>
            <MenuItem value="">Sin cuenta</MenuItem>
            {cuentas.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
          </TextField>
        )}
        <FormControlLabel
          control={<Checkbox checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />}
          label="Activo"
        />
        <Stack direction="row" sx={{ gap: 1 }} className="sm:col-span-2">
          <Button type="submit" variant="contained">Guardar pago frecuente</Button>
          {editando && <Button type="button" variant="outlined" onClick={() => setEditando(null)}>Cancelar edición</Button>}
        </Stack>
      </form>

      {!recs.length && <Typography variant="body2" className="text-[var(--suave)]">Sin pagos frecuentes configurados todavía.</Typography>}
      {recs.map(r => (
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }} key={r.id} className="border-t border-[var(--borde)] pt-2">
          <span className={r.activo ? '' : 'opacity-50'}>
            <b>{r.descripcion}</b> ({r.categoria}) —{' '}
            {r.frecuencia === 'Quincenal'
              ? `${fmtQ(r.monto)} por quincena, los días ${r.dia_mes} y ${r.dia_mes_2}`
              : `${fmtQ(r.monto)} el día ${r.dia_mes}`}
            {' · '}{r.metodo === 'Tarjeta' ? r.tarjeta : r.metodo}{r.cuenta ? ` (${r.cuenta})` : ''}
          </span>
          <Stack direction="row" sx={{ gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => setEditando(r)}>Editar</Button>
            <Button size="small" variant="outlined" color="error" onClick={() => borrar(r)}>Eliminar</Button>
          </Stack>
        </Stack>
      ))}
    </Card>
  );
}
