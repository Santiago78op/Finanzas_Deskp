import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import { useTheme } from '../../hooks/useTheme.js';

const VISTAS = [
  { key: 'registro', titulo: 'Registro rápido', label: 'Registro' },
  { key: 'dashboard', titulo: 'Dashboard', label: 'Dashboard' },
  { key: 'movimientos', titulo: 'Movimientos', label: 'Movimientos' },
  { key: 'tarjetas', titulo: 'Bancos y tarjetas', label: 'Bancos' },
  { key: 'ajustes', titulo: 'Ajustes y datos', label: 'Ajustes' },
];

export { VISTAS };

export default function TopNav({ vista, onNavigate }) {
  const { tema, toggle } = useTheme();

  return (
    <AppBar position="sticky" color="default" elevation={0} sx={{ borderBottom: '1px solid var(--borde)' }}>
      <Toolbar className="gap-4 flex-wrap py-2">
        <Box className="flex items-center gap-2">
          <span className="inline-flex text-[var(--texto)]"><svg className="ico" style={{ width: 22, height: 22 }}><use href="#ico-billetera" /></svg></span>
          <span className="font-display text-lg tracking-wide hidden sm:inline">Finanzas<b className="font-sans font-normal text-[var(--suave)]">Q</b></span>
        </Box>
        <Box className="flex flex-wrap gap-1 flex-1">
          {VISTAS.map(v => (
            <Button
              key={v.key}
              size="small"
              variant={vista === v.key ? 'contained' : 'text'}
              color="primary"
              onClick={() => onNavigate(v.key, v.titulo)}
            >
              {v.label}
            </Button>
          ))}
        </Box>
        <IconButton title="Cambiar tema claro/oscuro" onClick={toggle} className="tema-btn">
          <svg className="ico icon-sol" style={{ width: 19, height: 19 }}><use href="#ico-sol" /></svg>
          <svg className="ico icon-luna" style={{ width: 19, height: 19 }}><use href="#ico-luna" /></svg>
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
