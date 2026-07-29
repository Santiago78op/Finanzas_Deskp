// paleta.js — colores para Chart.js.
//
// NO define colores propios: los DERIVA de theme/colores.js, que es la única
// fuente de la paleta (la misma que consumen muiTheme.js y los tokens de
// index.css).
//
// Antes tenía sus propios hex copiados a mano y se quedó con la paleta vieja
// (crema/tinta con acentos teal, naranja y rosa) cuando el resto de la app pasó
// al sistema sobrio-editorial. Resultado: las ocho gráficas de Análisis
// pintaban como si fueran de otra aplicación, y nadie lo notaba porque no hay
// nada que ate un archivo al otro. Derivándolo, eso no puede volver a pasar.
import { ACC, ACC_DARK, PALETA as MARCA } from './theme/colores.js';

function paraTema(modo) {
  const p = MARCA[modo];
  const acentos = modo === 'dark' ? ACC_DARK : ACC;
  return {
    ingresos: p.ingreso,
    gastos: p.gasto,
    patrimonio: p.primario,
    // La rampa de datos + verde/rojo al final, para las series que necesitan
    // más entradas que los seis acentos (ej. el pastel de categorías).
    pie: [...acentos, p.ingreso, p.gasto],
    tinta: p.suave,
    grid: p.borde,
    superficie: p.panel,
  };
}

export const PALETA = { light: paraTema('light'), dark: paraTema('dark') };

export const temaActual = () => document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
