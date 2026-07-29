import { useEffect, useRef } from 'react';
import { stagger, useAnimate, useReducedMotion } from 'motion/react';

// Reveal de los paneles de Dashboard al cargar los datos. Se probó primero
// con ScrollTrigger (ocultar los paneles bajo el pliegue y revelarlos al
// hacer scroll), pero dependía de que las posiciones calculadas coincidieran
// con el alto real de la página (gráficas de Chart.js que recién terminan de
// renderizar) — si se desincronizaba, un panel podía quedar en opacity:0
// para siempre ("a veces se pierde" al entrar desde Registro). Reemplazado
// por un fade-in de una sola vez: nunca oculta nada de forma permanente, en el
// peor caso no anima.
//
// Migrado de GSAP a Motion (useAnimate): mismo comportamiento, una sola
// librería de animación en el proyecto. La opacidad va como keyframes
// [0, 1] — el estado "invisible" solo existe MIENTRAS corre la animación, así
// que sigue valiendo la garantía de arriba: si esto no se ejecuta, los paneles
// están visibles igual.
//
// Devuelve el `scope` de useAnimate: el consumidor lo usa como ref de la raíz
// de la vista y los selectores de abajo quedan acotados a ese subárbol.
export function useDashboardReveal(deps) {
  const [scope, animate] = useAnimate();
  const revelado = useRef(false);
  const reducido = useReducedMotion();

  useEffect(() => {
    if (reducido || !scope.current || revelado.current) return;
    // Descendiente, no hijo directo: desde el rediseño a grilla de 12
    // columnas los .reveal-block viven anidados dentro de .dash-grid.
    if (!scope.current.querySelector('.reveal-block')) return;
    revelado.current = true;

    // Solo opacidad, sin desplazamiento en Y. El <AnimatePresence> del Layout
    // ya mueve la página entera al entrar; si acá también se movían los
    // paneles, eran DOS traslaciones encimadas sobre el mismo contenido y se
    // sentía como un tirón doble. Lo que aporta este hook es el escalonado,
    // no el desplazamiento.
    animate(
      '.reveal-block',
      { opacity: [0, 1] },
      { duration: 0.4, ease: 'easeOut', delay: stagger(0.05) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scope;
}
