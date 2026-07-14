import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from '../motion.js';

// Transición de vista con GSAP, sin el bug de "opacity residual" que tenía
// la versión vanilla (ver la nota gsap-en-react del cerebro react): acá cada
// vista solo existe en el DOM mientras está activa o saliendo — nunca hay un
// nodo persistente reusado entre navegaciones sobre el cual pueda quedar
// pegado un estilo inline de un ciclo anterior.
//
// `activa`: nombre de la vista que debe mostrarse ahora (children completos).
// `saliendo`: nombre de la vista anterior mientras se anima su salida (o null).
// Dashboard se excluye del stagger genérico de entrada porque su propio
// reveal lo maneja useDashboardReveal (fade-in simple, ver ese hook).
export function useViewTransition(vistaInicial, motionOK) {
  const [estado, setEstado] = useState({ activa: vistaInicial, saliendo: null });
  const refActiva = useRef(null);
  const refSaliendo = useRef(null);

  const navegar = (nueva) => {
    setEstado(e => {
      if (nueva === e.activa) return e;
      if (!motionOK) return { activa: nueva, saliendo: null };
      return { activa: nueva, saliendo: e.activa };
    });
  };

  // Animación de salida: al terminar, se desmonta (saliendo -> null) — React
  // quita el nodo del DOM, no queda opacity residual porque no hay nodo.
  useLayoutEffect(() => {
    if (!motionOK || !estado.saliendo || !refSaliendo.current) return;
    const el = refSaliendo.current;
    const tween = gsap.to(el, {
      opacity: 0, y: -8, duration: .18, ease: 'power1.in',
      onComplete: () => setEstado(e => (e.saliendo ? { ...e, saliendo: null } : e)),
    });
    return () => tween.kill();
  }, [estado.saliendo, motionOK]);

  // Animación de entrada: stagger de los hijos directos de la vista recién
  // montada (nace en default de CSS, nunca en un estado GSAP de un ciclo
  // anterior). Dashboard queda afuera: su propio hook maneja el fade-in.
  useLayoutEffect(() => {
    if (!motionOK || !refActiva.current || estado.activa === 'dashboard') return;
    const hijos = refActiva.current.children;
    if (!hijos.length) return;
    gsap.set(hijos, { opacity: 0, y: 16 });
    const tween = gsap.to(hijos, { opacity: 1, y: 0, duration: .5, ease: 'power2.out', stagger: .06 });
    return () => tween.kill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.activa, motionOK]);

  return { activa: estado.activa, saliendo: estado.saliendo, refActiva, refSaliendo, navegar };
}
