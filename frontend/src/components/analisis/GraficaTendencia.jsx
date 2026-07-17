import { Line } from 'react-chartjs-2';
import { PALETA } from '../../paleta.js';
import { fmtQ } from '../../utils.js';

export default function GraficaTendencia({ d, tema }) {
  const pal = PALETA[tema];
  if (!d.tendencia_categorias.series.length) return <p className="texto-suave">Sin gastos este mes todavía.</p>;

  return (
    <Line
      data={{
        labels: d.tendencia_categorias.labels,
        datasets: d.tendencia_categorias.series.map((s, i) => ({
          label: s.nombre, data: s.datos, borderColor: pal.pie[i], backgroundColor: pal.pie[i],
          tension: 0.3, pointRadius: 3,
        })),
      }}
      options={{
        responsive: true,
        plugins: {
          legend: { labels: { color: pal.tinta, boxWidth: 12, boxHeight: 12 } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtQ(c.raw)}` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: pal.tinta }, border: { color: pal.grid } },
          y: { grid: { color: pal.grid }, border: { display: false }, ticks: { color: pal.tinta, callback: v => 'Q ' + v.toLocaleString() } },
        },
      }}
    />
  );
}
