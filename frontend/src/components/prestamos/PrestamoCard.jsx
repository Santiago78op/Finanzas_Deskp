import { motion } from 'motion/react';
import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import EditIcon from '@mui/icons-material/EditOutlined';
import { fmtQ } from '../../utils.js';
import { alzarCard, varsItem } from '../../motion.js';
import BarraProgreso from '../shared/BarraProgreso.jsx';
import { tabularNums } from '../shared/estilos.js';

const MotionCard = motion.create(Card);

// Card de préstamo (mirror de AccountCard.jsx): nombre/institución arriba,
// saldo pendiente grande, barra de progreso pagado y cuota mensual abajo.
export default function PrestamoCard({ prestamo, onEditar, onPagar }) {
  const pct = Math.min(100, Math.max(0, prestamo.pct_pagado));

  return (
    <MotionCard
      component="article"
      className={`p-[18px] flex flex-col gap-3 relative${prestamo.activo ? '' : ' opacity-60'}`}
      variants={varsItem}
      {...alzarCard}
    >
      <IconButton size="small" onClick={onEditar} aria-label="Editar préstamo" sx={{ position: 'absolute', top: 8, right: 8, color: 'var(--suave)' }}>
        <EditIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <div className="pr-6" style={{ minWidth: 0 }}>
        <div className="text-[15px] font-semibold truncate">{prestamo.nombre}</div>
        <div className="text-xs text-[var(--suave)]">{prestamo.institucion}</div>
      </div>
      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--suave)]">Saldo pendiente</div>
        <div className="text-[21px] font-bold" style={tabularNums}>{fmtQ(prestamo.saldo)}</div>
      </div>
      {/* Al registrar un pago la barra AVANZA en vez de redibujarse: es el
          único feedback visual de que el préstamo se acortó. */}
      <BarraProgreso alto={6} pct={pct} color="var(--primario)" etiqueta={`Pagado de ${prestamo.nombre}`} />
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--suave)]">{pct}% pagado · cuota mensual</span>
        <span className="font-semibold" style={tabularNums}>{fmtQ(prestamo.cuota_mensual)}</span>
      </div>
      <Button size="small" variant="outlined" onClick={onPagar}>Registrar pago</Button>
    </MotionCard>
  );
}
