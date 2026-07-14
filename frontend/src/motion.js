// motion.js — el flag de motion reducido. GSAP no respeta
// prefers-reduced-motion solo (a diferencia de las transitions/@keyframes de
// CSS) — motionOK se chequea a mano en cada hook que anima algo
// (useViewTransition, useDashboardReveal).
import gsap from 'gsap';

export const motionOK = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export { gsap };
