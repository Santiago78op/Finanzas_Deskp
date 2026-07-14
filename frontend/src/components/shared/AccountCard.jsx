import { fmtQ } from '../../utils.js';

export default function AccountCard({ cuenta, onEditar }) {
  const compacta = !onEditar;
  return (
    <div className={`account-card acc-${cuenta.id % 6}${cuenta.activa ? '' : ' inactiva'}${compacta ? ' compacta' : ''}`}>
      <div className="ac-top">
        <span className="ac-banco">{cuenta.banco}</span>
        <span className="ac-tipo">{cuenta.tipo}</span>
      </div>
      <div className="ac-nombre">{cuenta.nombre}</div>
      <div className="ac-saldo">{fmtQ(cuenta.saldo)}</div>
      {onEditar && <button className="mini-btn ac-editar" onClick={onEditar}>Editar</button>}
    </div>
  );
}
