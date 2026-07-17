import { Doughnut } from 'react-chartjs-2';
import { PALETA } from '../../paleta.js';
import { fmtQ } from '../../utils.js';

// Nivel real de endeudamiento: deuda pendiente de las 3 fuentes que hoy
// trackea la app (tarjetas + préstamos + Visa Cuotas), no solo tarjetas.
export default function GraficaEndeudamiento({ d, tema }) {
  const pal = PALETA[tema];
  const e = d.endeudamiento;
  const labels = ['Tarjetas', 'Préstamos', 'Visa Cuotas'];
  const datos = [e.tarjetas, e.prestamos, e.visacuotas];
  if (!datos.some(v => v > 0)) return <p className="texto-suave">Sin deuda registrada — nada que mostrar acá.</p>;

  return (
    <Doughnut
      data={{ labels, datasets: [{ data: datos, backgroundColor: pal.pie.slice(0, 3), borderColor: pal.superficie, borderWidth: 2 }] }}
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
