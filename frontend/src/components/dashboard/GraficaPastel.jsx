import { Pie } from 'react-chartjs-2';
import { PALETA } from '../../paleta.js';
import { fmtQ } from '../../utils.js';

export default function GraficaPastel({ d, tema }) {
  const pal = PALETA[tema];
  let labels = [...d.pastel.labels], datos = [...d.pastel.datos];
  if (labels.length > 8) {
    const resto = datos.slice(7).reduce((a, b) => a + b, 0);
    labels = [...labels.slice(0, 7), 'Otras'];
    datos = [...datos.slice(0, 7), Math.round(resto * 100) / 100];
  }
  if (!datos.length) return <p className="texto-suave">Sin gastos este mes todavía.</p>;

  return (
    <Pie
      data={{ labels, datasets: [{ data: datos, backgroundColor: pal.pie, borderColor: pal.superficie, borderWidth: 2 }] }}
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
