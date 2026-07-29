import { motion } from 'motion/react';
import Card from '@mui/material/Card';
import { useTickerNumber } from '../../hooks/useTickerNumber.js';
import { alzarCard, varsItem } from '../../motion.js';

const MotionCard = motion.create(Card);

export default function StatTile({ icono, tinte, titulo, valor, cls = '' }) {
  const texto = useTickerNumber(valor);
  return (
    <MotionCard
      className="p-3 flex items-center gap-3"
      variants={varsItem}
      {...alzarCard}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: tinte, color: '#fff' }}
      >
        {icono}
      </div>
      <div className="min-w-0">
        {/* El monto es un MotionValue: lo escribe Motion, no React. */}
        <motion.div className={`text-lg font-semibold truncate ${cls}`}>{texto}</motion.div>
        <div className="text-xs text-[var(--suave)] truncate">{titulo}</div>
      </div>
    </MotionCard>
  );
}
