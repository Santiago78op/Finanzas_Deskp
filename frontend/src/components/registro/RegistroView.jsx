import { useRef, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import TrendingDownIcon from '@mui/icons-material/TrendingDownOutlined';
import TrendingUpIcon from '@mui/icons-material/TrendingUpOutlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import AvisoSalario from './AvisoSalario.jsx';
import FormGasto from './FormGasto.jsx';
import FormPago from './FormPago.jsx';
import FormIngreso from './FormIngreso.jsx';
import { fmtQ } from '../../utils.js';
import { tipoBtnEstilo } from './campoStyles.js';
import { tabularNums, puntoAcento, bordeFilaLista } from '../shared/estilos.js';

const COLOR_TIPO = { gasto: 'var(--gasto)', ingreso: 'var(--ingreso)', pago: 'var(--pago)' };
const LABEL_TIPO = { gasto: 'Gasto', ingreso: 'Ingreso', pago: 'Pago' };
const TIPOS = [
  { key: 'gasto', label: 'Gasto', Icon: TrendingDownIcon },
  { key: 'ingreso', label: 'Ingreso', Icon: TrendingUpIcon },
  { key: 'pago', label: 'Pago', Icon: ScheduleIcon },
];

// "Nuevo movimiento": una sola Card con el selector de tipo adentro (antes
// eran 3 botones grandes afuera) + los campos del form activo — layout que
// pide FinanzasQ.dc.html (Claude Design). "Registrado hoy" a la derecha es
// una lista local de lo guardado en la sesión (cada Form* llama onGuardado
// además de su toast() de siempre).
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

      <div className="registro-grid">
        <Card component="section" aria-labelledby="sec-nuevo-mov" className="p-6 flex flex-col gap-4">
          <Typography id="sec-nuevo-mov" variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Nuevo movimiento</Typography>

          <div className="flex gap-2">
            {TIPOS.map(t => (
              <button
                key={t.key} type="button" onClick={() => elegirTipo(t.key)}
                style={tipoBtnEstilo(tipo === t.key, COLOR_TIPO[t.key])}
              >
                <t.Icon style={{ fontSize: 16 }} />{t.label}
              </button>
            ))}
          </div>

          {tipo === 'gasto' && <FormGasto inputRef={montoRef} onGuardado={onGuardado} />}
          {tipo === 'pago' && <FormPago inputRef={montoRef} onGuardado={onGuardado} />}
          {tipo === 'ingreso' && <FormIngreso inputRef={montoRef} onGuardado={onGuardado} />}
        </Card>

        <Card component="section" aria-labelledby="sec-registrado-hoy" className="p-5">
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
              style={bordeFilaLista(i === registros.length - 1)}
            >
              <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
                <span style={puntoAcento(COLOR_TIPO[r.tipo], 8)} />
                <div style={{ minWidth: 0 }}>
                  <div className="text-sm font-semibold truncate">{r.cat}</div>
                  <div className="text-xs text-[var(--suave)]">{LABEL_TIPO[r.tipo]} · {r.cuenta}</div>
                </div>
              </div>
              <div className="font-bold whitespace-nowrap" style={{ color: COLOR_TIPO[r.tipo], ...tabularNums }}>
                {r.tipo === 'ingreso' ? '+' : '−'}{fmtQ(r.monto)}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
