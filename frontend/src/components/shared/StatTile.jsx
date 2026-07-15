import Card from '@mui/material/Card';
import { useTickerNumber } from '../../hooks/useTickerNumber.js';

export default function StatTile({ icono, tinte, titulo, valor, cls = '' }) {
  const texto = useTickerNumber(valor);
  return (
    <Card className="p-3 flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: tinte, color: '#fff' }}
      >
        {icono}
      </div>
      <div className="min-w-0">
        <div className={`text-lg font-semibold truncate ${cls}`}>{texto}</div>
        <div className="text-xs text-[var(--suave)] truncate">{titulo}</div>
      </div>
    </Card>
  );
}
