import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
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

// Subtítulo = "la pregunta que resuelve" cada vista (FinanzasQ.dc.html,
// Claude Design) — reemplaza el saludo genérico de antes.
const SUBTITULOS = {
  dashboard: '¿Cómo vas con tu dinero hoy?', registro: 'Anotá un gasto o ingreso en segundos.',
  cuentas: '¿Cuánto dinero tenés y dónde está?', tarjetas: '¿Cuánto debés y cuándo corta?',
  analisis: '¿En qué se te va el dinero?', movimientos: 'Todo lo que registraste, con filtros.',
  ajustes: 'Categorías, recurrentes, Notion y respaldo.',
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

  return (
    <Box id="app" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <TickerGlobal />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav vista={activa} onNavigate={navegar} />

        <Box id="contenido" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Container maxWidth="lg" component="main" sx={{ flex: 1 }}>
            {/* header propio de <main>: título + la pregunta que resuelve la
                vista activa, y el atajo "Registrar" (no el header de sitio —
                ese ahora es el sidebar). Un <main> puede anidar su propio
                <header> sin problema. */}
            <header id="topbar" className="pt-7 pb-4 flex items-end justify-between gap-5 flex-wrap">
              <div>
                <h1 id="titulo-vista">{TITULOS[activa]}</h1>
                <div className="saludo">{SUBTITULOS[activa]}</div>
              </div>
              {activa !== 'registro' && (
                <Button
                  variant="contained" startIcon={<AddIcon />} onClick={() => navegar('registro')}
                  sx={{ flex: 'none', bgcolor: 'var(--primario)', color: 'var(--primario-texto)', '&:hover': { bgcolor: 'var(--primario)', opacity: .9 } }}
                >
                  Registrar
                </Button>
              )}
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
