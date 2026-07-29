import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'motion/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useTheme } from '../../hooks/useTheme.jsx';
import { RESORTE } from '../../motion.js';

// Íconos outline (trazo 2px, sin relleno) del sprite en index.html — mismo
// lenguaje visual que FinanzasQ.dc.html (stroke, no MUI sólido). Se
// instancian con <svg class="ico"><use href="#ico-x"/></svg>, currentColor
// hereda el color del texto del botón (suave/texto según activo).
const VISTAS = [
  { key: 'dashboard', label: 'Dashboard', icono: 'dashboard' },
  { key: 'registro', label: 'Registro rápido', icono: 'registro' },
  { key: 'cuentas', label: 'Mis cuentas', icono: 'banco' },
  { key: 'tarjetas', label: 'Tarjetas', icono: 'tarjeta' },
  { key: 'prestamos', label: 'Préstamos', icono: 'prestamo' },
  { key: 'analisis', label: 'Análisis', icono: 'barras' },
  { key: 'movimientos', label: 'Movimientos', icono: 'recibo' },
  { key: 'ajustes', label: 'Ajustes', icono: 'ajustes' },
];

export { VISTAS };

// Contenido del sidebar sin el wrapper de posicionamiento — lo consumen
// tanto el <aside> fijo de escritorio como el <Drawer> de mobile (mismo
// nav, mismo toggle de tema, mismo bloque de cuenta, un solo lugar de
// verdad). `onNavigate` es opcional: el Drawer lo usa para cerrarse solo
// al tocar un link; el sidebar de escritorio no lo necesita.
//
// `idPastilla` DEBE ser distinto en cada instancia: escritorio y Drawer están
// montados a la vez (keepMounted), y dos elementos vivos con el mismo layoutId
// hacen que Motion los trate como el MISMO elemento y la pastilla salte de un
// sidebar al otro.
export function SideNavContenido({ onNavigate, idPastilla = 'nav-pastilla' }) {
  const { toggle } = useTheme();
  const { pathname } = useLocation();
  // El activo se calcula acá (no con el render-prop de NavLink) porque
  // necesitamos saberlo para decidir si montamos la pastilla, y MUI Button no
  // deja pasar children-como-función.
  const vistaActiva = pathname.replace('/', '') || 'dashboard';

  return (
    <>
      <Box className="flex items-center gap-2" sx={{ padding: '4px 8px 24px' }}>
        <span className="inline-flex text-[var(--texto)]">
          <svg className="ico" style={{ width: 26, height: 26 }}><use href="#ico-billetera" /></svg>
        </span>
        <span className="flex items-baseline gap-1" style={{ lineHeight: 1 }}>
          <span className="font-display" style={{ fontSize: 26, letterSpacing: 0 }}>Finanzas</span>
          <span style={{ fontSize: 18, fontWeight: 400, color: 'var(--laton)' }}>Q</span>
        </span>
      </Box>

      <Box component="nav" aria-label="Navegación principal" className="flex flex-col gap-1" sx={{ flex: 1 }}>
        {VISTAS.map(v => {
          const activo = vistaActiva === v.key;
          return (
            <Button
              key={v.key}
              component={NavLink}
              to={`/${v.key}`}
              onClick={onNavigate}
              className={activo ? 'active' : undefined}
              startIcon={<svg className="ico" style={{ width: 18, height: 18 }}><use href={`#ico-${v.icono}`} /></svg>}
              sx={{
                position: 'relative', overflow: 'visible',
                justifyContent: 'flex-start', gap: 1, px: 1.6, py: 1.1, borderRadius: '8px',
                fontWeight: 500, fontSize: 15, textAlign: 'left', textTransform: 'none',
                color: 'var(--suave)', backgroundColor: 'transparent',
                // El fondo del activo ya no es un color de estado: es la
                // pastilla de abajo. Solo el hover sigue pintando fondo.
                '&:hover': { backgroundColor: activo ? 'transparent' : 'var(--panel-2)' },
                '&.active': { color: 'var(--texto)', backgroundColor: 'transparent' },
                // El ícono es hermano estático de la pastilla absoluta: sin
                // esto la pastilla se le pintaría encima.
                '& .MuiButton-startIcon': { position: 'relative', zIndex: 1 },
              }}
            >
              {/* Un ÚNICO fondo compartido entre los 8 links (mismo layoutId):
                  al cambiar de vista, Motion mide de dónde salió y a dónde va,
                  y lo desliza. No es un fade de dos fondos distintos — es la
                  misma pastilla moviéndose, que es lo que hace que el sidebar
                  se lea como un control y no como 8 botones sueltos. */}
              {activo && (
                <motion.span
                  layoutId={idPastilla}
                  transition={RESORTE}
                  aria-hidden="true"
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 8,
                    background: 'var(--panel-2)', zIndex: 0,
                  }}
                />
              )}
              <span style={{ position: 'relative', zIndex: 1 }}>{v.label}</span>
            </Button>
          );
        })}
      </Box>

      <Box sx={{ borderTop: '1px solid var(--borde)', pt: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button
          onClick={toggle}
          className="tema-btn"
          sx={{
            justifyContent: 'flex-start', gap: 1.4, px: 1.6, py: 1.1, borderRadius: '8px',
            border: '1px solid var(--borde)', fontWeight: 500, fontSize: 14, textTransform: 'none',
            color: 'var(--suave)', '&:hover': { color: 'var(--texto)', backgroundColor: 'var(--panel-2)' },
          }}
        >
          <svg className="ico icon-sol" style={{ width: 17, height: 17 }}><use href="#ico-sol" /></svg>
          <svg className="ico icon-luna" style={{ width: 17, height: 17 }}><use href="#ico-luna" /></svg>
          <span className="icon-sol">Modo claro</span>
          <span className="icon-luna">Modo oscuro</span>
        </Button>
        <Box className="flex items-center gap-2.5" sx={{ px: 0.5 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 999, flex: 'none', background: 'var(--panel-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            fontSize: 13, color: 'var(--texto)',
          }}>Q</span>
          <div style={{ lineHeight: 1.3, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--texto)' }}>Cuenta personal</div>
            <div style={{ fontSize: 11.5, color: 'var(--suave)' }}>Solo vos ves esto</div>
          </div>
        </Box>
      </Box>
    </>
  );
}

// Sidebar fijo de escritorio (reemplaza el AppBar horizontal de antes) —
// oculto por CSS bajo el breakpoint `md` (ver Layout.jsx: ahí vive el
// Drawer que lo reemplaza en mobile, mismo contenido vía SideNavContenido).
export default function SideNav() {
  return (
    <Box
      component="aside"
      sx={{
        width: 252, flex: 'none', flexDirection: 'column',
        background: 'var(--panel)', borderRight: '1px solid var(--borde)',
        padding: '22px 16px', position: 'sticky', top: 0, minHeight: '100vh',
        alignSelf: 'stretch', overflowY: 'auto',
        display: { xs: 'none', md: 'flex' },
      }}
    >
      <SideNavContenido />
    </Box>
  );
}
