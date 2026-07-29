import { motion } from 'motion/react';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/EditOutlined';
import { fmtQ, fmtFecha } from '../../utils.js';
import { ACC } from '../../theme/colores.js';
import { alzarCard, varsItem } from '../../motion.js';
import BarraProgreso from '../shared/BarraProgreso.jsx';
import { tabularNums } from '../shared/estilos.js';

const MotionCard = motion.create(Card);

// Card de un sobre de ahorro. El fondo de emergencia se distingue por el
// filete superior y porque su objetivo se expresa en meses de gastos, no en
// un monto que el usuario haya elegido.
export default function AhorroCard({ ahorro, onEditar, onAportar }) {
  const acento = ACC[ahorro.color_idx ?? (ahorro.id % 6)];
  const esEmergencia = ahorro.tipo === 'emergencia';
  const objetivo = ahorro.objetivo_calculado;

  return (
    <MotionCard
      component="article"
      className={`p-[18px] flex flex-col gap-3 relative${ahorro.activo ? '' : ' opacity-60'}`}
      sx={{ borderTop: `3px solid ${acento}` }}
      variants={varsItem}
      {...alzarCard}
    >
      <IconButton size="small" onClick={onEditar} aria-label={`Editar ${ahorro.nombre}`}
        sx={{ position: 'absolute', top: 8, right: 8, color: 'var(--suave)' }}>
        <EditIcon sx={{ fontSize: 16 }} />
      </IconButton>

      <div className="pr-6" style={{ minWidth: 0 }}>
        <div className="antetitulo">{esEmergencia ? 'Fondo de emergencia' : 'Meta'}</div>
        <div className="text-[17px] font-medium truncate">{ahorro.nombre}</div>
      </div>

      <div>
        <div className="flex items-baseline gap-2">
          <span style={{ fontSize: 24, fontWeight: 500, ...tabularNums }}>{fmtQ(ahorro.saldo)}</span>
          {objetivo != null && (
            <span className="text-[var(--suave)]" style={{ fontSize: 15, ...tabularNums }}>
              de {fmtQ(objetivo)}
            </span>
          )}
        </div>
        {/* Sin objetivo calculable (fondo de emergencia sin historial de
            gastos) no se inventa una meta: se dice por qué falta. */}
        {objetivo == null && (
          <div className="text-[13px] text-[var(--suave)]">
            El objetivo son {ahorro.meses_gastos} {ahorro.meses_gastos === 1 ? 'mes' : 'meses'} de
            gastos, pero todavía no hay historial para calcularlo.
          </div>
        )}
      </div>

      {objetivo != null && (
        <>
          <BarraProgreso alto={6} pct={ahorro.pct ?? 0} color={acento}
            etiqueta={`Progreso de ${ahorro.nombre}`} />
          <div className="flex items-center justify-between gap-2 text-[13px]">
            <span className="text-[var(--suave)]">
              {ahorro.completado
                ? 'Completado'
                : `Faltan ${fmtQ(ahorro.falta)}`}
            </span>
            <span className="font-medium" style={tabularNums}>{Math.round(ahorro.pct)}%</span>
          </div>
        </>
      )}

      {esEmergencia && objetivo != null && (
        <div className="text-[13px] text-[var(--suave)]">
          Objetivo: {ahorro.meses_gastos} {ahorro.meses_gastos === 1 ? 'mes' : 'meses'} de tu gasto promedio
        </div>
      )}

      {ahorro.fecha_objetivo && (
        <div className="text-[13px] text-[var(--suave)]">
          Para el {fmtFecha(ahorro.fecha_objetivo)}
          {ahorro.requerido_mensual != null && !ahorro.completado && (
            <> · apartá <b className="text-[var(--texto)]">{fmtQ(ahorro.requerido_mensual)}</b> al mes</>
          )}
        </div>
      )}

      {ahorro.nota && (
        <div className="text-[13px] text-[var(--suave)] medida">{ahorro.nota}</div>
      )}

      <Button size="small" variant="outlined" onClick={onAportar} sx={{ alignSelf: 'flex-start', mt: 'auto' }}>
        Apartar o sacar
      </Button>
    </MotionCard>
  );
}
