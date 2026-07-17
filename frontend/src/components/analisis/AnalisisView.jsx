import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import MesSelector from '../dashboard/MesSelector.jsx';
import PanelAnalisis from '../dashboard/PanelAnalisis.jsx';
import GraficaPastel from './GraficaPastel.jsx';
import GraficaMetodo from './GraficaMetodo.jsx';
import GraficaBarras from './GraficaBarras.jsx';
import GraficaTendencia from './GraficaTendencia.jsx';
import GraficaPatrimonio from './GraficaPatrimonio.jsx';
import GraficaUsoTarjetas from './GraficaUsoTarjetas.jsx';
import { getDashboard } from '../../api/dashboard.js';
import { useTopbarExtra } from '../../context/TopbarExtraContext.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { fmtQ, MESES } from '../../utils.js';

// Análisis con vista propia (antes era la última sección del Dashboard) —
// split que pide FinanzasQ.dc.html (Claude Design). Mismo fetch a
// /api/dashboard que ya usa DashboardView + su propio MesSelector. Las
// gráficas de Chart.js (huérfanas desde el rediseño, ver
// components/dashboard/Grafica*.jsx original) vivían del dashboard denso
// anterior — el backend nunca dejó de mandar sus datos, así que se
// reconectan acá a pedido, con su propia Card cada una.
export default function AnalisisView() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [d, setD] = useState(null);
  const { setExtra } = useTopbarExtra();
  const { tema } = useTheme();

  const cargar = useCallback(async () => {
    setD(await getDashboard(anio, mes));
  }, [anio, mes]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarMes = (delta) => {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAnio(a);
  };

  // Selector de mes vive en el topbar (junto a "Registrar"), no en el cuerpo
  // de la vista — ver FinanzasQ.dc.html (Claude Design).
  useEffect(() => {
    setExtra(<MesSelector anio={anio} mes={mes} onCambiar={cambiarMes} />);
    return () => setExtra(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes]);

  if (!d) return null;

  return (
    <div id="vista-analisis" className="vista flex flex-col gap-4">
      <Card component="section" aria-label="Total gastado" className="p-5">
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

      <Card component="section" aria-labelledby="sec-analisis" className="p-5">
        <Typography id="sec-analisis" variant="h6" className="mb-2">¿En qué gasto más?</Typography>
        <PanelAnalisis d={d} />
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card component="section" aria-labelledby="sec-pastel" className="p-5">
          <Typography id="sec-pastel" variant="h6" className="mb-2">Gasto por categoría</Typography>
          <div style={{ height: 280 }}><GraficaPastel d={d} tema={tema} /></div>
        </Card>
        <Card component="section" aria-labelledby="sec-metodo" className="p-5">
          <Typography id="sec-metodo" variant="h6" className="mb-2">Gasto por método de pago</Typography>
          <div style={{ height: 280 }}><GraficaMetodo d={d} tema={tema} /></div>
        </Card>
      </div>

      <Card component="section" aria-labelledby="sec-barras" className="p-5">
        <Typography id="sec-barras" variant="h6" className="mb-2">Ingresos vs. gastos por mes ({anio})</Typography>
        <div style={{ height: 300 }}><GraficaBarras d={d} tema={tema} /></div>
      </Card>

      <Card component="section" aria-labelledby="sec-tendencia" className="p-5">
        <Typography id="sec-tendencia" variant="h6" className="mb-2">Tendencia de tus categorías principales (6 meses)</Typography>
        <div style={{ height: 300 }}><GraficaTendencia d={d} tema={tema} /></div>
      </Card>

      <Card component="section" aria-labelledby="sec-patrimonio" className="p-5">
        <Typography id="sec-patrimonio" variant="h6" className="mb-2">Evolución del patrimonio (12 meses)</Typography>
        <div style={{ height: 300 }}><GraficaPatrimonio d={d} tema={tema} /></div>
      </Card>

      {d.tarjetas.length >= 2 && (
        <Card component="section" aria-labelledby="sec-uso-tarjetas" className="p-5">
          <Typography id="sec-uso-tarjetas" variant="h6" className="mb-2">Uso de tus tarjetas</Typography>
          <div style={{ height: 200 }}><GraficaUsoTarjetas d={d} tema={tema} /></div>
        </Card>
      )}
    </div>
  );
}
