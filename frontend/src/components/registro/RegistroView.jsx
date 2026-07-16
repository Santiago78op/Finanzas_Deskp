import { useRef, useState } from 'react';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import AvisoSalario from './AvisoSalario.jsx';
import FormGasto from './FormGasto.jsx';
import FormPago from './FormPago.jsx';
import FormIngreso from './FormIngreso.jsx';
import { fmtQ } from '../../utils.js';

const COLOR_TIPO = { gasto: 'var(--gasto)', ingreso: 'var(--ingreso)', pago: 'var(--pago)' };
const LABEL_TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', pago: 'Pago' };

// Grid de 2 columnas (FinanzasQ.dc.html, Claude Design): el form a la
// izquierda no cambia de lógica, "Registrado hoy" a la derecha es nuevo —
// lista local de lo guardado en esta sesión (cada Form* llama onGuardado
// además de su toast() de siempre; no se vuelve a pegarle a la API solo
// para mostrar esto).
export default function RegistroView() {
  const [tipo, setTipo] = useState('gasto');
  const [registros, setRegistros] = useState([]);
  const montoRef = useRef(null);

  const elegirTipo = (t) => {
    setTipo(t);
    requestAnimationFrame(() => montoRef.current?.focus());
  };

  const onGuardado = (reg) => setRegistros(r => [reg, ...r]);

  return (
    <div id="vista-registro" className="vista max-w-[1020px] flex flex-col gap-4">
      <AvisoSalario />

      <Stack direction="row" sx={{ gap: 1.5 }} className="mb-1">
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

      <div className="registro-grid">
        <div>
          {tipo === 'gasto' && <FormGasto inputRef={montoRef} onGuardado={onGuardado} />}
          {tipo === 'pago' && <FormPago inputRef={montoRef} onGuardado={onGuardado} />}
          {tipo === 'ingreso' && <FormIngreso inputRef={montoRef} onGuardado={onGuardado} />}
        </div>

        <Card component="section" aria-labelledby="sec-registrado-hoy" className="p-4">
          <Typography id="sec-registrado-hoy" variant="h6" className="mb-3">Registrado hoy</Typography>
          {!registros.length && (
            <Typography variant="body2" className="text-[var(--suave)]" style={{ textWrap: 'pretty' }}>
              Todavía no registrás nada hoy. Anotá tu primer gasto o ingreso a la izquierda 👈 y aparece en la lista al instante.
            </Typography>
          )}
          {registros.map((r, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-2 py-2.5"
              style={{ borderBottom: i < registros.length - 1 ? '1px solid var(--borde)' : 'none' }}
            >
              <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, flex: 'none', background: COLOR_TIPO[r.tipo] }} />
                <div style={{ minWidth: 0 }}>
                  <div className="text-sm font-semibold truncate">{r.cat}</div>
                  <div className="text-xs text-[var(--suave)]">{LABEL_TIPO[r.tipo]} · {r.cuenta}</div>
                </div>
              </div>
              <div className="font-bold whitespace-nowrap" style={{ color: COLOR_TIPO[r.tipo], fontVariantNumeric: 'tabular-nums' }}>
                {r.tipo === 'ingreso' ? '+' : '−'}{fmtQ(r.monto)}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
