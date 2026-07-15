import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import MesSelector from './MesSelector.jsx';
import Metricas from './Metricas.jsx';
import PanelSalario from './PanelSalario.jsx';
import PanelAnalisis from './PanelAnalisis.jsx';
import GraficaBarras from './GraficaBarras.jsx';
import GraficaPastel from './GraficaPastel.jsx';
import GraficaPatrimonio from './GraficaPatrimonio.jsx';
import GraficaMetodo from './GraficaMetodo.jsx';
import GraficaTendencia from './GraficaTendencia.jsx';
import GraficaUsoTarjetas from './GraficaUsoTarjetas.jsx';
import AccountCard from '../shared/AccountCard.jsx';
import CreditCard from '../shared/CreditCard.jsx';
import GridOCarrusel from '../shared/GridOCarrusel.jsx';
import { api } from '../../api.js';
import { fmtQ } from '../../utils.js';
import { useTheme } from '../../hooks/useTheme.jsx';
import { useDashboardReveal } from '../../hooks/useDashboardReveal.js';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { motionOK } from '../../motion.js';

export default function DashboardView() {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [d, setD] = useState(null);
  const { tema } = useTheme();
  const { version } = useDataVersion();
  const rootRef = useRef(null);
  useDashboardReveal(rootRef, motionOK, [d]);

  // `version` en las deps: si el usuario se queda en Dashboard y algo
  // dispara una mutación (guardar un gasto, confirmar un pendiente), los
  // números se refrescan solos sin necesidad de salir y volver a entrar.
  const cargar = useCallback(async () => {
    setD(await api(`/api/dashboard?anio=${anio}&mes=${mes}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes, version]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarMes = (delta) => {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAnio(a);
  };

  if (!d) return null;

  return (
    <div id="vista-dashboard" className="vista" ref={rootRef}>
      <MesSelector anio={anio} mes={mes} onCambiar={cambiarMes} />

      {d.deuda_supera_ingresos && (
        <div className="banner-alerta">
          ⚠️ Tu deuda en tarjetas ({fmtQ(d.deuda_total)}) rebasa tus ingresos del mes ({fmtQ(d.ingresos)})
        </div>
      )}

      <Metricas d={d} />
      <PanelSalario d={d} />

      <div className="paneles-graficas">
        <Card className="p-4">
          <Typography variant="h6" className="mb-2">Ingresos vs Gastos ({anio})</Typography>
          <GraficaBarras d={d} tema={tema} />
        </Card>
        <Card className="p-4">
          <Typography variant="h6" className="mb-2">Gastos por categoría del mes</Typography>
          <GraficaPastel d={d} tema={tema} />
        </Card>
      </div>

      <Card className="p-4">
        <Typography variant="h6" className="mb-2">Evolución del patrimonio (últimos 12 meses)</Typography>
        <GraficaPatrimonio d={d} tema={tema} />
      </Card>

      <div className="paneles-graficas">
        <Card className="p-4">
          <Typography variant="h6" className="mb-2">Gastos por método de pago del mes</Typography>
          <GraficaMetodo d={d} tema={tema} />
        </Card>
        <Card className="p-4">
          <Typography variant="h6" className="mb-2">Tendencia de tus top categorías (6 meses)</Typography>
          <GraficaTendencia d={d} tema={tema} />
        </Card>
      </div>

      <Card className="p-4">
        <Typography variant="h6" className="mb-3">Mis cuentas (¿cuánto dinero tengo?)</Typography>
        <GridOCarrusel
          items={d.cuentas}
          vacio="Sin cuentas registradas. Agregalas en la pestaña Bancos para saber cuánto dinero tenés."
          render={c => <AccountCard cuenta={c} />}
        />
        {d.cuentas.length > 0 && (
          <div className="flex justify-between mt-3 pt-3 border-t border-[var(--borde)]">
            <span><b>Total</b></span><b>{fmtQ(d.dinero_total)}</b>
          </div>
        )}
      </Card>

      <Card className="p-4">
        <Typography variant="h6" className="mb-2">Tarjetas</Typography>
        <GraficaUsoTarjetas d={d} tema={tema} />
        <div className="mt-3">
          <GridOCarrusel
            items={d.tarjetas}
            vacio="Sin tarjetas registradas. Agregalas en la pestaña Tarjetas."
            render={t => <CreditCard tarjeta={t} />}
          />
        </div>
      </Card>

      <Card className="p-4">
        <Typography variant="h6" className="mb-2">Análisis del mes (¿en qué gasto más?)</Typography>
        <PanelAnalisis d={d} />
      </Card>
    </div>
  );
}
