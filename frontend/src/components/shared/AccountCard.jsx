import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import { fmtQ } from '../../utils.js';
import { ACC, INK_ON_ACC } from '../../theme/colores.js';

export default function AccountCard({ cuenta, onEditar }) {
  const compacta = !onEditar;
  const acento = ACC[cuenta.id % 6];

  return (
    <Card component="article" className={`overflow-hidden${cuenta.activa ? '' : ' opacity-50'}`} sx={{ width: compacta ? 240 : '100%', maxWidth: 300 }}>
      <div className="p-3" style={{ backgroundColor: acento, color: INK_ON_ACC }}>
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
          <span>{cuenta.banco}</span>
          <span>{cuenta.tipo}</span>
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <div className="text-sm font-medium truncate">{cuenta.nombre}</div>
        <div className="text-lg font-semibold">{fmtQ(cuenta.saldo)}</div>
        {onEditar && <Button size="small" variant="outlined" onClick={onEditar}>Editar</Button>}
      </div>
    </Card>
  );
}
