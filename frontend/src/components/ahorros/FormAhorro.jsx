import { useState } from 'react';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import CheckIcon from '@mui/icons-material/CheckOutlined';
import Modal from '../shared/Modal.jsx';
import { crearAhorro, actualizarAhorro, eliminarAhorro } from '../../api/ahorros.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { ACC } from '../../theme/colores.js';

const VACIO = {
  nombre: '', tipo: 'meta', objetivo: '', meses_gastos: '3',
  fecha_objetivo: '', nota: '', color_idx: null, activo: true,
};

// El tipo decide CÓMO se expresa el objetivo, no es solo una etiqueta:
//   · meta       -> monto fijo en Q ("Q4,000 para el celular")
//   · emergencia -> múltiplo del gasto mensual promedio ("3 meses")
// Por eso el formulario cambia de campo al cambiar de tipo, y el backend
// exige uno de los dos y rechaza los dos juntos.
export default function FormAhorro({ editando, tipoInicial = 'meta', onGuardado, onCerrar }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [form, setForm] = useState(editando ? {
    nombre: editando.nombre, tipo: editando.tipo,
    objetivo: editando.objetivo != null ? String(editando.objetivo) : '',
    meses_gastos: editando.meses_gastos != null ? String(editando.meses_gastos) : '3',
    fecha_objetivo: editando.fecha_objetivo || '',
    nota: editando.nota || '', color_idx: editando.color_idx ?? null,
    activo: !!editando.activo,
  } : { ...VACIO, tipo: tipoInicial,
        nombre: tipoInicial === 'emergencia' ? 'Fondo de emergencia' : '' });

  const esEmergencia = form.tipo === 'emergencia';

  const elegirColor = (idx) => setForm(f => ({ ...f, color_idx: f.color_idx === idx ? null : idx }));

  const guardar = async () => {
    const body = {
      nombre: form.nombre, tipo: form.tipo,
      objetivo: esEmergencia ? null : parseFloat(form.objetivo),
      meses_gastos: esEmergencia ? parseFloat(form.meses_gastos) : null,
      fecha_objetivo: form.fecha_objetivo || null,
      nota: form.nota, color_idx: form.color_idx, activo: form.activo,
    };
    try {
      if (editando) await actualizarAhorro(editando.id, body);
      else await crearAhorro(body);
      toast('Ahorro guardado ✓');
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  const eliminar = async () => {
    const ok = await confirmar(
      `¿Eliminar "${editando.nombre}" y su historial de aportes?\nNo se toca ninguna cuenta: ese dinero nunca se movió de lugar, solo dejaba de estar apartado.`,
      { peligro: true },
    );
    if (!ok) return;
    try {
      await eliminarAhorro(editando.id);
      toast('Ahorro eliminado ✓');
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal
      titulo={editando ? `Editar: ${editando.nombre}` : 'Nuevo ahorro'}
      onCerrar={onCerrar} onGuardar={guardar} labelGuardar="Guardar ahorro"
      extra={editando && <Button color="error" onClick={eliminar}>Eliminar</Button>}
    >
      <TextField select label="Tipo" value={form.tipo}
        onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
        <MenuItem value="meta">Meta de compra (celular, laptop…)</MenuItem>
        <MenuItem value="emergencia">Fondo de emergencia</MenuItem>
      </TextField>

      <TextField label="Nombre" required placeholder={esEmergencia ? 'ej. Fondo de emergencia' : 'ej. Celular'}
        value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />

      {esEmergencia ? (
        <TextField label="Meses de gastos" type="number" required
          inputProps={{ step: 0.5, min: 0.5 }}
          helperText="El objetivo se calcula con tu gasto promedio real y se ajusta solo si cambia"
          value={form.meses_gastos}
          onChange={e => setForm(f => ({ ...f, meses_gastos: e.target.value }))} />
      ) : (
        <TextField label="Objetivo (Q)" type="number" required
          inputProps={{ step: 0.01, min: 0.01 }}
          value={form.objetivo}
          onChange={e => setForm(f => ({ ...f, objetivo: e.target.value }))} />
      )}

      {/* slotProps.inputLabel.shrink es OBLIGATORIO en los type="date" de este
          proyecto: sin él, MUI v9 deja la etiqueta flotando encima del
          "dd/mm/aaaa" del input nativo y el campo se vuelve ilegible. Mismo
          arreglo que FormPrestamo/FormVisacuota/ModalEditarMovimiento. */}
      <TextField label="Fecha objetivo" type="date"
        slotProps={{ inputLabel: { shrink: true } }}
        helperText="Opcional. Con fecha, la app calcula cuánto apartar por mes"
        value={form.fecha_objetivo}
        onChange={e => setForm(f => ({ ...f, fecha_objetivo: e.target.value }))} />

      <TextField label="Nota" multiline minRows={2} placeholder="Opcional"
        value={form.nota} onChange={e => setForm(f => ({ ...f, nota: e.target.value }))} />

      <div className="flex flex-col gap-1.5">
        <span className="antetitulo">Color</span>
        <div className="flex items-center gap-2">
          {ACC.map((color, idx) => (
            <button
              key={color} type="button" onClick={() => elegirColor(idx)}
              aria-label={`Elegir color ${idx + 1}`} aria-pressed={form.color_idx === idx}
              style={{
                width: 28, height: 28, borderRadius: 8, background: color, cursor: 'pointer',
                border: form.color_idx === idx ? '2px solid var(--texto)' : '2px solid transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              {form.color_idx === idx && <CheckIcon sx={{ fontSize: 16, color: '#fff' }} />}
            </button>
          ))}
        </div>
      </div>

      <FormControlLabel
        control={<Checkbox checked={form.activo}
          onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />}
        label="Activo"
      />
    </Modal>
  );
}
