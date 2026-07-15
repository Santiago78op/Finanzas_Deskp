import StatTile from '../shared/StatTile.jsx';

export default function Metricas({ d }) {
  const claseBalance = d.balance >= 0 ? 'positivo' : 'negativo';
  const clasePatri = d.patrimonio >= 0 ? 'positivo' : 'negativo';
  const tiles = [
    { t: 'Ingresos del mes', v: d.ingresos, cls: 'positivo', icono: '💰', tinte: '#0e8a2f' },
    { t: 'Gastos del mes', v: d.gastos, cls: 'negativo', icono: '💸', tinte: '#d03b3b' },
    { t: 'Balance', v: d.balance, cls: claseBalance, icono: '⚖️', tinte: '#2563eb' },
    { t: 'Dinero en cuentas', v: d.dinero_total, cls: '', icono: '🏦', tinte: '#0891b2' },
    { t: 'Deuda en tarjetas', v: d.deuda_total, cls: '', icono: '💳', tinte: '#eda100' },
    { t: 'Patrimonio', v: d.patrimonio, cls: clasePatri, icono: '📈', tinte: '#7c6cf0' },
  ];

  return (
    <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
      {tiles.map(m => (
        <StatTile key={m.t} icono={m.icono} tinte={m.tinte} titulo={m.t} valor={m.v} cls={m.cls} />
      ))}
    </div>
  );
}
