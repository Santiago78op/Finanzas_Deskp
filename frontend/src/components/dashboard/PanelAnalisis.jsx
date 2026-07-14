import { fmtFecha, fmtQ } from '../../utils.js';

export default function PanelAnalisis({ d }) {
  const a = d.analisis;
  if (!a.top_categorias.length) return <p className="texto-suave">Sin gastos este mes todavía.</p>;

  const varTotal = a.gastos_mes_anterior > 0
    ? ((d.gastos - a.gastos_mes_anterior) / a.gastos_mes_anterior * 100).toFixed(1)
    : null;

  return (
    <>
      <div className="analisis-sub">Top categorías (% del gasto del mes · vs mes anterior)</div>
      {a.top_categorias.map((c, i) => {
        let delta;
        if (c.variacion_pct === null) delta = <span className="delta-nuevo">nuevo</span>;
        else if (c.variacion_pct > 0) delta = <span className="delta-sube">▲ {c.variacion_pct}%</span>;
        else delta = <span className="delta-baja">▼ {Math.abs(c.variacion_pct)}%</span>;
        return (
          <div className="analisis-fila" key={i}>
            <span><b>{c.nombre}</b> <small>{c.pct}% del mes</small></span>
            <span>{fmtQ(c.total)} {delta}</span>
          </div>
        );
      })}
      <div className="analisis-sub">Tus 5 gastos más grandes del mes (el "porqué")</div>
      {a.top_gastos.map((g, i) => (
        <div className="analisis-fila" key={i}>
          <span>{fmtFecha(g.fecha)} — {g.descripcion || '(sin descripción)'} <small>({g.categoria})</small></span>
          <b>{fmtQ(g.monto)}</b>
        </div>
      ))}
      {varTotal !== null && (
        <p className="texto-suave" style={{ marginTop: 10 }}>
          Gasto total vs mes anterior: {fmtQ(a.gastos_mes_anterior)} → {fmtQ(d.gastos)} ({varTotal > 0 ? '+' : ''}{varTotal}%)
        </p>
      )}
    </>
  );
}
