import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import SideNav from './SideNav.jsx';
import TickerGlobal from './TickerGlobal.jsx';
import Footer from './Footer.jsx';

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

// Marco de la app (antes vivía inline en App.jsx): sidebar + header + <Outlet/>
// de react-router. El título/subtítulo salen del pathname en vez de un
// estado de vista propio — cada ruta ya sabe quién es.
export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const vista = location.pathname.replace('/', '') || 'dashboard';

  return (
    <Box id="app" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <TickerGlobal />

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav />

        <Box id="contenido" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Container maxWidth="lg" component="main" sx={{ flex: 1 }}>
            {/* header propio de <main>: título + la pregunta que resuelve la
                vista activa, y el atajo "Registrar" (no el header de sitio —
                ese ahora es el sidebar). Un <main> puede anidar su propio
                <header> sin problema. */}
            <header id="topbar" className="pt-7 pb-4 flex items-end justify-between gap-5 flex-wrap">
              <div>
                <h1 id="titulo-vista">{TITULOS[vista]}</h1>
                <div className="saludo">{SUBTITULOS[vista]}</div>
              </div>
              {vista !== 'registro' && (
                <Button
                  variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/registro')}
                  sx={{ flex: 'none', bgcolor: 'var(--primario)', color: 'var(--primario-texto)', '&:hover': { bgcolor: 'var(--primario)', opacity: .9 } }}
                >
                  Registrar
                </Button>
              )}
            </header>

            <div className="py-6">
              <Outlet />
            </div>
          </Container>
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}
