import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { fmtQ } from '../../utils.js';
import { ACC } from '../../theme/colores.js';

// Acento por cuenta (id % 6) como filo superior de 3px, no como bloque de
// fondo saturado — mismo criterio que ya aplica CreditCard.jsx ("un fondo
// saturado no lee como tarjeta real"), que acá nunca se había aplicado y
// dejaba "Mis cuentas" con 3-6 colores carnaval sin significado semántico.
export default function AccountCard({ cuenta, onEditar }) {
  const compacta = !onEditar;
  const acento = ACC[cuenta.id % 6];

  return (
    <Card
      component="article"
      className={`overflow-hidden${cuenta.activa ? '' : ' opacity-50'}`}
      sx={{ width: compacta ? 240 : '100%', maxWidth: 300, borderTop: `3px solid ${acento}` }}
    >
      <div className="p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-[var(--suave)]">
          <span>{cuenta.banco}</span>
          <span>{cuenta.tipo}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium truncate">{cuenta.nombre}</span>
          {!cuenta.activa && (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-[var(--panel2)] text-[var(--suave)]">
              Inactiva
            </span>
          )}
        </div>
        <div className="text-lg font-semibold">{fmtQ(cuenta.saldo)}</div>
        {onEditar && <Button size="small" variant="outlined" onClick={onEditar}>Editar</Button>}
      </div>
    </Card>
  );
}
