import { useEffect, useRef } from 'react';
import { gsap } from '../motion.js';

// Reveal de los paneles de Dashboard al cargar los datos. Se probó primero
// con ScrollTrigger (ocultar los paneles bajo el pliegue y revelarlos al
// hacer scroll), pero dependía de que las posiciones calculadas coincidieran
// con el alto real de la página (gráficas de Chart.js que recién terminan de
// renderizar) — si se desincronizaba, un panel podía quedar en opacity:0
// para siempre ("a veces se pierde" al entrar desde Registro). Reemplazado
// por un fade-in simple de una sola vez: nunca oculta nada de forma
// permanente, en el peor caso no anima.
export function useDashboardReveal(rootRef, motionOK, deps) {
  const revealedRef = useRef(false);

  useEffect(() => {
    if (!motionOK || !rootRef.current || revealedRef.current) return;
    revealedRef.current = true;

    const bloques = [...rootRef.current.querySelectorAll(':scope > .reveal-block')];
    if (!bloques.length) return;
    gsap.set(bloques, { opacity: 0, y: 16 });
    gsap.to(bloques, { opacity: 1, y: 0, duration: .5, ease: 'power2.out', stagger: .06, clearProps: 'opacity,transform' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
