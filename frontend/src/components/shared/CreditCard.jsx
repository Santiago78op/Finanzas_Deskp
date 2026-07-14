import { fmtQ, claseUso } from '../../utils.js';

export default function CreditCard({ tarjeta, onEditar }) {
  const compacta = !onEditar;
  return (
    <div className={`credit-card acc-${tarjeta.id % 6}${tarjeta.activa ? '' : ' inactiva'}${compacta ? ' compacta' : ''}`}>
      <div className="cc-top">
        <span className="cc-banco">{tarjeta.banco}</span>
        <span className="cc-chip"></span>
      </div>
      <div className="cc-nombre">{tarjeta.nombre}</div>
      <div className="cc-saldo">{fmtQ(tarjeta.saldo)}</div>
      <div className="barra-uso">
        <div className={claseUso(tarjeta.pct_uso)} style={{ width: `${Math.min(100, Math.max(0, tarjeta.pct_uso))}%` }} />
      </div>
      <div className="cc-datos">
        <span>Disp. {fmtQ(tarjeta.disponible)}</span>
        <span>Corte {tarjeta.dia_corte} · Pago {tarjeta.dia_pago}</span>
      </div>
      {onEditar && <button className="mini-btn cc-editar" onClick={onEditar}>Editar</button>}
    </div>
  );
}
