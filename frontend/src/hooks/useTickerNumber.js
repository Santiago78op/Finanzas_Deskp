import { useEffect } from 'react';
import { animate, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { fmtQ } from '../utils.js';

// Ticker de montos. Dos cambios sobre la versión de requestAnimationFrame +
// useState que había antes:
//
// 1. Anima DESDE EL VALOR ANTERIOR, no desde 0. Antes, cambiar de mes hacía
//    que las 6 métricas se desplomaran a Q0.00 y volvieran a subir — se leía
//    como "se borraron los datos". Ahora Q4,200 -> Q3,850 se ve como lo que
//    es: un ajuste. La primera carga sí sale de 0 (ahí sí no hay valor previo
//    y el conteo ayuda a que el ojo caiga en la cifra).
// 2. Devuelve un MotionValue, no un string de estado. Motion escribe el texto
//    directo en el DOM: ~40 renders de React por métrica y por cambio de mes
//    que ya no ocurren.
//
// Se consume con <motion.span>{valor}</motion.span> (ver StatTile.jsx).
export function useTickerNumber(valor) {
  const reducido = useReducedMotion();
  const crudo = useMotionValue(0);
  const texto = useTransform(crudo, v => fmtQ(v));

  useEffect(() => {
    const objetivo = parseFloat(valor) || 0;
    if (reducido) { crudo.set(objetivo); return; }
    const control = animate(crudo, objetivo, { duration: 0.65, ease: [0.16, 1, 0.3, 1] });
    return () => control.stop();
  }, [valor, reducido, crudo]);

  return texto;
}
