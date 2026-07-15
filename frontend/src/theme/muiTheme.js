import { createTheme } from '@mui/material/styles';
import { PALETA } from './colores.js';

// getTheme(modo) — 'light' | 'dark', misma paleta de marca que index.css
// (crema/tinta), no el azul default de Material. CssBaseline usa esto como
// único reset de box-model (ver index.css — el preflight de Tailwind está
// apagado a propósito para no competir con CssBaseline).
export function getTheme(modo) {
  const p = PALETA[modo];
  return createTheme({
    palette: {
      mode: modo,
      background: { default: p.fondo, paper: p.panel },
      text: { primary: p.texto, secondary: p.suave },
      divider: p.borde,
      primary: { main: p.primario, contrastText: p.primarioTexto },
      error: { main: p.gasto },
      success: { main: p.ingreso },
      warning: { main: p.pago },
    },
    shape: { borderRadius: 14 },
    typography: {
      fontFamily: "'Poppins', system-ui, -apple-system, 'Segoe UI', sans-serif",
      button: { textTransform: 'none', fontWeight: 700 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: { border: `1px solid ${p.borde}`, backgroundImage: 'none' },
        },
      },
      MuiButton: {
        styleOverrides: { root: { borderRadius: 999 } },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600 } },
      },
    },
  });
}
