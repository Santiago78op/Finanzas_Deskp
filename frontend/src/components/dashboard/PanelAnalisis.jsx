import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { fmtFecha, fmtQ } from '../../utils.js';

export default function PanelAnalisis({ d }) {
  const a = d.analisis;
  if (!a.top_categorias.length) return <Typography variant="body2" className="text-[var(--suave)]">Sin gastos este mes todavía.</Typography>;

  const varTotal = a.gastos_mes_anterior > 0
    ? ((d.gastos - a.gastos_mes_anterior) / a.gastos_mes_anterior * 100).toFixed(1)
    : null;

  return (
    <>
      <Typography variant="overline" className="text-[var(--suave)] font-bold block mt-4 mb-1">Top categorías (% del gasto del mes · vs mes anterior)</Typography>
      {a.top_categorias.map((c, i) => {
        let delta;
        if (c.variacion_pct === null) delta = <span className="text-[var(--suave)]">nuevo</span>;
        else if (c.variacion_pct > 0) delta = <span className="text-[var(--gasto)] font-bold tabular-nums">▲ {c.variacion_pct}%</span>;
        else delta = <span className="text-[var(--ingreso)] font-bold tabular-nums">▼ {Math.abs(c.variacion_pct)}%</span>;
        return (
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}
            key={i} className={`py-2 text-sm ${i === 0 ? '' : 'border-t border-[var(--borde)]'}`}>
            <span><b>{c.nombre}</b> <small className="text-[var(--suave)]">{c.pct}% del mes</small></span>
            <span>{fmtQ(c.total)} {delta}</span>
          </Stack>
        );
      })}
      <Typography variant="overline" className="text-[var(--suave)] font-bold block mt-4 mb-1">Tus 5 gastos más grandes del mes (el "porqué")</Typography>
      {a.top_gastos.map((g, i) => (
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}
          key={i} className={`py-2 text-sm ${i === 0 ? '' : 'border-t border-[var(--borde)]'}`}>
          <span>{fmtFecha(g.fecha)} — {g.descripcion || '(sin descripción)'} <small className="text-[var(--suave)]">({g.categoria})</small></span>
          <b>{fmtQ(g.monto)}</b>
        </Stack>
      ))}
      {varTotal !== null && (
        <Typography variant="body2" className="text-[var(--suave)] mt-3">
          Gasto total vs mes anterior: {fmtQ(a.gastos_mes_anterior)} → {fmtQ(d.gastos)} ({varTotal > 0 ? '+' : ''}{varTotal}%)
        </Typography>
      )}
    </>
  );
}
