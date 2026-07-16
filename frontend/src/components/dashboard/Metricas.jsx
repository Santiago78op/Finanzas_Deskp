import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import StatTile from '../shared/StatTile.jsx';

// Íconos vectoriales en vez de emoji: un emoji no escala como ícono real (no
// hereda color/tema de forma consistente entre plataformas) — antipatrón que
// marca el propio motor de reglas de ui-ux-pro-max ("No Emoji as Structural
// Icons").
export default function Metricas({ d }) {
  const claseBalance = d.balance >= 0 ? 'positivo' : 'negativo';
  const clasePatri = d.patrimonio >= 0 ? 'positivo' : 'negativo';
  const tiles = [
    { t: 'Ingresos del mes', v: d.ingresos, cls: 'positivo', icono: <TrendingUpIcon fontSize="small" />, tinte: '#0e8a2f' },
    { t: 'Gastos del mes', v: d.gastos, cls: 'negativo', icono: <TrendingDownIcon fontSize="small" />, tinte: '#d03b3b' },
    { t: 'Balance', v: d.balance, cls: claseBalance, icono: <CompareArrowsIcon fontSize="small" />, tinte: '#2563eb' },
    { t: 'Dinero en cuentas', v: d.dinero_total, cls: '', icono: <AccountBalanceIcon fontSize="small" />, tinte: '#0891b2' },
    { t: 'Deuda en tarjetas', v: d.deuda_total, cls: '', icono: <CreditCardIcon fontSize="small" />, tinte: '#eda100' },
    { t: 'Patrimonio', v: d.patrimonio, cls: clasePatri, icono: <ShowChartIcon fontSize="small" />, tinte: '#7c6cf0' },
  ];

  return (
    <section aria-label="Métricas del mes" className="reveal-block grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
      {tiles.map(m => (
        <StatTile key={m.t} icono={m.icono} tinte={m.tinte} titulo={m.t} valor={m.v} cls={m.cls} />
      ))}
    </section>
  );
}
