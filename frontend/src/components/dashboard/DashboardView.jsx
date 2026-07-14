import { useCallback, useEffect, useRef, useState } from 'react';
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
import { api } from '../../api.js';
import { fmtQ } from '../../utils.js';
import { useTheme } from '../../hooks/useTheme.js';
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
        <div className="panel">
          <h3>Ingresos vs Gastos ({anio})</h3>
          <GraficaBarras d={d} tema={tema} />
        </div>
        <div className="panel">
          <h3>Gastos por categoría del mes</h3>
          <GraficaPastel d={d} tema={tema} />
        </div>
      </div>

      <div className="panel">
        <h3>Evolución del patrimonio (últimos 12 meses)</h3>
        <GraficaPatrimonio d={d} tema={tema} />
      </div>

      <div className="paneles-graficas">
        <div className="panel">
          <h3>Gastos por método de pago del mes</h3>
          <GraficaMetodo d={d} tema={tema} />
        </div>
        <div className="panel">
          <h3>Tendencia de tus top categorías (6 meses)</h3>
          <GraficaTendencia d={d} tema={tema} />
        </div>
      </div>

      <div className="panel">
        <h3>Mis cuentas (¿cuánto dinero tengo?)</h3>
        <div className="cuentas-grid">
          {!d.cuentas.length && <p className="texto-suave">Sin cuentas registradas. Agregalas en la pestaña Bancos para saber cuánto dinero tenés.</p>}
          {d.cuentas.map(c => <AccountCard key={c.id} cuenta={c} />)}
          {d.cuentas.length > 0 && (
            <div className="analisis-fila" style={{ gridColumn: '1/-1' }}>
              <span><b>Total</b></span><b>{fmtQ(d.dinero_total)}</b>
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Tarjetas</h3>
        <GraficaUsoTarjetas d={d} tema={tema} />
        <div className="tarjetas-grid">
          {!d.tarjetas.length && <p className="texto-suave">Sin tarjetas registradas. Agregalas en la pestaña Tarjetas.</p>}
          {d.tarjetas.map(t => <CreditCard key={t.id} tarjeta={t} />)}
        </div>
      </div>

      <div className="panel">
        <h3>Análisis del mes (¿en qué gasto más?)</h3>
        <PanelAnalisis d={d} />
      </div>
    </div>
  );
}
