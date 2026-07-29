import { motion } from 'motion/react';
import { useTickerNumber } from '../../hooks/useTickerNumber.js';
import { fmtQ } from '../../utils.js';
import { tabularNums } from './estilos.js';

// Las cifras grandes de la app (balance del mes, disponible total, deuda
// total) cambiaban de golpe: al mover el mes o volver de registrar un gasto, el
// número saltaba y no había forma de notar si había subido o bajado. Acá cuenta
// desde el valor anterior hasta el nuevo, que es la única parte de la pantalla
// que dice "esto cambió por lo que acabás de hacer".
//
// RESERVA DE ANCHO — esto es lo que evita que el conteo "dé pataditas":
// tabular-nums fija el ancho de cada dígito, pero NO la cantidad de dígitos, y
// el ticker arranca en "Q 0.00" (6 caracteres) para llegar a "Q 4,700.00" (10).
// El texto crecía en pleno conteo y empujaba todo lo que tenía al lado en cada
// frame. La solución es un gemelo invisible con el valor FINAL que reserva la
// caja desde el primer frame, y el número animado dibujado encima en absoluto.
//
// Con motion reducido el hook pone el valor final de una (ver useTickerNumber).
export default function MontoAnimado({ valor, signo = '', className = '', style }) {
  const texto = useTickerNumber(valor);
  const final = `${signo}${fmtQ(parseFloat(valor) || 0)}`;

  return (
    <span
      className={className}
      style={{
        ...tabularNums, ...style,
        position: 'relative', display: 'inline-block', whiteSpace: 'nowrap',
      }}
    >
      {/* Gemelo invisible: solo existe para ocupar el ancho definitivo. */}
      <span aria-hidden="true" style={{ visibility: 'hidden' }}>{final}</span>
      {/* El valor que se ve. El MotionValue tiene que ser el ÚNICO hijo de su
          motion.span (Motion le escribe el innerHTML directo), por eso el
          signo va en un hermano y no adentro. */}
      <span style={{ position: 'absolute', left: 0, top: 0 }}>
        {signo}
        <motion.span>{texto}</motion.span>
      </span>
    </span>
  );
}
