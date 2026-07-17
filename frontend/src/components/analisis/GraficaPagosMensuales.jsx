import { Bar } from 'react-chartjs-2';
import { PALETA } from '../../paleta.js';
import { fmtQ } from '../../utils.js';

// Nivel de pagos mensuales: cuánto sale del bolsillo cada mes por deudas
// (tarjetas + préstamos + Visa Cuotas), apilado, contra el ingreso mensual
// de referencia (salario recurrente) para ver de un vistazo qué proporción
// ya está comprometida — si no hay ingreso recurrente configurado, se
// muestra solo el desglose de pagos, sin la barra de comparación.
export default function GraficaPagosMensuales({ d, tema }) {
  const pal = PALETA[tema];
  const e = d.endeudamiento;
  const totalPago = e.pago_mensual_tarjetas + e.pago_mensual_prestamos + e.pago_mensual_visacuotas;
  if (!totalPago) return <p className="texto-suave">Sin pagos mensuales de deuda comprometidos.</p>;

  const hayIngreso = e.ingreso_mensual_referencia != null;
  const conValor = (v) => hayIngreso ? [v, 0] : [v];
  const labels = hayIngreso ? ['Pago mensual de deudas', 'Ingreso mensual'] : ['Pago mensual de deudas'];

  const datasets = [
    { label: 'Tarjetas', data: conValor(e.pago_mensual_tarjetas), backgroundColor: pal.pie[0] },
    { label: 'Préstamos', data: conValor(e.pago_mensual_prestamos), backgroundColor: pal.pie[1] },
    { label: 'Visa Cuotas', data: conValor(e.pago_mensual_visacuotas), backgroundColor: pal.pie[2] },
  ];
  if (hayIngreso) {
    datasets.push({ label: 'Ingreso mensual', data: [0, e.ingreso_mensual_referencia], backgroundColor: pal.ingresos });
  }

  return (
    <Bar
      data={{ labels, datasets }}
      options={{
        indexAxis: 'y',
        responsive: true,
        scales: {
          x: { stacked: true, grid: { color: pal.grid }, border: { display: false }, ticks: { color: pal.tinta } },
          y: { stacked: true, grid: { display: false }, ticks: { color: pal.tinta }, border: { color: pal.grid } },
        },
        plugins: {
          legend: { position: 'bottom', labels: { color: pal.tinta, boxWidth: 12, boxHeight: 12 } },
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtQ(c.raw)}` } },
        },
      }}
    />
  );
}
