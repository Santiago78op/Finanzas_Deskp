import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import EditIcon from '@mui/icons-material/EditOutlined';
import { fmtQ } from '../../utils.js';
import { tabularNums } from '../shared/estilos.js';

// Card de Visa Cuotas: descripción + tarjeta asociada (si hay), saldo
// pendiente, barra de "X de Y cuotas" y cuota mensual. Sin botón de pago
// cuando ya se completaron todas las cuotas.
export default function VisacuotaCard({ visacuota, tarjetaNombre, onEditar, onPagar }) {
  const pct = visacuota.num_cuotas
    ? Math.min(100, Math.round((visacuota.cuotas_pagadas / visacuota.num_cuotas) * 100))
    : 0;
  const completa = visacuota.cuotas_restantes <= 0;

  return (
    <Card component="article" className={`p-[18px] flex flex-col gap-3 relative${visacuota.activo ? '' : ' opacity-60'}`}>
      <IconButton size="small" onClick={onEditar} aria-label="Editar Visa Cuotas" sx={{ position: 'absolute', top: 8, right: 8, color: 'var(--suave)' }}>
        <EditIcon sx={{ fontSize: 16 }} />
      </IconButton>
      <div className="flex items-start justify-between gap-2 pr-6" style={{ minWidth: 0 }}>
        <div style={{ minWidth: 0 }}>
          <div className="text-[15px] font-semibold truncate">{visacuota.descripcion}</div>
          <div className="text-xs text-[var(--suave)]">Diferido en {tarjetaNombre}</div>
        </div>
        {completa && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--panel-2)] text-[var(--suave)]">
            Completada
          </span>
        )}
      </div>
      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--suave)]">Saldo pendiente</div>
        <div className="text-[21px] font-bold" style={tabularNums}>{fmtQ(visacuota.saldo)}</div>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--panel-2)' }}>
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--primario)' }} />
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--suave)]">{visacuota.cuotas_pagadas} de {visacuota.num_cuotas} cuotas</span>
        <span className="font-semibold" style={tabularNums}>{fmtQ(visacuota.cuota_mensual)}/mes</span>
      </div>
      {!completa && <Button size="small" variant="outlined" onClick={onPagar}>Registrar pago</Button>}
    </Card>
  );
}
