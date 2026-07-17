import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/AddOutlined';
import SideNav from './SideNav.jsx';
import Footer from './Footer.jsx';
import { TopbarExtraProvider, useTopbarExtra } from '../../context/TopbarExtraContext.jsx';

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
  return (
    <TopbarExtraProvider>
      <LayoutInner />
    </TopbarExtraProvider>
  );
}

function LayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const vista = location.pathname.replace('/', '') || 'dashboard';
  const { extra } = useTopbarExtra();

  return (
    <Box id="app" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav />

        <Box id="contenido" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Container maxWidth="lg" component="main" sx={{ flex: 1 }}>
            {/* header propio de <main>: título + la pregunta que resuelve la
                vista activa, y a la derecha el selector de mes (si la vista
                activa lo provee vía TopbarExtraContext) + "Registrar" — todo
                en la misma fila, como en FinanzasQ.dc.html (Claude Design).
                Un <main> puede anidar su propio <header> sin problema. */}
            <header id="topbar" className="pt-7 pb-4 flex items-end justify-between gap-5 flex-wrap">
              <div>
                <h1 id="titulo-vista">{TITULOS[vista]}</h1>
                <div className="saludo">{SUBTITULOS[vista]}</div>
              </div>
              <div className="flex items-center gap-3">
                {extra}
                {vista !== 'registro' && (
                  <Button
                    variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/registro')}
                    sx={{ flex: 'none', bgcolor: 'var(--primario)', color: 'var(--primario-texto)', '&:hover': { bgcolor: 'var(--primario)', opacity: .9 } }}
                  >
                    Registrar
                  </Button>
                )}
              </div>
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
