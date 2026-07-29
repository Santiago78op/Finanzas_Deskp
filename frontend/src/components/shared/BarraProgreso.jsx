import { motion } from 'motion/react';
import { RESORTE_LENTO } from '../../motion.js';

// Barra de progreso que CRECE hasta su valor en vez de aparecer ya llena.
// Antes eran ~6 <div> con `width: N%` copiados en Dashboard, CreditCard,
// PrestamoCard y VisacuotaCard: al entrar a la vista ya estaban pintadas, así
// que no comunicaban magnitud — el ojo no tiene con qué comparar un rectángulo
// estático. Viéndola llegar hasta el 78% sí se siente "casi lleno".
//
// Anima `width` y no `scaleX` a propósito: con scaleX el border-radius de las
// puntas se deforma horizontalmente y en una barra de 6px se nota feo. Son un
// puñado de barras chicas, el costo de layout es irrelevante acá.
export default function BarraProgreso({
  pct, color, alto = 8, fondo = 'var(--panel-2)', className = '', etiqueta,
}) {
  const p = Math.max(0, Math.min(100, Math.round(pct) || 0));

  return (
    <div
      className={`rounded-full overflow-hidden ${className}`}
      style={{ height: alto, background: fondo }}
      role={etiqueta ? 'progressbar' : undefined}
      aria-label={etiqueta}
      aria-valuenow={etiqueta ? p : undefined}
      aria-valuemin={etiqueta ? 0 : undefined}
      aria-valuemax={etiqueta ? 100 : undefined}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${p}%` }}
        transition={RESORTE_LENTO}
      />
    </div>
  );
}
