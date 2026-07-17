import { useRef } from 'react';
import CalendarTodayOutlined from '@mui/icons-material/CalendarTodayOutlined';
import { fmtFechaChip } from '../../utils.js';
import { campoBase } from './campoStyles.js';

// Campo Fecha con el look de FinanzasQ.dc.html ("Hoy · 16 jul 2026" en vez
// del formato crudo del <input type="date"> nativo). El input real sigue
// existiendo para el valor/onChange y la accesibilidad, pero con
// pointer-events:none — clickear el chip llama showPicker() a mano, porque
// con el input invisible cubriendo todo el campo el navegador solo abre el
// calendario si el click cae justo sobre su icono nativo (también oculto),
// no en cualquier parte del texto. showPicker() abre el picker sin importar
// dónde se haga click, y el ícono visible avisa que el campo es editable.
export default function CampoFecha({ value, onChange, style }) {
  const ref = useRef(null);

  const abrir = () => {
    if (ref.current?.showPicker) ref.current.showPicker();
    else ref.current?.focus();
  };

  return (
    <div
      onClick={abrir}
      style={{
        ...campoBase, position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 8, cursor: 'pointer', ...style,
      }}
    >
      <span style={{ pointerEvents: 'none' }}>{fmtFechaChip(value)}</span>
      <CalendarTodayOutlined sx={{ fontSize: 16, color: 'var(--suave)', pointerEvents: 'none' }} />
      <input
        ref={ref}
        type="date" required aria-label="Fecha" value={value}
        onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  );
}
