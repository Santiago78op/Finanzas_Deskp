import { useState } from 'react';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Modal from '../shared/Modal.jsx';
import { crearPrestamo, actualizarPrestamo, eliminarPrestamo } from '../../api/prestamos.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';

const VACIO = {
  nombre: '', institucion: '', monto_original: '', saldo_inicial: '0', cuota_mensual: '',
  tasa_interes: '', dia_pago: '', fecha_inicio: '', activo: true,
};

// Modal create/edit/delete — mirror exacto de FormTarjeta.jsx/FormCuenta.jsx.
export default function FormPrestamo({ editando, onGuardado, onCerrar }) {
  const { refetch, tarjetas, cuentas } = useCatalog();
  const bancos = [...new Set([...tarjetas.map(t => t.banco), ...cuentas.map(c => c.banco)])];
  const toast = useToast();
  const confirmar = useConfirm();
  const [form, setForm] = useState(editando ? {
    nombre: editando.nombre, institucion: editando.institucion,
    monto_original: String(editando.monto_original), saldo_inicial: String(editando.saldo_inicial),
    cuota_mensual: String(editando.cuota_mensual),
    tasa_interes: editando.tasa_interes != null ? String(editando.tasa_interes) : '',
    dia_pago: editando.dia_pago != null ? String(editando.dia_pago) : '',
    fecha_inicio: editando.fecha_inicio || '', activo: !!editando.activo,
  } : VACIO);

  const guardar = async () => {
    const body = {
      nombre: form.nombre, institucion: form.institucion,
      monto_original: parseFloat(form.monto_original), saldo_inicial: parseFloat(form.saldo_inicial || 0),
      cuota_mensual: parseFloat(form.cuota_mensual),
      tasa_interes: form.tasa_interes ? parseFloat(form.tasa_interes) : null,
      dia_pago: form.dia_pago ? parseInt(form.dia_pago) : null,
      fecha_inicio: form.fecha_inicio || null, activo: form.activo,
    };
    try {
      if (editando) await actualizarPrestamo(editando.id, body);
      else await crearPrestamo(body);
      toast('Préstamo guardado ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  const eliminar = async () => {
    const ok = await confirmar(
      `¿Eliminar el préstamo "${editando.nombre}" definitivamente?\nSi ya tiene pagos registrados, la app te va a pedir que lo desactivés en su lugar.`,
      { peligro: true },
    );
    if (!ok) return;
    try {
      await eliminarPrestamo(editando.id);
      toast('Préstamo eliminado ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal
      titulo={editando ? `Editar: ${editando.nombre}` : 'Nuevo préstamo'}
      onCerrar={onCerrar}
      onGuardar={guardar}
      labelGuardar="Guardar préstamo"
      extra={editando && <Button color="error" onClick={eliminar}>Eliminar préstamo</Button>}
    >
      <TextField label="Nombre" placeholder="ej. Préstamo personal BAM" required
        value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
      <Autocomplete
        freeSolo options={bancos} value={form.institucion}
        onInputChange={(_, valor) => setForm(f => ({ ...f, institucion: valor }))}
        renderInput={(params) => <TextField {...params} label="Institución" placeholder="ej. BAM" required />}
      />
      <TextField label="Monto original (Q)" type="number" inputProps={{ step: 0.01, min: 0.01 }} required
        value={form.monto_original} onChange={e => setForm(f => ({ ...f, monto_original: e.target.value }))} />
      <TextField label="Saldo pendiente hoy (Q)" type="number" inputProps={{ step: 0.01, min: 0 }}
        helperText="Lo que aún debés, no el monto original"
        value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
      <TextField label="Cuota mensual (Q)" type="number" inputProps={{ step: 0.01, min: 0.01 }} required
        value={form.cuota_mensual} onChange={e => setForm(f => ({ ...f, cuota_mensual: e.target.value }))} />
      <TextField label="Tasa de interés anual (%)" type="number" inputProps={{ step: 0.01, min: 0 }}
        helperText="Opcional"
        value={form.tasa_interes} onChange={e => setForm(f => ({ ...f, tasa_interes: e.target.value }))} />
      <TextField label="Día de pago" type="number" inputProps={{ min: 1, max: 31 }}
        helperText="Opcional"
        value={form.dia_pago} onChange={e => setForm(f => ({ ...f, dia_pago: e.target.value }))} />
      <TextField label="Fecha de inicio" type="date" InputLabelProps={{ shrink: true }}
        helperText="Opcional"
        value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
      <FormControlLabel
        control={<Checkbox checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />}
        label="Activo"
      />
    </Modal>
  );
}
