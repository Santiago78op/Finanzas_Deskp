import { useEffect, useRef } from 'react';
import { gsap, motionOK } from '../../motion.js';

// Fade-in de entrada al montar una ruta (stagger de los hijos directos) —
// reemplaza el cross-fade entrada+salida que hacía useViewTransition.js
// antes de pasar a react-router. React Router desmonta la vista vieja de
// inmediato al cambiar de ruta, así que ya no hay nodo "saliendo" que animar
// — cada ruta solo anima su propia entrada. Dashboard no se envuelve acá:
// tiene su propio useDashboardReveal.
export default function RouteFade({ children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!motionOK || !ref.current) return;
    const hijos = ref.current.children;
    if (!hijos.length) return;
    gsap.set(hijos, { opacity: 0, y: 16 });
    const tween = gsap.to(hijos, { opacity: 1, y: 0, duration: .5, ease: 'power2.out', stagger: .06 });
    return () => tween.kill();
  }, []);

  return <div ref={ref}>{children}</div>;
}
