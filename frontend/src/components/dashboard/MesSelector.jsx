import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import { MESES } from '../../utils.js';

export default function MesSelector({ anio, mes, onCambiar }) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'center', gap: 2 }} className="mb-4">
      <IconButton size="small" onClick={() => onCambiar(-1)} aria-label="Mes anterior">
        <ArrowBackIosNewIcon fontSize="small" />
      </IconButton>
      <Typography variant="h5" fontWeight={800} letterSpacing="-.03em">{MESES[mes]} {anio}</Typography>
      <IconButton size="small" onClick={() => onCambiar(1)} aria-label="Mes siguiente">
        <ArrowForwardIosIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}
