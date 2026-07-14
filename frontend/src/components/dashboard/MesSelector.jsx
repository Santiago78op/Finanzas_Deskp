import { MESES } from '../../utils.js';

export default function MesSelector({ anio, mes, onCambiar }) {
  return (
    <div className="fila-selector">
      <button className="mini-btn" onClick={() => onCambiar(-1)}>‹</button>
      <span>{MESES[mes]} {anio}</span>
      <button className="mini-btn" onClick={() => onCambiar(1)}>›</button>
    </div>
  );
}
