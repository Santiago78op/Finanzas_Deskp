import { useState } from 'react';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { fmtQ } from '../../utils.js';
import { aplicarPlan } from '../../api/ahorros.js';
import { useToast } from '../shared/Toast.jsx';
import { useConfirm } from '../shared/ConfirmDialog.jsx';
import { tabularNums } from '../shared/estilos.js';

// "Cuánto apartar para cada cosa": el reparto concreto de la capacidad entre
// el fondo de emergencia y las metas. El orden de prioridad se explica en
// _plan_de_ahorro (app.py) y cada línea muestra su motivo, para que el número
// no salga de una caja negra.
export default function PanelPlan({ plan, onAplicado }) {
  const toast = useToast();
  const confirmar = useConfirm();
  const [aplicando, setAplicando] = useState(false);

  const { asignaciones, sin_asignar, cubre_metas_con_fecha, faltante, capacidad_mensual } = plan;

  if (capacidad_mensual <= 0 || !asignaciones.length) {
    return (
      <Card component="section" aria-labelledby="sec-plan" className="p-5 flex flex-col gap-2">
        <Typography id="sec-plan" variant="caption" className="antetitulo">Cuánto apartar</Typography>
        <Typography variant="body2" className="text-[var(--suave)] medida">
          {capacidad_mensual <= 0
            ? 'Sin margen para apartar todavía: primero tiene que quedar algo después de gastos y cuotas.'
            : 'Creá un fondo de emergencia o una meta y acá aparece cuánto conviene apartar en cada uno.'}
        </Typography>
      </Card>
    );
  }

  const total = asignaciones.reduce((s, a) => s + a.mensual, 0);

  const aplicar = async () => {
    const ok = await confirmar(
      `¿Apartar ${fmtQ(total)} repartidos en ${asignaciones.length} ${asignaciones.length === 1 ? 'ahorro' : 'ahorros'}?\nSe registra un aporte con la fecha de hoy en cada uno. No mueve dinero de tus cuentas.`,
    );
    if (!ok) return;
    setAplicando(true);
    try {
      await aplicarPlan();
      toast('Apartado según el plan ✓');
      onAplicado?.();
    } catch (err) { toast(err.message, true); }
    finally { setAplicando(false); }
  };

  return (
    <Card component="section" aria-labelledby="sec-plan" className="p-5 flex flex-col gap-3">
      <Typography id="sec-plan" variant="caption" className="antetitulo">Cuánto apartar en cada uno</Typography>

      <div className="flex flex-col">
        {asignaciones.map(a => (
          <div key={a.ahorro_id} className="flex items-baseline justify-between gap-3 py-2"
               style={{ borderBottom: '1px solid var(--borde)' }}>
            <div style={{ minWidth: 0 }}>
              <div className="text-[15px] truncate">{a.nombre}</div>
              <div className="text-[13px] text-[var(--suave)]">{a.motivo}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 16, fontWeight: 500, ...tabularNums }}>{fmtQ(a.mensual)}</div>
              <div className="text-[13px] text-[var(--suave)]" style={tabularNums}>
                {fmtQ(a.quincenal)} / quincena
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[15px] font-medium">Total al mes</span>
        <span style={{ fontSize: 18, fontWeight: 500, ...tabularNums }}>{fmtQ(total)}</span>
      </div>

      {sin_asignar > 0 && (
        <Typography variant="body2" className="text-[var(--suave)] medida">
          Te sobran {fmtQ(sin_asignar)} al mes después de cubrir todo. Podés subir una meta,
          agregar otra, o simplemente gastarlos con tranquilidad.
        </Typography>
      )}
      {cubre_metas_con_fecha === false && (
        <Typography variant="body2" className="text-[var(--baja)] medida">
          No alcanza para las metas con fecha: faltan {fmtQ(faltante)} al mes. El fondo de
          emergencia se atiende primero, así que alguna fecha se va a correr.
        </Typography>
      )}

      <Button variant="contained" onClick={aplicar} disabled={aplicando}
              sx={{ alignSelf: 'flex-start' }}>
        {aplicando ? 'Apartando…' : 'Apartar esto ahora'}
      </Button>
      <Typography variant="body2" className="text-[var(--suave)] medida">
        Registra un aporte de hoy en cada ahorro. No es automático ni se repite solo:
        lo corrés vos cuando cobrás.
      </Typography>
    </Card>
  );
}
