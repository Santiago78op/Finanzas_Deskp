import { Doughnut } from 'react-chartjs-2';
import { PALETA } from '../../paleta.js';
import { fmtQ } from '../../utils.js';

export default function GraficaMetodo({ d, tema }) {
  const pal = PALETA[tema];
  if (!d.metodo_pago.datos.length) return <p className="texto-suave">Sin gastos este mes todavía.</p>;

  return (
    <Doughnut
      data={{
        labels: d.metodo_pago.labels,
        datasets: [{ data: d.metodo_pago.datos, backgroundColor: pal.pie, borderColor: pal.superficie, borderWidth: 2 }],
      }}
      options={{
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: pal.tinta, boxWidth: 12, boxHeight: 12 } },
          tooltip: { callbacks: { label: c => `${c.label}: ${fmtQ(c.raw)}` } },
        },
      }}
    />
  );
}
