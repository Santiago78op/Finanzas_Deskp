import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import MesSelector from '../dashboard/MesSelector.jsx';
import PanelAnalisis from '../dashboard/PanelAnalisis.jsx';
import { api } from '../../api.js';
import { fmtQ, MESES } from '../../utils.js';

// Análisis con vista propia (antes era la última sección del Dashboard) —
// split que pide FinanzasQ.dc.html (Claude Design), para que tenga su propio
// ítem de sidebar. Mismo fetch a /api/dashboard que ya usa DashboardView
// (PanelAnalisis se reusa sin cambios de lógica) + su propio MesSelector,
// para no perder la posibilidad de revisar meses anteriores.
export default function AnalisisView() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [d, setD] = useState(null);

  const cargar = useCallback(async () => {
    setD(await api(`/api/dashboard?anio=${anio}&mes=${mes}`));
  }, [anio, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarMes = (delta) => {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAnio(a);
  };

  if (!d) return null;

  return (
    <div id="vista-analisis" className="vista flex flex-col gap-4">
      <MesSelector anio={anio} mes={mes} onCambiar={cambiarMes} />

      <Card component="section" aria-label="Total gastado" className="p-4">
        <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">
          Total gastado en {MESES[mes]}
        </Typography>
        <Typography variant="h4" fontWeight={700} letterSpacing="-.02em">{fmtQ(d.gastos)}</Typography>
        {d.analisis.gastos_mes_anterior > 0 && (
          <Typography variant="body2" className="text-[var(--suave)] mt-1">
            Mes anterior: {fmtQ(d.analisis.gastos_mes_anterior)}
          </Typography>
        )}
      </Card>

      <Card component="section" aria-labelledby="sec-analisis" className="p-4">
        <Typography id="sec-analisis" variant="h6" className="mb-2">¿En qué gasto más?</Typography>
        <PanelAnalisis d={d} />
      </Card>
    </div>
  );
}
