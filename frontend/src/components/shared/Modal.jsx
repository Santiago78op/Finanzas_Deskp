export default function Modal({ titulo, onCerrar, onGuardar, children, labelGuardar = 'Guardar', labelCerrar = 'Cancelar', peligro = false }) {
  return (
    <div className="modal">
      <div className="modal-caja">
        <h3>{titulo}</h3>
        <div id="modal-cuerpo">{children}</div>
        <div className="modal-acciones">
          <button className={peligro ? 'guardar gasto' : 'guardar'} onClick={onGuardar}>{labelGuardar}</button>
          <button className="mini-btn" onClick={onCerrar}>{labelCerrar}</button>
        </div>
      </div>
    </div>
  );
}
