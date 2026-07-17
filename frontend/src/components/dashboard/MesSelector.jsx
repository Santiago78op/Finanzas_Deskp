import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { MESES } from '../../utils.js';

// Pill en el topbar (junto a "Registrar"), como en FinanzasQ.dc.html —
// antes era una fila propia centrada con flechas grandes. El mockup usa un
// selector estático de solo lectura; acá mantenemos la navegación real
// (mes anterior/siguiente) pero dentro de la misma pill compacta.
export default function MesSelector({ anio, mes, onCambiar }) {
  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center', gap: .5, borderRadius: '999px',
        border: '1px solid var(--borde)', background: 'var(--panel)',
        pl: .5, pr: 1.5, py: .5,
      }}
    >
      <IconButton size="small" onClick={() => onCambiar(-1)} aria-label="Mes anterior">
        <ArrowBackIosNewIcon sx={{ fontSize: 13 }} />
      </IconButton>
      <Typography sx={{ fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' }}>{MESES[mes]} {anio}</Typography>
      <IconButton size="small" onClick={() => onCambiar(1)} aria-label="Mes siguiente">
        <ArrowForwardIosIcon sx={{ fontSize: 13 }} />
      </IconButton>
    </Stack>
  );
}
