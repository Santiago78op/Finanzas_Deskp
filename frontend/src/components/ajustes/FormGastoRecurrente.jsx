import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { getGastosRecurrentes, crearGastoRecurrente, actualizarGastoRecurrente, eliminarGastoRecurrente } from '../../api/gastosRecurrentes.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { fmtQ } from '../../utils.js';
import CamposFrecuencia, { camposParaLaApi, describirFrecuencia } from './CamposFrecuencia.jsx';
import { filaAcciones, filaItem } from './ajustes.styles.js';

const VACIO = {
  descripcion: '', categoria_id: '', frecuencia: 'Mensual', monto: '', dia_mes: '', dia_mes_2: '',
  mes_1: '', mes_2: '', metodo: '', cuenta_id: '', activo: true,
};

export default function FormGastoRecurrente({ onCambio }) {
  const { catGasto, metodos, cuentas } = useCatalog();
  const toast = useToast();
  const confirmar = useConfirm();
  const [recs, setRecs] = useState([]);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(VACIO);

  const cargar = useCallback(async () => setRecs(await getGastosRecurrentes()), []);
  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (editando) {
      setForm({
        descripcion: editando.descripcion, categoria_id: String(editando.categoria_id),
        frecuencia: editando.frecuencia || 'Mensual', monto: String(editando.monto),
        dia_mes: String(editando.dia_mes), dia_mes_2: editando.dia_mes_2 ? String(editando.dia_mes_2) : '',
        mes_1: editando.mes_1 ? String(editando.mes_1) : '',
        mes_2: editando.mes_2 ? String(editando.mes_2) : '',
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
  const dosPagosAnuales = form.frecuencia === 'Anual' && !!form.mes_2;
  const usaCuenta = (form.metodo === 'Débito' || form.metodo === 'Transferencia') && cuentas.length > 0;

  const submit = async (e) => {
    e.preventDefault();
    const esTarjeta = form.metodo.startsWith('Tarjeta:');
    const body = {
      descripcion: form.descripcion, categoria_id: parseInt(form.categoria_id),
      monto: parseFloat(form.monto), dia_mes: parseInt(form.dia_mes),
      frecuencia: form.frecuencia,
      ...camposParaLaApi(form),
      metodo: esTarjeta ? 'Tarjeta' : form.metodo,
      tarjeta_id: esTarjeta ? parseInt(form.metodo.split(':')[1]) : null,
      cuenta_id: form.cuenta_id ? parseInt(form.cuenta_id) : null,
      activo: form.activo,
    };
    try {
      if (editando) await actualizarGastoRecurrente(editando.id, body);
      else await crearGastoRecurrente(body);
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
      await eliminarGastoRecurrente(r.id);
      toast('Pago frecuente eliminado ✓');
      await cargar();
      onCambio?.();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Card component="section" aria-labelledby="sec-pagos-frecuentes" className="p-5 flex flex-col gap-4">
      <Typography id="sec-pagos-frecuentes" variant="h6">{editando ? `Editar pago frecuente: ${editando.descripcion}` : 'Pagos frecuentes (renta, internet, colegio...)'}</Typography>
      <Typography variant="body2" className="text-[var(--suave)]">La app te pedirá confirmar cada pago en su fecha y creará el gasto con el método configurado.</Typography>
      <form className="grid gap-3 sm:grid-cols-2" autoComplete="off" onSubmit={submit}>
        <TextField label="Descripción" placeholder="ej. Renta" required
          value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
        <TextField select label="Categoría" value={form.categoria_id}
          onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
          {catGasto.map(c => <MenuItem key={c.id} value={c.id}>{c.nombre}</MenuItem>)}
        </TextField>
        <CamposFrecuencia
          valores={form}
          alCambiar={(campo, valor) => setForm(f => ({ ...f, [campo]: valor }))}
          etiquetaAnual="Anual (seguro, impuesto, colegiatura)"
        />
        <TextField
          label={esQuincenal ? 'Monto por quincena (Q)' : dosPagosAnuales ? 'Monto por pago (Q)' : 'Monto (Q)'}
          type="number" inputProps={{ step: 0.01, min: 0.01 }} required
          helperText={dosPagosAnuales ? 'Lo de cada pago, no el total del año' : undefined}
          value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
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
        <Stack direction="row" sx={filaAcciones} className="sm:col-span-2">
          <Button type="submit" variant="contained">Guardar pago frecuente</Button>
          {editando && <Button type="button" variant="outlined" onClick={() => setEditando(null)}>Cancelar edición</Button>}
        </Stack>
      </form>

      {!recs.length && <Typography variant="body2" className="text-[var(--suave)]">Sin pagos frecuentes configurados todavía.</Typography>}
      <div className="flex flex-col" style={{ maxHeight: 340, overflowY: 'auto' }}>
        {recs.map(r => (
          <Stack direction="row" sx={filaItem} key={r.id} className="border-t border-[var(--borde)] pt-2 pb-2">
            <span className={r.activo ? '' : 'opacity-50'}>
              <b>{r.descripcion}</b> ({r.categoria}) —{' '}
              {describirFrecuencia(r, fmtQ)}
              {' · '}{r.metodo === 'Tarjeta' ? r.tarjeta : r.metodo}{r.cuenta ? ` (${r.cuenta})` : ''}
            </span>
            <Stack direction="row" sx={filaAcciones}>
              <Button size="small" variant="outlined" onClick={() => setEditando(r)}>Editar</Button>
              <Button size="small" variant="outlined" color="error" onClick={() => borrar(r)}>Eliminar</Button>
            </Stack>
          </Stack>
        ))}
      </div>
    </Card>
  );
}
