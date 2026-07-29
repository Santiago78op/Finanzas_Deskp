import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'motion/react';
import { RESORTE_LENTO } from '../../motion.js';

// Anillo de avance para un porcentaje.
//
// Se dibuja con Motion y no con Chart.js a propósito: para UN solo porcentaje,
// Chart.js es traer un motor de gráficas entero para pintar un arco, y su
// animación no respeta el lenguaje de movimiento del resto de la app. Acá el
// arco se "dibuja" con `pathLength` —el valor 0-1 que Motion expone sobre
// circle/path— con el mismo resorte que las barras, así que un anillo y una
// barra de la misma pantalla se mueven igual.
//
// El número del centro cuenta con un MotionValue (lo escribe Motion, no React)
// y termina exactamente cuando el arco llega: las dos cosas cuentan la misma
// historia y desincronizarlas se nota.
const RADIO = 44;
const GROSOR = 9;
const LADO = RADIO * 2 + GROSOR * 2;

export default function AnilloProgreso({ pct, color, tamano = 108, etiqueta }) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const reducido = useReducedMotion();

  const numero = useMotionValue(0);
  const texto = useTransform(numero, v => `${Math.round(v)}%`);

  useEffect(() => {
    if (reducido) { numero.set(p); return; }
    const control = animate(numero, p, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return () => control.stop();
  }, [p, reducido, numero]);

  return (
    <div style={{ width: tamano, height: tamano, position: 'relative', flex: 'none' }}>
      <svg
        width={tamano} height={tamano} viewBox={`0 0 ${LADO} ${LADO}`}
        /* -90° para que el arco arranque arriba y no a las 3 en punto. */
        style={{ transform: 'rotate(-90deg)', display: 'block' }}
        role="img"
        aria-label={`${etiqueta}: ${Math.round(p)}% completado`}
      >
        <circle
          cx={LADO / 2} cy={LADO / 2} r={RADIO}
          fill="none" stroke="var(--panel-2)" strokeWidth={GROSOR}
        />
        <motion.circle
          cx={LADO / 2} cy={LADO / 2} r={RADIO}
          fill="none" stroke={color} strokeWidth={GROSOR}
          /* En 0% un linecap redondo deja un punto suelto flotando, que se lee
             como un error. Ahí se corta plano y no se ve nada. */
          strokeLinecap={p === 0 ? 'butt' : 'round'}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: p / 100 }}
          transition={RESORTE_LENTO}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <motion.span className="cifra" style={{ fontSize: tamano * 0.24, fontWeight: 500 }}>
          {texto}
        </motion.span>
      </div>
    </div>
  );
}
