import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import InsightsIcon from '@mui/icons-material/Insights';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import SettingsIcon from '@mui/icons-material/Settings';
import { useTheme } from '../../hooks/useTheme.jsx';

const VISTAS = [
  { key: 'dashboard', titulo: 'Dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { key: 'registro', titulo: 'Registro rápido', label: 'Registro rápido', Icon: AddCircleOutlineIcon },
  { key: 'cuentas', titulo: 'Mis cuentas', label: 'Mis cuentas', Icon: AccountBalanceIcon },
  { key: 'tarjetas', titulo: 'Tarjetas', label: 'Tarjetas', Icon: CreditCardIcon },
  { key: 'analisis', titulo: 'Análisis', label: 'Análisis', Icon: InsightsIcon },
  { key: 'movimientos', titulo: 'Movimientos', label: 'Movimientos', Icon: ReceiptLongIcon },
  { key: 'ajustes', titulo: 'Ajustes y datos', label: 'Ajustes', Icon: SettingsIcon },
];

export { VISTAS };

// Sidebar fijo (reemplaza el AppBar horizontal de antes) — mismo wordmark,
// mismo useTheme(), pero navegación vertical siguiendo el layout aprobado en
// FinanzasQ.dc.html (Claude Design). Movimientos y Ajustes se sumaron acá
// aunque el mockup no los dibuje: son funcionalidad real que ya se usa.
export default function SideNav({ vista, onNavigate }) {
  const { toggle } = useTheme();

  return (
    <Box
      component="aside"
      sx={{
        width: 252, flex: 'none', display: 'flex', flexDirection: 'column',
        background: 'var(--panel)', borderRight: '1px solid var(--borde)',
        padding: '22px 16px', position: 'sticky', top: 0, height: '100vh',
        overflowY: 'auto',
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
            onClick={() => onNavigate(v.key, v.titulo)}
            startIcon={<v.Icon fontSize="small" />}
            sx={{
              justifyContent: 'flex-start', gap: 1, px: 1.6, py: 1.1, borderRadius: '999px',
              fontWeight: 600, fontSize: 14.5, textAlign: 'left', textTransform: 'none',
              color: vista === v.key ? 'var(--tinta)' : 'var(--suave)',
              backgroundColor: vista === v.key ? 'var(--panel2)' : 'transparent',
              '&:hover': { backgroundColor: 'var(--panel2)' },
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
            color: 'var(--suave)', '&:hover': { color: 'var(--tinta)', backgroundColor: 'var(--panel2)' },
          }}
        >
          <svg className="ico icon-sol" style={{ width: 17, height: 17 }}><use href="#ico-sol" /></svg>
          <svg className="ico icon-luna" style={{ width: 17, height: 17 }}><use href="#ico-luna" /></svg>
          <span className="icon-sol">Modo claro</span>
          <span className="icon-luna">Modo oscuro</span>
        </Button>
        <Box className="flex items-center gap-2.5" sx={{ px: 0.5 }}>
          <span style={{
            width: 32, height: 32, borderRadius: 999, flex: 'none', background: 'var(--panel2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
            fontSize: 13, color: 'var(--tinta)',
          }}>Q</span>
          <div style={{ lineHeight: 1.3, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tinta)' }}>Cuenta personal</div>
            <div style={{ fontSize: 11.5, color: 'var(--suave)' }}>Solo vos ves esto</div>
          </div>
        </Box>
      </Box>
    </Box>
  );
}
