import { useState } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Modal from '../shared/Modal.jsx';
import { crearVisacuota, actualizarVisacuota, eliminarVisacuota } from '../../api/visacuotas.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { hoyISO } from '../../utils.js';

const vacio = (tarjetas) => ({
  descripcion: '', tarjeta_id: tarjetas[0]?.id ?? '', monto_total: '', num_cuotas: '', cuota_mensual: '',
  fecha_inicio: hoyISO(), dia_pago: '', activo: true,
});

// Modal create/edit/delete — mismo patrón que FormPrestamo.jsx. La tarjeta
// es obligatoria: una Visa Cuotas siempre está atada a la tarjeta donde se
// difirió la compra (no existe "Visa Cuotas suelta" sin tarjeta).
export default function FormVisacuota({ editando, onGuardado, onCerrar }) {
  const { tarjetas, refetch } = useCatalog();
  const toast = useToast();
  const confirmar = useConfirm();
  const [form, setForm] = useState(editando ? {
    descripcion: editando.descripcion, tarjeta_id: editando.tarjeta_id,
    monto_total: String(editando.monto_total), num_cuotas: String(editando.num_cuotas),
    cuota_mensual: String(editando.cuota_mensual), fecha_inicio: editando.fecha_inicio,
    dia_pago: editando.dia_pago != null ? String(editando.dia_pago) : '', activo: !!editando.activo,
  } : vacio(tarjetas));

  const guardar = async () => {
    const body = {
      descripcion: form.descripcion, tarjeta_id: parseInt(form.tarjeta_id),
      monto_total: parseFloat(form.monto_total), num_cuotas: parseInt(form.num_cuotas),
      cuota_mensual: parseFloat(form.cuota_mensual), fecha_inicio: form.fecha_inicio,
      dia_pago: form.dia_pago ? parseInt(form.dia_pago) : null, activo: form.activo,
    };
    try {
      if (editando) await actualizarVisacuota(editando.id, body);
      else await crearVisacuota(body);
      toast('Visa Cuotas guardada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  const eliminar = async () => {
    const ok = await confirmar(
      `¿Eliminar "${editando.descripcion}" definitivamente?\nSi ya tiene pagos registrados, la app te va a pedir que la desactivés en su lugar.`,
      { peligro: true },
    );
    if (!ok) return;
    try {
      await eliminarVisacuota(editando.id);
      toast('Visa Cuotas eliminada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal
      titulo={editando ? `Editar: ${editando.descripcion}` : 'Nueva Visa Cuotas'}
      onCerrar={onCerrar}
      onGuardar={guardar}
      labelGuardar="Guardar cuota"
      extra={editando && <Button color="error" onClick={eliminar}>Eliminar</Button>}
    >
      <TextField label="Descripción" placeholder="ej. Laptop HP" required
        value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
      <TextField select label="Tarjeta" required value={form.tarjeta_id}
        onChange={e => setForm(f => ({ ...f, tarjeta_id: e.target.value }))}>
        {tarjetas.map(t => <MenuItem key={t.id} value={t.id}>{t.nombre}</MenuItem>)}
      </TextField>
      <TextField label="Monto total (Q)" type="number" inputProps={{ step: 0.01, min: 0.01 }} required
        value={form.monto_total} onChange={e => setForm(f => ({ ...f, monto_total: e.target.value }))} />
      <TextField label="Número de cuotas" type="number" inputProps={{ min: 1 }} required
        value={form.num_cuotas} onChange={e => setForm(f => ({ ...f, num_cuotas: e.target.value }))} />
      <TextField label="Cuota mensual (Q)" type="number" inputProps={{ step: 0.01, min: 0.01 }} required
        value={form.cuota_mensual} onChange={e => setForm(f => ({ ...f, cuota_mensual: e.target.value }))} />
      <TextField label="Fecha de inicio" type="date" InputLabelProps={{ shrink: true }} required
        value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
      <TextField label="Día de pago" type="number" inputProps={{ min: 1, max: 31 }}
        helperText="Opcional"
        value={form.dia_pago} onChange={e => setForm(f => ({ ...f, dia_pago: e.target.value }))} />
      <FormControlLabel
        control={<Checkbox checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />}
        label="Activa"
      />
    </Modal>
  );
}
