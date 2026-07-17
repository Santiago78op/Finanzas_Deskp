import Card from '@mui/material/Card';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/EditOutlined';
import { fmtQ } from '../../utils.js';
import { ACC } from '../../theme/colores.js';
import { tabularNums, puntoAcento } from './estilos.js';

// Card de cuenta (FinanzasQ.dc.html, Claude Design): punto de acento + nombre
// arriba, "Disponible" + cifra grande abajo — sin el bloque de fondo
// saturado ni la banda banco/tipo que tenía antes. El diseño no tiene CRUD;
// el ícono de editar (esquina) es agregado real para no perder esa función,
// discreto para no romper el look limpio del mockup.
export default function AccountCard({ cuenta, onEditar }) {
  const compacta = !onEditar;
  const acento = ACC[cuenta.id % 6];

  return (
    <Card
      component="article"
      className={`p-[18px] flex flex-col gap-3.5 relative${cuenta.activa ? '' : ' opacity-60'}`}
      sx={{ width: compacta ? 240 : '100%', maxWidth: 300 }}
    >
      {onEditar && (
        <IconButton size="small" onClick={onEditar} aria-label="Editar cuenta" sx={{ position: 'absolute', top: 8, right: 8, color: 'var(--suave)' }}>
          <EditIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
      <div className="flex items-center justify-between gap-2 pr-6">
        <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
          <span style={puntoAcento(acento, 11)} />
          <div style={{ minWidth: 0 }}>
            <div className="text-[15px] font-semibold truncate">{cuenta.nombre}</div>
            <div className="text-xs text-[var(--suave)]">{cuenta.banco} · {cuenta.tipo}</div>
          </div>
        </div>
        {!cuenta.activa && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--panel-2)] text-[var(--suave)]">
            Inactiva
          </span>
        )}
      </div>
      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--suave)]">Disponible</div>
        <div className="text-[23px] font-bold" style={tabularNums}>{fmtQ(cuenta.saldo)}</div>
      </div>
    </Card>
  );
}
