import { useState } from 'react';
import TextField from '@mui/material/TextField';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import Modal from '../shared/Modal.jsx';
import { crearTarjeta, actualizarTarjeta, eliminarTarjeta } from '../../api/tarjetas.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { useCatalog } from '../../context/CatalogContext.jsx';
import { ACC } from '../../theme/colores.js';

const VACIO = { banco: '', nombre: '', limite: '', dia_corte: '', dia_pago: '', saldo_inicial: '0', activa: true, color_idx: null };

// Modal (no panel embebido) para que "agregar/editar tarjeta" resalte de
// verdad en vez de empujar el resto del layout — mismo patrón que
// FormCuenta.jsx / ModalEditarMovimiento.jsx.
export default function FormTarjeta({ editando, onGuardado, onCerrar }) {
  const { refetch } = useCatalog();
  const toast = useToast();
  const confirmar = useConfirm();
  const [form, setForm] = useState(editando ? {
    banco: editando.banco, nombre: editando.nombre, limite: String(editando.limite),
    dia_corte: String(editando.dia_corte), dia_pago: String(editando.dia_pago),
    saldo_inicial: String(editando.saldo_inicial), activa: !!editando.activa,
    color_idx: editando.color_idx ?? null,
  } : VACIO);

  const elegirColor = (idx) => setForm(f => ({ ...f, color_idx: f.color_idx === idx ? null : idx }));

  const guardar = async () => {
    const body = {
      banco: form.banco, nombre: form.nombre, limite: parseFloat(form.limite),
      dia_corte: parseInt(form.dia_corte), dia_pago: parseInt(form.dia_pago),
      saldo_inicial: parseFloat(form.saldo_inicial || 0), activa: form.activa,
      color_idx: form.color_idx,
    };
    try {
      if (editando) await actualizarTarjeta(editando.id, body);
      else await crearTarjeta(body);
      toast('Tarjeta guardada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  const eliminar = async () => {
    const ok = await confirmar(
      `¿Eliminar la tarjeta "${editando.nombre}" definitivamente?\nLos gastos ya registrados con esta tarjeta NO se borran, solo quedan sin tarjeta asociada.`,
      { peligro: true },
    );
    if (!ok) return;
    try {
      await eliminarTarjeta(editando.id);
      toast('Tarjeta eliminada ✓');
      await refetch();
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal
      titulo={editando ? `Editar: ${editando.nombre}` : 'Nueva tarjeta'}
      onCerrar={onCerrar}
      onGuardar={guardar}
      labelGuardar="Guardar tarjeta"
      extra={editando && <Button color="error" onClick={eliminar}>Eliminar tarjeta</Button>}
    >
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

      <div className="flex flex-col gap-1.5">
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--suave)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Color de la tarjeta
        </span>
        <div className="flex items-center gap-2">
          {ACC.map((color, idx) => (
            <button
              key={color} type="button" onClick={() => elegirColor(idx)}
              aria-label={`Elegir color ${idx + 1}`} aria-pressed={form.color_idx === idx}
              style={{
                width: 28, height: 28, borderRadius: 999, background: color, cursor: 'pointer',
                border: form.color_idx === idx ? '2px solid var(--texto)' : '2px solid transparent',
                outlineOffset: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {form.color_idx === idx && <CheckIcon sx={{ fontSize: 16, color: '#201004' }} />}
            </button>
          ))}
        </div>
      </div>

      <FormControlLabel
        control={<Checkbox checked={form.activa} onChange={e => setForm(f => ({ ...f, activa: e.target.checked }))} />}
        label="Activa"
      />
    </Modal>
  );
}
