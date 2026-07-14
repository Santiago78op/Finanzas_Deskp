export default function Modal({ titulo, onCerrar, onGuardar, children }) {
  return (
    <div className="modal">
      <div className="modal-caja">
        <h3>{titulo}</h3>
        <div id="modal-cuerpo">{children}</div>
        <div className="modal-acciones">
          <button className="guardar" onClick={onGuardar}>Guardar</button>
          <button className="mini-btn" onClick={onCerrar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
