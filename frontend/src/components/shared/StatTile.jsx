import { useTickerNumber } from '../../hooks/useTickerNumber.js';

export default function StatTile({ icono, tinte, titulo, valor, cls = '' }) {
  const texto = useTickerNumber(valor);
  return (
    <div className="metrica">
      <div className="icono-metrica" style={{ '--tinte': tinte }}>{icono}</div>
      <div className="metrica-info">
        <div className={`valor ${cls}`}>{texto}</div>
        <div className="titulo">{titulo}</div>
      </div>
    </div>
  );
}
