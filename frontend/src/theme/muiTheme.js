import { createTheme } from '@mui/material/styles';
import { PALETA } from './colores.js';

// getTheme(modo) — 'light' | 'dark', misma paleta sobrio-editorial que
// index.css (hueso/marino/petróleo), no el azul default de Material.
// CssBaseline usa esto como único reset de box-model (ver index.css — el
// preflight de Tailwind está apagado a propósito para no competir).
//
// Las tres decisiones de forma del sistema viven acá para que TODO componente
// de MUI las herede sin repetir sx en cada archivo:
//   · 12px de radio en superficies, 8px en controles
//   · cero sombras (la jerarquía la da el filete de 1px y el aire)
//   · Inter 400/500 — sin 600/700, que es lo que hacía que la UI se leyera
//     "app" y no "informe"
export function getTheme(modo) {
  const p = PALETA[modo];

  // MUI trae 25 niveles de elevación; el diseño no usa ninguno.
  const sinSombras = Array(25).fill('none');

  return createTheme({
    palette: {
      mode: modo,
      background: { default: p.fondo, paper: p.panel },
      text: { primary: p.texto, secondary: p.suave },
      divider: p.borde,
      primary: { main: p.primario, contrastText: p.primarioTexto },
      error: { main: p.gasto },
      success: { main: p.ingreso },
      warning: { main: p.laton },
    },
    shape: { borderRadius: 12 },
    shadows: sinSombras,
    typography: {
      fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
      fontSize: 16,
      htmlFontSize: 16,
      h4: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: 0 },
      h5: { fontFamily: "'Instrument Serif', Georgia, serif", fontWeight: 400, letterSpacing: 0 },
      h6: { fontWeight: 500, letterSpacing: 0 },
      body1: { fontSize: 16, lineHeight: 1.65 },
      body2: { fontSize: 15, lineHeight: 1.6 },
      // Los antetítulos del sistema: 11px, mayúsculas, tracking abierto.
      caption: { fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', fontWeight: 500 },
      button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            border: `1px solid ${p.borde}`,
            backgroundImage: 'none',
            borderRadius: 12,
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiButton: {
        disableElevation: true,
        styleOverrides: {
          // 8px: los controles llevan la esquina chica, las tarjetas la grande.
          // Antes eran píldoras de 999px, que es justo el lenguaje "app" que
          // este diseño evita.
          root: { borderRadius: 8 },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } },
      },
      MuiOutlinedInput: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
      // MuiFormHelperText hereda typography.caption, que acá es el antetítulo
      // (11px, MAYÚSCULAS, tracking .14em). Un texto de ayuda de formulario no
      // es un antetítulo: "Del resumen del banco. Opcional" en versalitas es
      // ilegible. Se le devuelve la caja baja.
      MuiFormHelperText: {
        styleOverrides: {
          root: { fontSize: 13, letterSpacing: 0, textTransform: 'none', fontWeight: 400 },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottom: `1px solid ${p.borde}` },
          head: {
            fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase',
            fontWeight: 500, color: p.suave,
          },
        },
      },
    },
  });
}
