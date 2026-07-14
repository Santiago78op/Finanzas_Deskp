import TopNav from './components/shared/TopNav.jsx';
import TickerGlobal from './components/shared/TickerGlobal.jsx';
import RegistroView from './components/registro/RegistroView.jsx';
import DashboardView from './components/dashboard/DashboardView.jsx';
import MovimientosView from './components/movimientos/MovimientosView.jsx';
import TarjetasView from './components/tarjetas/TarjetasView.jsx';
import AjustesView from './components/ajustes/AjustesView.jsx';
import { useViewTransition } from './hooks/useViewTransition.js';
import { motionOK } from './motion.js';

const VISTA_INICIAL = () => {
  const hash = location.hash.replace('#', '');
  return ['registro', 'dashboard', 'movimientos', 'tarjetas', 'ajustes'].includes(hash)
    ? hash : 'registro';
};

const TITULOS = {
  registro: 'Registro rápido', dashboard: 'Dashboard', movimientos: 'Movimientos',
  tarjetas: 'Bancos y tarjetas', ajustes: 'Ajustes y datos',
};

function renderVista(nombre) {
  switch (nombre) {
    case 'registro': return <RegistroView />;
    case 'dashboard': return <DashboardView />;
    case 'movimientos': return <MovimientosView />;
    case 'tarjetas': return <TarjetasView />;
    case 'ajustes': return <AjustesView />;
    default: return null;
  }
}

export default function App() {
  const { activa, saliendo, refActiva, refSaliendo, navegar } = useViewTransition(VISTA_INICIAL(), motionOK);

  const fechaLarga = new Date().toLocaleDateString('es-GT',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div id="app">
      <TopNav vista={activa} onNavigate={navegar} />
      <TickerGlobal />

      <div id="contenido">
        <header id="topbar">
          <div>
            <div id="saludo" className="saludo">
              👋 Hola — {fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}
            </div>
            <h1 id="titulo-vista">{TITULOS[activa]}</h1>
          </div>
        </header>

        <main>
          {/* La vista saliente solo existe mientras se anima su salida — al
              terminar, useViewTransition la desmonta (no queda un nodo
              persistente con estilos inline residuales). key={saliendo} es
              crítico: sin ella, si el usuario navega rápido por 3+ vistas
              antes de que termine la salida (180ms), React reutiliza el
              MISMO nodo DOM para la nueva vista saliente en vez de crear uno
              fresco — justo el bug de "opacity pegada" que ya habíamos
              resuelto, pero reintroducido por faltar esta key. */}
          {saliendo && (
            <div className="vista-transicion" ref={refSaliendo} key={saliendo}>{renderVista(saliendo)}</div>
          )}
          <div className="vista-transicion" ref={refActiva} key={activa}>{renderVista(activa)}</div>
        </main>
      </div>
    </div>
  );
}
