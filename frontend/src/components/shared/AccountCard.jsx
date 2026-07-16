import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { fmtQ } from '../../utils.js';
import { ACC } from '../../theme/colores.js';

// Card de cuenta (FinanzasQ.dc.html, Claude Design): punto de acento + nombre
// arriba, "Disponible" + cifra grande abajo — sin el bloque de fondo
// saturado ni la banda banco/tipo que tenía antes. El botón Editar es
// agregado real (el mockup no tiene CRUD) para no perder esa función.
export default function AccountCard({ cuenta, onEditar }) {
  const compacta = !onEditar;
  const acento = ACC[cuenta.id % 6];

  return (
    <Card
      component="article"
      className={`p-[18px] flex flex-col gap-3.5${cuenta.activa ? '' : ' opacity-60'}`}
      sx={{ width: compacta ? 240 : '100%', maxWidth: 300 }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
          <span style={{ width: 11, height: 11, borderRadius: 999, flex: 'none', background: acento }} />
          <div style={{ minWidth: 0 }}>
            <div className="text-[15px] font-semibold truncate">{cuenta.nombre}</div>
            <div className="text-xs text-[var(--suave)]">{cuenta.banco} · {cuenta.tipo}</div>
          </div>
        </div>
        {!cuenta.activa && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--panel2)] text-[var(--suave)]">
            Inactiva
          </span>
        )}
      </div>
      <div>
        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--suave)]">Disponible</div>
        <div className="text-[23px] font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(cuenta.saldo)}</div>
      </div>
      {onEditar && <Button size="small" variant="outlined" onClick={onEditar}>Editar</Button>}
    </Card>
  );
}
