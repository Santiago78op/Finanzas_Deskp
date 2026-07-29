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

  // MUI trae 25 niveles de elevación con sombras difusas de Material. Este
  // diseño no usa ninguna: el relieve lo dan los tokens --relieve-* de
  // index.css (filo de luz arriba + sombra cerrada de 1-2px), que se leen como
  // placa impresa y no como una tarjeta flotando. Se anulan los 25 y se aplica
  // el relieve a mano donde corresponde.
  const sinSombras = Array(25).fill('none');
  const RELIEVE_1 = 'var(--relieve-1)';
  const RELIEVE_2 = 'var(--relieve-2)';

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
            boxShadow: RELIEVE_1,
            // La transición es de sombra, NO de transform: el levantarse lo
            // hace Motion (alzarCard) y si acá también se moviera algo, serían
            // dos animaciones peleando por el mismo hover.
            transition: 'box-shadow .18s ease, border-color .18s ease',
            '&:hover': { boxShadow: RELIEVE_2 },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      // El modal sí está levantado de verdad sobre el resto: relieve alto.
      MuiDialog: {
        styleOverrides: {
          paper: { boxShadow: 'var(--relieve-3)', border: `1px solid ${p.borde}` },
        },
      },
      MuiButton: {
        disableElevation: true,
        styleOverrides: {
          // 8px: los controles llevan la esquina chica, las tarjetas la grande.
          // Antes eran píldoras de 999px, que es justo el lenguaje "app" que
          // este diseño evita.
          root: { borderRadius: 8 },
          // Los botones sólidos (el "Registrar" petróleo) llevan filo de luz
          // arriba: es lo que los hace ver como una tecla y no como un
          // rectángulo de color pegado.
          contained: {
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 1px 1px var(--tinta-sombra)',
            '&:hover': {
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,.24), 0 2px 3px -1px var(--tinta-sombra)',
            },
          },
          outlined: { borderColor: 'var(--borde-fuerte)' },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            backgroundColor: 'var(--panel-2)',
            // Relieve HACIA ADENTRO: el campo se lee troquelado en el papel,
            // que es la contraparte de las tarjetas (que sobresalen). Es la
            // pista de que ahí se escribe.
            boxShadow: 'var(--relieve-hundido)',
          },
        },
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
