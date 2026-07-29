import { motion } from 'motion/react';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/EditOutlined';
import { fmtQ, fmtFecha } from '../../utils.js';
import { ACC } from '../../theme/colores.js';
import { alzarCard, varsItem } from '../../motion.js';
import AnilloProgreso from '../shared/AnilloProgreso.jsx';
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

      {/* Con objetivo, el avance manda: anillo a la izquierda y las cifras a
          la derecha. Sin objetivo calculable (fondo de emergencia sin
          historial) no hay porcentaje que dibujar, así que solo va la cifra y
          la explicación de por qué falta la meta. */}
      {objetivo != null ? (
        <div className="flex items-center gap-4">
          <AnilloProgreso pct={ahorro.pct ?? 0} color={acento} etiqueta={ahorro.nombre} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 500, ...tabularNums }}>{fmtQ(ahorro.saldo)}</div>
            <div className="text-[13px] text-[var(--suave)]" style={tabularNums}>
              de {fmtQ(objetivo)}
            </div>
            <div className="text-[13px] mt-1.5">
              {ahorro.completado
                ? <span style={{ color: 'var(--alza)' }}>Completado</span>
                : <span className="text-[var(--suave)]">Faltan {fmtQ(ahorro.falta)}</span>}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 24, fontWeight: 500, ...tabularNums }}>{fmtQ(ahorro.saldo)}</div>
          <div className="text-[13px] text-[var(--suave)]">
            El objetivo son {ahorro.meses_gastos} {ahorro.meses_gastos === 1 ? 'mes' : 'meses'} de
            gastos, pero todavía no hay historial para calcularlo.
          </div>
        </div>
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
