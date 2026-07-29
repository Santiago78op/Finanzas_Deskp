import { motion } from 'motion/react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import { fmtQ } from '../../utils.js';
import { ACC } from '../../theme/colores.js';
import { ENTRADA, RESORTE_LENTO, varsLista } from '../../motion.js';
import { tabularNums } from '../shared/estilos.js';

// Comparación de avance entre todos los sobres.
//
// El anillo de cada card responde "¿cómo va ESTA meta?"; esto responde "¿cuál
// va adelante y cuál no arrancó?", que es otra pregunta y necesita las barras
// alineadas en una misma escala para poder compararlas de un vistazo.
//
// Las barras entran escalonadas (varsLista) y cada una crece con el mismo
// resorte que BarraProgreso, así que el movimiento es el mismo lenguaje que en
// el resto de la app.
export default function PanelAvance({ ahorros }) {
  const conObjetivo = ahorros.filter(a => a.objetivo_calculado != null);

  if (conObjetivo.length < 2) return null;  // con uno solo no hay nada que comparar

  return (
    <Card component="section" aria-labelledby="sec-avance" className="p-5 flex flex-col gap-3">
      <Typography id="sec-avance" variant="caption" className="antetitulo">
        Avance de tus ahorros
      </Typography>

      <motion.div className="flex flex-col gap-3.5" variants={varsLista}
                  initial="oculto" animate="visible">
        {conObjetivo.map(a => {
          const color = ACC[a.color_idx ?? (a.id % 6)];
          const pct = Math.max(0, Math.min(100, a.pct ?? 0));
          return (
            <motion.div key={a.id} variants={{ oculto: { opacity: 0, x: -8 },
                                               visible: { opacity: 1, x: 0, transition: ENTRADA } }}>
              <div className="flex items-baseline justify-between gap-3 mb-1.5">
                <span className="text-[14px] truncate">
                  {a.nombre}
                  {a.tipo === 'emergencia' && (
                    <span className="text-[var(--suave)]"> · emergencia</span>
                  )}
                </span>
                <span className="text-[13px] whitespace-nowrap" style={tabularNums}>
                  <b>{Math.round(pct)}%</b>
                  <span className="text-[var(--suave)]">
                    {' '}· {fmtQ(a.saldo)} de {fmtQ(a.objetivo_calculado)}
                  </span>
                </span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'var(--panel-2)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={RESORTE_LENTO}
                />
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </Card>
  );
}
