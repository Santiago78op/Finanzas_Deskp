import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { fmtQ, claseUso } from '../../utils.js';
import { ACC } from '../../theme/colores.js';

// Cara de tarjeta oscura y realista (inspirada en doc/credit_card.png) en vez
// del rectángulo de color plano anterior — el acento por tarjeta (acc-0..5)
// ahora es solo un filo de color arriba + el chip, no todo el fondo, porque
// un fondo saturado no lee como "tarjeta de crédito real". No hay campo de
// número de tarjeta en el modelo de datos: se enmascara con un número
// derivado del id, no se inventa un dato falso.
const BARRA_COLOR = { 'uso-verde': 'bg-emerald-400', 'uso-amarillo': 'bg-amber-400', 'uso-rojo': 'bg-red-400' };

export default function CreditCard({ tarjeta, onEditar }) {
  const compacta = !onEditar;
  const acento = ACC[tarjeta.id % 6];
  const numero = String(1000 + ((tarjeta.id * 7919) % 9000)).padStart(4, '0');

  return (
    <Card
      component="article"
      className={`overflow-hidden${tarjeta.activa ? '' : ' opacity-50'}`}
      sx={{ width: compacta ? 260 : '100%', maxWidth: 320 }}
    >
      <div
        className="relative p-4 text-white bg-gradient-to-br from-neutral-800 to-neutral-950"
        style={{ borderTop: `3px solid ${acento}`, minHeight: 150 }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold tracking-wide uppercase opacity-90">{tarjeta.banco}</span>
          <div className="flex items-center gap-2">
            {!tarjeta.activa && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-white/15">Inactiva</span>
            )}
            <span className="w-8 h-6 rounded-sm bg-gradient-to-br from-yellow-200 to-yellow-500" />
          </div>
        </div>
        <div className="mt-6 font-mono text-lg tracking-[0.2em]">•••• •••• •••• {numero}</div>
        <div className="mt-4 flex items-end justify-between gap-2 text-xs opacity-90">
          <span className="truncate max-w-[60%]">{tarjeta.nombre}</span>
          <span className="whitespace-nowrap">Corte {tarjeta.dia_corte} · Pago {tarjeta.dia_pago}</span>
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="text-xs text-[var(--suave)]">Saldo</span>
          <span className="font-semibold">{fmtQ(tarjeta.saldo)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-[var(--panel2)] overflow-hidden">
          <div
            className={`h-full ${BARRA_COLOR[claseUso(tarjeta.pct_uso)]}`}
            style={{ width: `${Math.min(100, Math.max(0, tarjeta.pct_uso))}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-[var(--suave)]">
          <span>Disp. {fmtQ(tarjeta.disponible)}</span>
        </div>
        {onEditar && <Button size="small" variant="outlined" onClick={onEditar}>Editar</Button>}
      </div>
    </Card>
  );
}
