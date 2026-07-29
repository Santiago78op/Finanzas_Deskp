// theme/colores.js — fuente única de la paleta. Se usa tanto para
// theme/muiTheme.js (createTheme de MUI) como para el bloque @theme de
// index.css (Tailwind); los hex de acá y los de index.css se mantienen
// sincronizados a mano (no hay paso de build que los derive).
//
// Paleta sobrio-editorial (reemplaza el crema cálido + tinta café + acentos
// saturados de antes). La referencia es un informe impreso bien maquetado:
// fondo hueso, superficies planas, filetes de 1px. Los seis colores base son
// los únicos permitidos; todo lo demás se deriva de ellos.
export const BASE = {
  marino: '#0B1F3A',    // texto principal y marca
  petroleo: '#1E5F74',  // botones, enlaces, color principal
  laton: '#C9A227',     // acento — solo filetes, subrayados, íconos (máx. 5%)
  alza: '#0E8A5F',      // EXCLUSIVO para valores positivos
  baja: '#C0392B',      // EXCLUSIVO para valores negativos
  textoSec: '#4A5568',
  borde: '#E8E4DC',
  fondo: '#FAF9F6',
};

// Rampa de datos (puntos de cuenta, barras de categoría, acento de tarjeta).
// La paleta del informe no trae un set de acentos, así que en vez de inventar
// seis colores nuevos esto es una rampa ordenada de petróleo → marino, con el
// latón como único punto cálido. Se lee como una tabla de informe, no como un
// gráfico de dashboard.
export const ACC = ['#1E5F74', '#0B1F3A', '#4E8195', '#C9A227', '#33566E', '#8AA6B2'];
export const ACC_DARK = ['#4FA3BC', '#8AB4C6', '#2E7B93', '#D4B24A', '#6C93A6', '#A9C2CE'];
export const INK_ON_ACC = '#FAF9F6';

export const PALETA = {
  light: {
    fondo: BASE.fondo,
    panel: '#FFFFFF',        // el "papel": superficie plana sobre el hueso
    panel2: '#F1EFE9',       // inputs y chips — hueso un punto más profundo
    texto: BASE.marino,
    suave: BASE.textoSec,
    borde: BASE.borde,
    bordeFuerte: '#D8D2C6',
    primario: BASE.petroleo,
    primarioTexto: BASE.fondo,
    primarioSuave: '#E4EDF0',
    anillo: 'rgba(30, 95, 116, .35)',
    gasto: BASE.baja,
    ingreso: BASE.alza,
    // "Pago/deuda" iba en ámbar. Ahora va en marino: el latón sobre hueso da
    // ~2.2:1 de contraste y como texto es ilegible — sirve para filetes e
    // íconos, no para cifras.
    pago: BASE.marino,
    laton: BASE.laton,
  },
  // El informe solo define el esquema claro. El oscuro se deriva usando el
  // marino como familia de superficie (no se inventan colores nuevos): el
  // petróleo se aclara para seguir pasando AA sobre marino.
  dark: {
    fondo: '#08182D',
    panel: BASE.marino,
    panel2: '#12294A',
    texto: '#F0EEE8',
    suave: '#A8B4C4',
    borde: 'rgba(232, 228, 220, .14)',
    bordeFuerte: 'rgba(232, 228, 220, .26)',
    primario: '#4FA3BC',
    primarioTexto: '#08182D',
    primarioSuave: 'rgba(79, 163, 188, .16)',
    anillo: 'rgba(79, 163, 188, .45)',
    gasto: '#E8776A',
    ingreso: '#3FBF8E',
    pago: '#F0EEE8',
    laton: '#D4B24A',
  },
};
