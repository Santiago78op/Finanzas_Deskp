// paleta.js — colores de gráficas por tema, alineados a los tokens de
// index.css (paleta crema/tinta + acentos saturados del rediseño).
export const PALETA = {
  light: {
    ingresos: '#157a3d', gastos: '#b23b3b', patrimonio: '#7c6cf0',
    pie: ['#1abcb2', '#ef8130', '#f0c93e', '#c7b6f2', '#7ed957', '#f5a3c4', '#b23b3b', '#157a3d'],
    tinta: '#5c4a34', grid: '#e3cfa4', superficie: '#fff8ec',
  },
  dark: {
    ingresos: '#4fbf7a', gastos: '#e08080', patrimonio: '#9085e9',
    pie: ['#1abcb2', '#ef8130', '#f0c93e', '#c7b6f2', '#7ed957', '#f5a3c4', '#e08080', '#4fbf7a'],
    tinta: '#b8a486', grid: 'rgba(245,233,211,.08)', superficie: '#241708',
  },
};

export const temaActual = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
