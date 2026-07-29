// El lenguaje de movimiento de Dedun, en un solo archivo.
//
// Antes acá vivían `gsap` + un flag `motionOK` que cada hook tenía que
// chequear a mano (GSAP no respeta prefers-reduced-motion solo). Ahora la app
// anima con Motion (motion.dev): el respeto por "motion reducido" lo
// centraliza <MotionConfig reducedMotion="user"> en main.jsx, y lo que queda
// acá son los TOKENS de movimiento — mismos resortes y mismos tiempos en toda
// la app, para que ninguna pantalla se sienta de otra app.
//
// Los hooks imperativos (animate() suelto, tickers) sí siguen chequeando
// useReducedMotion() a mano: MotionConfig solo alcanza a los componentes
// <motion.*>.
import { stagger } from 'motion/react';

// Resorte de UI: rápido y con casi nada de rebote. Una app de plata no debe
// "saltar" — el rebote lee como juguete, no como saldo bancario.
export const RESORTE = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 };

// Para lo que ocupa mucha pantalla (barras que crecen, paneles): con el
// resorte rápido se siente atropellado.
export const RESORTE_LENTO = { type: 'spring', stiffness: 110, damping: 20 };

// La salida SIEMPRE más corta que la entrada: esperar a que algo se vaya se
// siente lento; verlo llegar, no.
export const ENTRADA = { duration: 0.28, ease: [0.22, 1, 0.36, 1] };
export const SALIDA = { duration: 0.14, ease: 'easeIn' };

// Transición de página completa (Layout.jsx). Con AnimatePresence mode="wait"
// esto sí incluye SALIDA — antes solo había entrada, porque react-router
// desmonta la vista vieja de inmediato y no quedaba nodo que animar.
export const varsPagina = {
  oculto: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: ENTRADA },
  saliendo: { opacity: 0, y: -8, transition: SALIDA },
};

// Contenedor + ítem para grillas y listas: el contenedor no anima nada propio,
// solo reparte el turno de sus hijos. Un ítem con `varsItem` que NO tenga un
// contenedor variante arriba simplemente se queda quieto (no se esconde) —
// por eso es seguro ponérselo a las cards compartidas.
export const varsLista = {
  oculto: {},
  visible: { transition: { delayChildren: stagger(0.05) } },
};

export const varsItem = {
  oculto: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: ENTRADA },
};

// Micro-interacción compartida de las cards: se levantan un poco con el mouse
// y se hunden al tocarlas. Feedback de que la card es "una cosa" y no pintura
// de fondo.
export const alzarCard = {
  whileHover: { y: -3 },
  whileTap: { scale: 0.985 },
  transition: RESORTE,
};
