import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTickerNumber } from '../../hooks/useTickerNumber.js';
import { fmtQ } from '../../utils.js';

export default function PanelSalario({ d }) {
  const dias = d.dias_proximo_salario;
  const disponibleTexto = useTickerNumber(d.disponible_salario);
  const ritmo = dias ? fmtQ(Math.max(0, d.disponible_salario) / dias) + '/día' : '—';

  return (
    <Card component="section" aria-label="Resumen del salario" className="reveal-block p-5 mb-4">
      <Stack direction="row" flexWrap="wrap" gap={4} alignItems="center">
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Disponible del salario este mes</Typography>
          <Typography variant="h5" fontWeight={800} letterSpacing="-.03em">{disponibleTexto}</Typography>
        </div>
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Próximo salario</Typography>
          <Typography variant="h5" fontWeight={800} letterSpacing="-.03em">{dias === null ? '—' : dias === 0 ? '¡HOY!' : `en ${dias} días`}</Typography>
        </div>
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Ritmo diario disponible</Typography>
          <Typography variant="h5" fontWeight={800} letterSpacing="-.03em">{ritmo}</Typography>
        </div>
      </Stack>
    </Card>
  );
}
