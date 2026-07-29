import { motion } from 'motion/react';
import { ENTRADA } from '../../motion.js';

// Regla de separación entre secciones, que se DIBUJA de izquierda a derecha al
// entrar en pantalla.
//
// Reemplaza al <Divider> de MUI en las vistas. Dos motivos:
//   · Una línea que aparece de golpe no dice nada; una que se traza guía el ojo
//     hacia la sección que empieza, que es justo para lo que está ahí.
//   · El tramo de latón del arranque es un elemento propio, así que puede
//     dibujarse ANTES que el resto de la línea — primero la marca, después el
//     filete. Con el degradado del <Divider> eso no se podía separar.
//
// `whileInView` con `once` y no `animate`: en una vista larga las reglas de
// abajo no se ven al cargar, y animarlas igual desperdicia el gesto — se
// trazan cuando el usuario llega a ellas.
export default function Regla({ margen = '40px 0 24px' }) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      style={{ margin: margen, height: 1, position: 'relative' }}
    >
      {/* El filete largo: crece desde la izquierda. originX:0 es lo que hace
          que "crezca" en vez de expandirse desde el centro. */}
      <motion.div
        style={{
          position: 'absolute', inset: 0,
          background: 'var(--borde)', originX: 0,
        }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 1 }}
        transition={{ ...ENTRADA, duration: 0.55 }}
      />
      {/* La marca de latón: 44px, entra primero y desde la misma esquina. */}
      <motion.div
        style={{
          position: 'absolute', left: 0, top: 0,
          width: 44, height: 1, background: 'var(--laton)', originX: 0,
        }}
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      />
    </div>
  );
}
