// theme/colores.js — fuente única de la paleta de marca (crema cálido +
// tinta café + acentos saturados). Se usa tanto para theme/muiTheme.js
// (createTheme de MUI) como para el bloque @theme de index.css (Tailwind) —
// los valores hex de acá y los de index.css deben mantenerse sincronizados
// a mano (no hay un paso de build que los derive el uno del otro).
export const ACC = ['#1abcb2', '#ef8130', '#f0c93e', '#c7b6f2', '#7ed957', '#f5a3c4'];
export const INK_ON_ACC = '#201004';

export const PALETA = {
  light: {
    fondo: '#fbe8cd',
    panel: '#fff8ec',
    panel2: '#f3e2c4',
    texto: '#241206',
    suave: '#7a6650',
    borde: '#e8d4ac',
    bordeFuerte: '#d9bf8d',
    primario: '#241206',
    primarioTexto: '#fbe8cd',
    primarioSuave: '#eeddbb',
    anillo: 'rgba(36, 18, 6, .18)',
    gasto: '#b23b3b',
    ingreso: '#157a3d',
    pago: '#a16207',
  },
  dark: {
    fondo: '#1b1108',
    panel: '#241708',
    panel2: '#2e1e0d',
    texto: '#f5e9d3',
    suave: '#b8a486',
    borde: 'rgba(245, 233, 211, 0.1)',
    bordeFuerte: 'rgba(245, 233, 211, 0.2)',
    primario: '#f5e9d3',
    primarioTexto: '#1b1108',
    primarioSuave: 'rgba(245, 233, 211, .1)',
    anillo: 'rgba(245, 233, 211, .25)',
    gasto: '#e08080',
    ingreso: '#4fbf7a',
    pago: '#d1a13d',
  },
};
