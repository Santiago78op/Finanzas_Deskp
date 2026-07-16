import { Bar } from 'react-chartjs-2';
import { PALETA } from '../../paleta.js';

export default function GraficaUsoTarjetas({ d, tema }) {
  const pal = PALETA[tema];
  if (!d.tarjetas.length) return <p className="texto-suave">Sin tarjetas registradas.</p>;
  // Con 1 sola tarjeta no hay nada que comparar: la barra 0-100% queda casi
  // vacía y el % de uso ya se ve en su propia CreditCard más abajo — mismo
  // criterio que GridOCarrusel usa para no envolver un ítem solo.
  if (d.tarjetas.length < 2) return null;

  return (
    <Bar
      data={{
        labels: d.tarjetas.map(t => t.nombre),
        datasets: [{
          label: '% de uso', data: d.tarjetas.map(t => t.pct_uso),
          backgroundColor: d.tarjetas.map(t => t.pct_uso < 30 ? pal.ingresos : t.pct_uso <= 70 ? '#c98500' : pal.gastos),
          borderRadius: 4,
        }],
      }}
      options={{
        indexAxis: 'y',
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => `${c.raw}% de uso` } },
        },
        scales: {
          x: { min: 0, max: 100, grid: { color: pal.grid }, border: { display: false }, ticks: { color: pal.tinta, callback: v => v + '%' } },
          y: { grid: { display: false }, ticks: { color: pal.tinta }, border: { color: pal.grid } },
        },
      }}
    />
  );
}
