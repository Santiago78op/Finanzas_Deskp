import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import SideNav from './components/shared/SideNav.jsx';
import TickerGlobal from './components/shared/TickerGlobal.jsx';
import Footer from './components/shared/Footer.jsx';
import RegistroView from './components/registro/RegistroView.jsx';
import DashboardView from './components/dashboard/DashboardView.jsx';
import MovimientosView from './components/movimientos/MovimientosView.jsx';
import CuentasView from './components/cuentas/CuentasView.jsx';
import TarjetasView from './components/tarjetas/TarjetasView.jsx';
import AnalisisView from './components/analisis/AnalisisView.jsx';
import AjustesView from './components/ajustes/AjustesView.jsx';
import { useViewTransition } from './hooks/useViewTransition.js';
import { motionOK } from './motion.js';

const VISTA_VALIDAS = ['dashboard', 'registro', 'cuentas', 'tarjetas', 'analisis', 'movimientos', 'ajustes'];

const VISTA_INICIAL = () => {
  const hash = location.hash.replace('#', '');
  return VISTA_VALIDAS.includes(hash) ? hash : 'dashboard';
};

const TITULOS = {
  dashboard: 'Dashboard', registro: 'Registro rápido', cuentas: 'Mis cuentas',
  tarjetas: 'Tarjetas', analisis: 'Análisis', movimientos: 'Movimientos',
  ajustes: 'Ajustes y datos',
};

function renderVista(nombre, navegar) {
  switch (nombre) {
    case 'dashboard': return <DashboardView onNavigate={navegar} />;
    case 'registro': return <RegistroView />;
    case 'cuentas': return <CuentasView />;
    case 'tarjetas': return <TarjetasView />;
    case 'analisis': return <AnalisisView />;
    case 'movimientos': return <MovimientosView />;
    case 'ajustes': return <AjustesView />;
    default: return null;
  }
}

export default function App() {
  const { activa, saliendo, refActiva, refSaliendo, navegar } = useViewTransition(VISTA_INICIAL(), motionOK);

  const fechaLarga = new Date().toLocaleDateString('es-GT',
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Box id="app" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <TickerGlobal />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav vista={activa} onNavigate={navegar} />

        <Box id="contenido" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Container maxWidth="lg" component="main" sx={{ flex: 1 }}>
            {/* header propio de <main>: el saludo + título de la vista activa
                (no el header de sitio — ese ahora es el sidebar). Un <main>
                puede anidar su propio <header> sin problema. */}
            <header id="topbar" className="pt-7 pb-0">
              <div id="saludo" className="saludo">
                👋 Hola — {fechaLarga.charAt(0).toUpperCase() + fechaLarga.slice(1)}
              </div>
              <h1 id="titulo-vista">{TITULOS[activa]}</h1>
            </header>

            {/* La vista saliente solo existe mientras se anima su salida — al
                terminar, useViewTransition la desmonta (no queda un nodo
                persistente con estilos inline residuales). key={saliendo} es
                crítico: sin ella, si el usuario navega rápido por 3+ vistas
                antes de que termine la salida (180ms), React reutiliza el
                MISMO nodo DOM para la nueva vista saliente en vez de crear uno
                fresco — justo el bug de "opacity pegada" que ya habíamos
                resuelto, pero reintroducido por faltar esta key. */}
            <div className="py-6">
              {saliendo && (
                <div className="vista-transicion" ref={refSaliendo} key={saliendo}>{renderVista(saliendo, navegar)}</div>
              )}
              <div className="vista-transicion" ref={refActiva} key={activa}>{renderVista(activa, navegar)}</div>
            </div>
          </Container>
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}
