import { Bar } from 'react-chartjs-2';
import { PALETA } from '../../paleta.js';
import { fmtQ } from '../../utils.js';

export default function GraficaBarras({ d, tema }) {
  const pal = PALETA[tema];
  const hay = d.barras.ingresos.some(v => v) || d.barras.gastos.some(v => v);
  if (!hay) return <p className="texto-suave">Sin movimientos este año todavía.</p>;

  return (
    <Bar
      data={{
        labels: d.barras.labels,
        datasets: [
          { label: 'Ingresos', data: d.barras.ingresos, backgroundColor: pal.ingresos, borderRadius: 4, borderSkipped: 'bottom' },
          { label: 'Gastos', data: d.barras.gastos, backgroundColor: pal.gastos, borderRadius: 4, borderSkipped: 'bottom' },
        ],
      }}
      options={{
        responsive: true,
        color: pal.tinta,
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
