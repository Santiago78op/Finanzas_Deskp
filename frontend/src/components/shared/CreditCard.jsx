import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/EditOutlined';
import { fmtQ } from '../../utils.js';
import { ACC } from '../../theme/colores.js';
import { tabularNums } from './estilos.js';

// Cara de tarjeta oscura y realista (FinanzasQ.dc.html, Claude Design): filo
// de acento 3px arriba (no fondo saturado — "no lee como tarjeta real"),
// barra de uso + Saldo usado/Límite adentro del degradado, y "Corte día N" /
// "N% usado" como fila propia debajo, AFUERA de la tarjeta (con espacio real,
// no pegada al borde — así lo separa FinanzasQ.dc.html). No hay campo de
// marca (Visa/Mastercard) ni número real en el modelo de datos: la marca se
// infiere del nombre ("Visa BI" -> VISA) y el número se enmascara con uno
// derivado del id — no se inventa un dato falso.
function marcaDe(nombre) {
  const n = (nombre || '').toLowerCase();
  if (n.includes('visa')) return 'VISA';
  if (n.includes('master')) return 'MASTERCARD';
  return null;
}

// mini (usada por el panel "¿Cuánto debo en tarjetas?" del Dashboard, sin
// onEditar): número más corto y SALDO/CORTE en vez de barra de uso +
// Saldo usado/Límite + la fila externa — así lo dibuja FinanzasQ.dc.html
// para esta vista, distinto de la tarjeta completa de la vista Tarjetas.
export default function CreditCard({ tarjeta, onEditar }) {
  const compacta = !onEditar;
  const acento = ACC[tarjeta.color_idx ?? (tarjeta.id % 6)];
  const numero = String(1000 + ((tarjeta.id * 7919) % 9000)).padStart(4, '0');
  const marca = marcaDe(tarjeta.nombre);
  const uso = Math.min(100, Math.max(0, Math.round(tarjeta.pct_uso)));

  return (
    <div style={{ width: compacta ? 260 : '100%', maxWidth: 320 }}>
      <Card component="article" className={`overflow-hidden${tarjeta.activa ? '' : ' opacity-50'}`}>
        <div
          className="relative p-4 text-white bg-gradient-to-br from-neutral-800 to-neutral-950 flex flex-col gap-5"
          style={{ borderTop: `3px solid ${acento}`, minHeight: 180 }}
        >
          <div className="flex items-start justify-between gap-2">
            <span style={{ fontSize: 12, fontWeight: 400, letterSpacing: '.05em' }}>{tarjeta.banco}{compacta ? ' · Crédito' : ''}</span>
            <div className="flex items-center gap-2">
              {!tarjeta.activa && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/15">Inactiva</span>
              )}
              {marca && <span className="font-display" style={{ fontSize: 15, letterSpacing: '.04em' }}>{marca}</span>}
            </div>
          </div>
          <div className="font-mono text-lg tracking-[0.2em]">{compacta ? `•••• ${numero}` : `•••• •••• •••• ${numero}`}</div>
          {compacta ? (
            <div className="mt-auto flex justify-between items-end gap-2 text-xs">
              <div><div className="opacity-60 uppercase tracking-wide text-[10px]">Saldo</div><div className="font-semibold" style={tabularNums}>{fmtQ(tarjeta.saldo)}</div></div>
              <div style={{ textAlign: 'right' }}><div className="opacity-60 uppercase tracking-wide text-[10px]">Corte</div><div className="font-semibold">Día {tarjeta.dia_corte}</div></div>
            </div>
          ) : (
            <div className="mt-auto flex flex-col gap-2">
              <div className="h-1.5 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${uso}%`, background: acento }} />
              </div>
              <div className="flex justify-between items-end gap-2 text-xs">
                <div><div className="opacity-60 uppercase tracking-wide text-[10px]">Saldo usado</div><div className="font-semibold" style={tabularNums}>{fmtQ(tarjeta.saldo)}</div></div>
                <div style={{ textAlign: 'right' }}><div className="opacity-60 uppercase tracking-wide text-[10px]">Límite</div><div className="font-semibold" style={tabularNums}>{fmtQ(tarjeta.limite)}</div></div>
              </div>
            </div>
          )}
        </div>
      </Card>
      {!compacta && (
        <div className="flex items-center justify-between text-xs" style={{ marginTop: 12, padding: '0 2px' }}>
          <span className="font-semibold text-[var(--suave)]">Corte día {tarjeta.dia_corte}</span>
          <div className="flex items-center gap-1">
            <span className="font-bold text-[var(--pago)]">{uso}% usado</span>
            {onEditar && (
              <IconButton size="small" onClick={onEditar} aria-label="Editar tarjeta" sx={{ color: 'var(--suave)' }}>
                <EditIcon sx={{ fontSize: 15 }} />
              </IconButton>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
