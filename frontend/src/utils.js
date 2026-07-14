// utils.js — formateo compartido, portado 1:1 desde static/app.js

// Formato de moneda: Q 1,234.56
export const fmtQ = n => 'Q ' + Number(n).toLocaleString('en-US',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Fecha ISO (aaaa-mm-dd) -> dd/mm/aaaa para mostrar
export const fmtFecha = iso => { const [a, m, d] = iso.split('-'); return `${d}/${m}/${a}`; };

// Fecha de hoy en ISO (en hora local, no UTC)
export const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const MESES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export function claseUso(pct) {
  return pct < 30 ? 'uso-verde' : pct <= 70 ? 'uso-amarillo' : 'uso-rojo';
}
