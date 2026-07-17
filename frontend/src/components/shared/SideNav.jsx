import { NavLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import { useTheme } from '../../hooks/useTheme.jsx';

// Íconos outline (trazo 2px, sin relleno) del sprite en index.html — mismo
// lenguaje visual que FinanzasQ.dc.html (stroke, no MUI sólido). Se
// instancian con <svg class="ico"><use href="#ico-x"/></svg>, currentColor
// hereda el color del texto del botón (suave/texto según activo).
const VISTAS = [
  { key: 'dashboard', label: 'Dashboard', icono: 'dashboard' },
  { key: 'registro', label: 'Registro rápido', icono: 'registro' },
  { key: 'cuentas', label: 'Mis cuentas', icono: 'banco' },
  { key: 'tarjetas', label: 'Tarjetas', icono: 'tarjeta' },
  { key: 'analisis', label: 'Análisis', icono: 'barras' },
  { key: 'movimientos', label: 'Movimientos', icono: 'recibo' },
  { key: 'ajustes', label: 'Ajustes', icono: 'ajustes' },
];

export { VISTAS };

// Sidebar fijo (reemplaza el AppBar horizontal de antes) — mismo wordmark,
// mismo useTheme(), pero navegación vertical siguiendo el layout aprobado en
// FinanzasQ.dc.html (Claude Design). Movimientos y Ajustes se sumaron acá
// aunque el mockup no los dibuje: son funcionalidad real que ya se usa.
// Los items son <NavLink> reales (rutas de react-router, no un onClick que
// solo cambiaba un estado interno) — la URL cambia de verdad al navegar.
export default function SideNav() {
  const { toggle } = useTheme();

  return (
    <Box
      component="aside"
      sx={{
        width: 252, flex: 'none', display: 'flex', flexDirection: 'column',
        background: 'var(--panel)', borderRight: '1px solid var(--borde)',
        padding: '22px 16px', position: 'sticky', top: 0, minHeight: '100vh',
        alignSelf: 'stretch', overflowY: 'auto',
      }}
    >
      <Box className="flex items-center gap-2" sx={{ padding: '4px 8px 24px' }}>
        <span className="inline-flex text-[var(--texto)]">
          <svg className="ico" style={{ width: 26, height: 26 }}><use href="#ico-billetera" /></svg>
        </span>
        <span className="flex items-baseline gap-1" style={{ lineHeight: 1 }}>
          <span className="font-display" style={{ fontSize: 24, letterSpacing: '.02em' }}>Finanzas</span>
          <span style={{ fontSize: 19, fontWeight: 400, color: 'var(--suave)' }}>Q</span>
        </span>
      </Box>

      <Box component="nav" aria-label="Navegación principal" className="flex flex-col gap-1" sx={{ flex: 1 }}>
        {VISTAS.map(v => (
          <Button
            key={v.key}
            component={NavLink}
            to={`/${v.key}`}
            className={({ isActive }) => (isActive ? 'active' : undefined)}
            startIcon={<svg className="ico" style={{ width: 18, height: 18 }}><use href={`#ico-${v.icono}`} /></svg>}
            sx={{
              justifyContent: 'flex-start', gap: 1, px: 1.6, py: 1.1, borderRadius: '999px',
              fontWeight: 600, fontSize: 14.5, textAlign: 'left', textTransform: 'none',
              color: 'var(--suave)', backgroundColor: 'transparent',
              '&:hover': { backgroundColor: 'var(--panel-2)' },
              '&.active': { color: 'var(--texto)', backgroundColor: 'var(--panel-2)' },
            }}
          >
            {v.label}
          </Button>
        ))}
      </Box>

      <Box sx={{ borderTop: '1px solid var(--borde)', pt: 1.75, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Button
          onClick={toggle}
          className="tema-btn"
          sx={{
            justifyContent: 'flex-start', gap: 1.4, px: 1.6, py: 1.1, borderRadius: '999px',
            border: '1px solid var(--borde)', fontWeight: 600, fontSize: 13.5, textTransform: 'none',
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
    </Box>
  );
}
