import { useRef, useState } from 'react';
import AvisoSalario from './AvisoSalario.jsx';
import FormGasto from './FormGasto.jsx';
import FormPago from './FormPago.jsx';
import FormIngreso from './FormIngreso.jsx';

export default function RegistroView() {
  const [tipo, setTipo] = useState('gasto');
  const montoRef = useRef(null);

  const elegirTipo = (t) => {
    setTipo(t);
    requestAnimationFrame(() => montoRef.current?.focus());
  };

  return (
    <div id="vista-registro" className="vista">
      <AvisoSalario />

      <div className="selector-tipo">
        <button
          className={'tipo-btn gasto' + (tipo === 'gasto' ? ' activo' : '')}
          onClick={() => elegirTipo('gasto')}
        >+ Gasto</button>
        <button
          className={'tipo-btn secundario' + (tipo === 'pago' ? ' activo' : '')}
          onClick={() => elegirTipo('pago')}
        >+ Pago tarjeta</button>
        <button
          className={'tipo-btn secundario' + (tipo === 'ingreso' ? ' activo' : '')}
          onClick={() => elegirTipo('ingreso')}
        >+ Ingreso</button>
      </div>

      {tipo === 'gasto' && <FormGasto inputRef={montoRef} />}
      {tipo === 'pago' && <FormPago inputRef={montoRef} />}
      {tipo === 'ingreso' && <FormIngreso inputRef={montoRef} />}
    </div>
  );
}
