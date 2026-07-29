import { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Drawer from '@mui/material/Drawer';
import AddIcon from '@mui/icons-material/AddOutlined';
import SideNav, { SideNavContenido } from './SideNav.jsx';
import Footer from './Footer.jsx';
import { TopbarExtraProvider, useTopbarExtra } from '../../context/TopbarExtraContext.jsx';
import { varsPagina } from '../../motion.js';

const TITULOS = {
  dashboard: 'Dashboard', registro: 'Registro rápido', cuentas: 'Mis cuentas',
  tarjetas: 'Tarjetas', prestamos: 'Préstamos', ahorros: 'Ahorros',
  analisis: 'Análisis', movimientos: 'Movimientos', ajustes: 'Ajustes y datos',
};

// Subtítulo = "la pregunta que resuelve" cada vista (FinanzasQ.dc.html,
// Claude Design) — reemplaza el saludo genérico de antes.
const SUBTITULOS = {
  dashboard: '¿Cómo vas con tu dinero hoy?', registro: 'Anotá un gasto o ingreso en segundos.',
  cuentas: '¿Cuánto dinero tenés y dónde está?', tarjetas: '¿Cuánto debés y cuándo corta?',
  prestamos: 'Tus préstamos y Visa Cuotas, en un solo lugar.',
  ahorros: '¿Cuánto tenés apartado y cuánto podés apartar?',
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
  const [menuAbierto, setMenuAbierto] = useState(false);

  // Cierra el drawer solo al cambiar de ruta (además del onNavigate de cada
  // link) — red de seguridad si algo dispara la navegación sin pasar por ahí.
  useEffect(() => { setMenuAbierto(false); }, [location.pathname]);

  return (
    <Box id="app" sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden' }}>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SideNav />

        {/* Sidebar en mobile (<md): mismo contenido, como Drawer superpuesto
            en vez de columna fija — ver plan de responsive. */}
        <Drawer
          variant="temporary" open={menuAbierto} onClose={() => setMenuAbierto(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { width: 252, background: 'var(--panel)' } }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '22px 16px' }}>
            {/* idPastilla propio: el sidebar de escritorio sigue montado
                (keepMounted) y compartir layoutId haría saltar la pastilla
                entre los dos. */}
            <SideNavContenido onNavigate={() => setMenuAbierto(false)} idPastilla="nav-pastilla-movil" />
          </Box>
        </Drawer>

        <Box id="contenido" sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Container maxWidth="lg" component="main" sx={{ flex: 1 }}>
            {/* header propio de <main>: título + la pregunta que resuelve la
                vista activa, y a la derecha el selector de mes (si la vista
                activa lo provee vía TopbarExtraContext) + "Registrar" — todo
                en la misma fila, como en FinanzasQ.dc.html (Claude Design).
                Un <main> puede anidar su propio <header> sin problema. */}
            <header id="topbar" className="pt-7 pb-4 flex items-end justify-between gap-5 flex-wrap">
              <div className="flex items-center gap-3">
                <IconButton
                  aria-label="Abrir menú" onClick={() => setMenuAbierto(true)}
                  sx={{ display: { xs: 'inline-flex', md: 'none' }, color: 'var(--texto)' }}
                >
                  <svg className="ico" style={{ width: 22, height: 22 }}><use href="#ico-menu" /></svg>
                </IconButton>
                {/* Lámina del encabezado. La ilustración es naranja de trazo
                    redondeado y no comparte paleta con el sistema, así que en
                    vez de pegarla suelta va montada como una FIGURA de informe:
                    placa con filete de 1px y esquina de 12px. Así se lee como
                    una imagen impresa dentro de la maqueta y no como un clipart
                    flotando.
                    El <img> va MÁS GRANDE que la placa y centrado con overflow
                    oculto: el archivo original (360×360) trae un margen muerto
                    enorme alrededor del dibujo, así que a tamaño natural el
                    motivo quedaba diminuto y se leía como un borrón. Escalarlo
                    y recortar ese aire es lo que lo hace legible a 68px.
                    Se oculta en mobile: ahí el ancho es para el título. */}
                <span
                  aria-hidden="true"
                  className="hidden sm:block shrink-0 relative overflow-hidden"
                  style={{
                    width: 68, height: 68,
                    borderRadius: 'var(--radio)', border: '1px solid var(--borde)',
                  }}
                >
                  <img
                    src="/static/img/motivo-finanzas.png"
                    alt=""
                    style={{
                      position: 'absolute', width: 96, height: 96,
                      top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                      maxWidth: 'none',
                    }}
                  />
                </span>
                <div>
                  <h1 id="titulo-vista">{TITULOS[vista]}</h1>
                  <div className="saludo">{SUBTITULOS[vista]}</div>
                </div>
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

            {/* Transición de vista, ahora con SALIDA de verdad: <AnimatePresence
                mode="wait"> retiene la vista vieja hasta que termina su exit y
                recién ahí monta la nueva. Antes (RouteFade + GSAP) solo se
                podía animar la entrada, porque react-router desmonta la vista
                anterior de inmediato y no quedaba nada que animar — el cambio
                de pantalla "cortaba" en seco. `initial={false}` para que la
                primera carga de la app no haga fade (ya la hace el reveal de
                cada vista): la animación es para NAVEGAR, no para arrancar. */}
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={vista}
                className="py-6"
                variants={varsPagina}
                initial="oculto" animate="visible" exit="saliendo"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </Container>
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}
