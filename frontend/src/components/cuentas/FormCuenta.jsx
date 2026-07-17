import { useState } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import Modal from '../shared/Modal.jsx';
import { crearCuenta, actualizarCuenta, eliminarCuenta } from '../../api/cuentas.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';

const VACIO = { banco: '', nombre: '', tipo: 'Monetaria', saldo_inicial: '0', activa: true };

// Modal (no panel embebido) para que "agregar/editar cuenta" resalte de
// verdad en vez de empujar el resto del layout — mismo patrón que
// ModalEditarMovimiento.jsx.
export default function FormCuenta({ editando, onGuardado, onCerrar }) {
  const { refetch } = useCatalog();
  const toast = useToast();
  const confirmar = useConfirm();
  const [form, setForm] = useState(editando ? {
    banco: editando.banco, nombre: editando.nombre, tipo: editando.tipo,
    saldo_inicial: String(editando.saldo_inicial), activa: !!editando.activa,
  } : VACIO);

  const guardar = async () => {
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

  const eliminar = async () => {
    const ok = await confirmar(
      `¿Eliminar la cuenta "${editando.nombre}" definitivamente?\nLos movimientos ya registrados con esta cuenta NO se borran, solo quedan sin cuenta asociada.`,
      { peligro: true },
    );
    if (!ok) return;
    try {
      await eliminarCuenta(editando.id);
      toast('Cuenta eliminada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal
      titulo={editando ? `Editar: ${editando.nombre}` : 'Nueva cuenta'}
      onCerrar={onCerrar}
      onGuardar={guardar}
      labelGuardar="Guardar cuenta"
      extra={editando && <Button color="error" onClick={eliminar}>Eliminar cuenta</Button>}
    >
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
    </Modal>
  );
}
