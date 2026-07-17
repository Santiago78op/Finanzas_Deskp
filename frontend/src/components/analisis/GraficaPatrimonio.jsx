import { Line } from 'react-chartjs-2';
import { PALETA } from '../../paleta.js';
import { fmtQ } from '../../utils.js';

export default function GraficaPatrimonio({ d, tema }) {
  const pal = PALETA[tema];
  const hay = d.patrimonio_hist.datos.some(v => v);
  if (!hay) return <p className="texto-suave">Sin datos suficientes todavía.</p>;

  return (
    <Line
      data={{
        labels: d.patrimonio_hist.labels,
        datasets: [{
          label: 'Patrimonio', data: d.patrimonio_hist.datos,
          borderColor: pal.patrimonio, backgroundColor: pal.patrimonio + '33',
          fill: true, tension: 0.3, pointRadius: 3,
        }],
      }}
      options={{
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => fmtQ(c.raw) } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: pal.tinta }, border: { color: pal.grid } },
          y: { grid: { color: pal.grid }, border: { display: false }, ticks: { color: pal.tinta, callback: v => 'Q ' + v.toLocaleString() } },
        },
      }}
    />
  );
}
