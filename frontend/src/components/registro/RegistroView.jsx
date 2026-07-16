import { useRef, useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
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
    <div id="vista-registro" className="vista max-w-2xl">
      <AvisoSalario />

      <Stack direction="row" sx={{ gap: 1.5 }} className="mb-4">
        <Button
          variant={tipo === 'gasto' ? 'contained' : 'outlined'}
          color="error"
          size="large"
          className="flex-[2] text-lg"
          onClick={() => elegirTipo('gasto')}
        >+ Gasto</Button>
        <Button
          variant={tipo === 'pago' ? 'contained' : 'outlined'}
          color="warning"
          className="flex-1"
          onClick={() => elegirTipo('pago')}
        >+ Pago tarjeta</Button>
        <Button
          variant={tipo === 'ingreso' ? 'contained' : 'outlined'}
          color="success"
          className="flex-1"
          onClick={() => elegirTipo('ingreso')}
        >+ Ingreso</Button>
      </Stack>

      {tipo === 'gasto' && <FormGasto inputRef={montoRef} />}
      {tipo === 'pago' && <FormPago inputRef={montoRef} />}
      {tipo === 'ingreso' && <FormIngreso inputRef={montoRef} />}
    </div>
  );
}
