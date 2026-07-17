import { useCallback, useEffect, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Box from '@mui/material/Box';
import MesSelector from '../dashboard/MesSelector.jsx';
import PanelAnalisis from '../dashboard/PanelAnalisis.jsx';
import GraficaPastel from './GraficaPastel.jsx';
import GraficaMetodo from './GraficaMetodo.jsx';
import GraficaBarras from './GraficaBarras.jsx';
import GraficaTendencia from './GraficaTendencia.jsx';
import GraficaPatrimonio from './GraficaPatrimonio.jsx';
import GraficaUsoTarjetas from './GraficaUsoTarjetas.jsx';
import GraficaEndeudamiento from './GraficaEndeudamiento.jsx';
import GraficaPagosMensuales from './GraficaPagosMensuales.jsx';
import { getDashboard } from '../../api/dashboard.js';
import { useTopbarExtra } from '../../context/TopbarExtraContext.jsx';
import { useTheme } from '../../hooks/useTheme.jsx';
import { fmtQ, MESES } from '../../utils.js';

// Análisis con vista propia (antes era la última sección del Dashboard) —
// split que pide FinanzasQ.dc.html (Claude Design). Mismo fetch a
// /api/dashboard que ya usa DashboardView + su propio MesSelector.
//
// Con las 6 gráficas de Chart.js reconectadas (huérfanas desde el rediseño,
// el backend nunca dejó de mandar sus datos) la vista quedaba con 8 cards
// apiladas verticalmente — a pedido del usuario, se organiza en pestañas
// (mismo patrón que AjustesView) y cada pestaña usa el grid de 12 columnas
// del Dashboard (.dash-grid/.dash-span-N) en vez de apilar todo full-width.
export default function AnalisisView() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [d, setD] = useState(null);
  const [tab, setTab] = useState(0);
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

  const hayTarjetas = d.tarjetas.length >= 2;
  const hayDeudas = d.tarjetas.length > 0 || d.prestamos.length > 0 || d.visacuotas.length > 0;
  const PESTANAS = ['Resumen', 'Tendencias', ...(hayTarjetas ? ['Tarjetas'] : []), ...(hayDeudas ? ['Deudas'] : [])];

  const e = d.endeudamiento;
  const deudaTotalGeneral = e.tarjetas + e.prestamos + e.visacuotas;
  const pagoMensualTotal = e.pago_mensual_tarjetas + e.pago_mensual_prestamos + e.pago_mensual_visacuotas;
  const pctEndeudamiento = e.ingreso_mensual_referencia
    ? Math.round((deudaTotalGeneral / e.ingreso_mensual_referencia) * 100) : null;

  return (
    <div id="vista-analisis" className="vista">
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile>
          {PESTANAS.map((label, i) => <Tab key={label} label={label} value={i} />)}
        </Tabs>
      </Box>

      {tab === 0 && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <Card component="section" aria-label="Total gastado" className="p-5 dash-span-4">
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

          <Card component="section" aria-labelledby="sec-pastel" className="p-5 dash-span-4">
            <Typography id="sec-pastel" variant="h6" className="mb-2">Gasto por categoría</Typography>
            <div style={{ height: 220 }}><GraficaPastel d={d} tema={tema} /></div>
          </Card>

          <Card component="section" aria-labelledby="sec-metodo" className="p-5 dash-span-4">
            <Typography id="sec-metodo" variant="h6" className="mb-2">Gasto por método de pago</Typography>
            <div style={{ height: 220 }}><GraficaMetodo d={d} tema={tema} /></div>
          </Card>

          <Card component="section" aria-labelledby="sec-analisis" className="p-5 dash-span-12">
            <Typography id="sec-analisis" variant="h6" className="mb-2">¿En qué gasto más?</Typography>
            <PanelAnalisis d={d} />
          </Card>
        </div>
      )}

      {tab === 1 && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <Card component="section" aria-labelledby="sec-barras" className="p-5 dash-span-7">
            <Typography id="sec-barras" variant="h6" className="mb-2">Ingresos vs. gastos por mes ({anio})</Typography>
            <div style={{ height: 280 }}><GraficaBarras d={d} tema={tema} /></div>
          </Card>

          <Card component="section" aria-labelledby="sec-patrimonio" className="p-5 dash-span-5">
            <Typography id="sec-patrimonio" variant="h6" className="mb-2">Evolución del patrimonio (12 meses)</Typography>
            <div style={{ height: 280 }}><GraficaPatrimonio d={d} tema={tema} /></div>
          </Card>

          <Card component="section" aria-labelledby="sec-tendencia" className="p-5 dash-span-12">
            <Typography id="sec-tendencia" variant="h6" className="mb-2">Tendencia de tus categorías principales (6 meses)</Typography>
            <div style={{ height: 300 }}><GraficaTendencia d={d} tema={tema} /></div>
          </Card>
        </div>
      )}

      {tab === 2 && hayTarjetas && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <Card component="section" aria-labelledby="sec-uso-tarjetas" className="p-5 dash-span-12">
            <Typography id="sec-uso-tarjetas" variant="h6" className="mb-2">Uso de tus tarjetas</Typography>
            <div style={{ height: 200 }}><GraficaUsoTarjetas d={d} tema={tema} /></div>
          </Card>
        </div>
      )}

      {tab === PESTANAS.indexOf('Deudas') && hayDeudas && (
        <div className="dash-grid" style={{ marginTop: 0 }}>
          <Card component="section" aria-labelledby="sec-endeudamiento" className="p-5 dash-span-5">
            <Typography id="sec-endeudamiento" variant="h6" className="mb-2">Nivel de endeudamiento</Typography>
            <Typography variant="h4" fontWeight={700} letterSpacing="-.02em">{fmtQ(deudaTotalGeneral)}</Typography>
            <Typography variant="body2" className="text-[var(--suave)] mb-2">
              {pctEndeudamiento != null
                ? `= ${pctEndeudamiento}% de tu ingreso mensual`
                : 'Configurá un ingreso recurrente en Ajustes para ver este porcentaje.'}
            </Typography>
            <div style={{ height: 220 }}><GraficaEndeudamiento d={d} tema={tema} /></div>
          </Card>

          <Card component="section" aria-labelledby="sec-pagos-mensuales" className="p-5 dash-span-7">
            <Typography id="sec-pagos-mensuales" variant="h6" className="mb-2">Nivel de pagos mensuales</Typography>
            <Typography variant="body2" className="text-[var(--suave)] mb-2">
              Comprometido este mes: <strong>{fmtQ(pagoMensualTotal)}</strong>
            </Typography>
            <div style={{ height: 280 }}><GraficaPagosMensuales d={d} tema={tema} /></div>
          </Card>
        </div>
      )}
    </div>
  );
}
