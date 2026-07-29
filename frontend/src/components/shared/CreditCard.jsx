import { motion } from 'motion/react';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/EditOutlined';
import { fmtQ, fmtFecha } from '../../utils.js';
import { ACC } from '../../theme/colores.js';
import { identidadBanco } from '../../theme/bancos.js';
import { alzarCard, ENTRADA, varsItem } from '../../motion.js';
import BarraProgreso from './BarraProgreso.jsx';
import { LogoRed, redDe } from './LogosRed.jsx';
import { tabularNums } from './estilos.js';

// Cara de tarjeta sobrio-editorial: superficie plana, filete de 1px, esquinas
// de 12px. Nada de degradados, vidrio esmerilado ni sombras difusas — pasó
// por una versión "transparent-gradient" (Untitled UI) y quedó descartada al
// adoptar el sistema del informe impreso.
//
// Lo que identifica la tarjeta ya no es un fondo de color: es el filete
// superior de 3px con el acento, el monograma del banco y el logo de la red.
//
// Medidas 316×190 (proporción de tarjeta real), escalada con transform sobre
// un lienzo fijo para que tipografía y espacios se achiquen en proporción.
//
// El modelo no tiene titular ni vencimiento (y no se inventan): en esos dos
// lugares van el nombre de la tarjeta y el día de corte, que es lo que se
// necesita leer de un vistazo.
const ANCHO_BASE = 316;
const ALTO_BASE = 190;

const fmtQopt = (v) => (v == null ? '—' : fmtQ(v));

function Pastilla({ children, aviso, titulo }) {
  return (
    <span
      className="antetitulo shrink-0"
      style={{
        fontSize: 9, padding: '2px 6px', borderRadius: 4,
        border: `1px solid ${aviso ? 'var(--laton)' : 'var(--borde-fuerte)'}`,
        color: aviso ? 'var(--texto)' : 'var(--suave)',
      }}
      title={titulo}
    >
      {children}
    </span>
  );
}

// Monograma del banco: iniciales sobre el color de la casa. Ver
// theme/bancos.js para por qué no son los logos reales.
function MonogramaBanco({ banco }) {
  const { iniciales, color } = identidadBanco(banco);
  return (
    <span
      aria-hidden="true"
      style={{
        width: 30, height: 30, borderRadius: 6, background: color, color: '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: iniciales.length > 2 ? 10 : 12, fontWeight: 500, letterSpacing: '.02em',
        flex: 'none',
      }}
    >
      {iniciales}
    </span>
  );
}

// La cara se ARMA por partes al entrar: primero se traza el filo de acento de
// arriba (de izquierda a derecha, como la regla de las secciones), después
// suben el encabezado y el número. Es la misma idea que las reglas: una
// tarjeta que aparece entera no cuenta nada, una que se dibuja dirige el ojo
// al acento —que es lo que la identifica— y después al dato.
//
// El escalón NO usa varsLista: el contenedor de esta cara ya recibe el
// `visible` heredado de la grilla de tarjetas, así que definir el stagger acá
// haría que la cara espere su turno DOS veces (una por la grilla, otra por sí
// misma) y se sentiría lenta.
const varsCara = {
  oculto: {},
  visible: { transition: { delayChildren: 0.12, staggerChildren: 0.07 } },
};
const varsPieza = {
  oculto: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: ENTRADA },
};
const varsFilo = {
  oculto: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
};

function CaraTarjeta({ tarjeta, ancho, acento, red }) {
  const escala = ancho / ANCHO_BASE;
  const numero = String(1000 + ((tarjeta.id * 7919) % 9000)).padStart(4, '0');

  return (
    <div style={{ width: ancho, height: ALTO_BASE * escala }} className="relative flex">
      <motion.div
        style={{
          transform: `scale(${escala})`, width: ANCHO_BASE, height: ALTO_BASE,
          background: 'var(--superficie)',
          border: '1px solid var(--borde)',
          borderRadius: 'var(--radio)',
          boxShadow: 'var(--relieve-1)',
        }}
        className="absolute top-0 left-0 origin-top-left flex flex-col justify-between overflow-hidden p-4"
        variants={varsCara}
      >
        {/* El filo de acento pasó de `border-top` a un elemento propio: un
            borde no se puede animar por tramos, un div sí. */}
        <motion.div
          aria-hidden="true"
          variants={varsFilo}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
            background: acento, originX: 0,
          }}
        />
        <motion.div className="flex items-start justify-between gap-2" variants={varsPieza}>
          <div className="flex items-center gap-2.5 min-w-0">
            <MonogramaBanco banco={tarjeta.banco} />
            <div style={{ minWidth: 0 }}>
              <div className="truncate" style={{ fontSize: 15, fontWeight: 500, color: 'var(--texto)' }}>
                {tarjeta.banco}
              </div>
              <div className="antetitulo truncate">Crédito</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {!tarjeta.activa && <Pastilla>Inactiva</Pastilla>}
            {tarjeta.resumen_vencido && (
              <Pastilla aviso titulo="Ya cerró un corte nuevo desde que cargaste los valores del resumen">
                Desactualizado
              </Pastilla>
            )}
          </div>
        </motion.div>

        <motion.div className="flex items-end justify-between gap-3" variants={varsPieza}>
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="antetitulo truncate">{tarjeta.nombre}</div>
            <div className="cifra" style={{ fontSize: 16, letterSpacing: '.08em', color: 'var(--texto)' }}>
              ···· ···· ···· {numero}
            </div>
            <div className="antetitulo">Corte día {tarjeta.dia_corte}</div>
          </div>
          {/* Logo de la red. Sin `marca` en la base cae a deducirlo del
              nombre (ver redDe), así que las tarjetas viejas no se quedan sin
              logo hasta que se editen. */}
          {red && (
            <span className="shrink-0 flex items-end" style={{ paddingBottom: 2 }}>
              <LogoRed marca={red} />
            </span>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

// `compacta` (sin onEditar): la usa el panel "¿Cuánto debo en tarjetas?" del
// Dashboard — misma cara, más chica, y debajo solo Saldo/Corte. La versión
// completa suma la barra de uso, Saldo usado/Límite y el bloque de resumen,
// todos AFUERA de la cara: una tarjeta real no lleva impreso su saldo.
export default function CreditCard({ tarjeta, onEditar }) {
  const compacta = !onEditar;
  const acento = ACC[tarjeta.color_idx ?? (tarjeta.id % 6)];
  const red = redDe(tarjeta);
  const uso = Math.min(100, Math.max(0, Math.round(tarjeta.pct_uso)));
  const ancho = compacta ? 260 : ANCHO_BASE;

  return (
    <motion.div
      className={tarjeta.activa ? undefined : 'opacity-60'}
      style={{ width: ancho }}
      variants={varsItem}
      {...alzarCard}
    >
      <CaraTarjeta tarjeta={tarjeta} ancho={ancho} acento={acento} red={red} />

      {compacta ? (
        <div className="flex justify-between items-end gap-2" style={{ marginTop: 14 }}>
          <div>
            <div className="antetitulo">Saldo</div>
            <div style={{ fontSize: 15, fontWeight: 500, ...tabularNums }}>{fmtQ(tarjeta.saldo)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="antetitulo">Corte</div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>Día {tarjeta.dia_corte}</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3" style={{ marginTop: 16 }}>
          <BarraProgreso alto={4} pct={uso} color={acento} etiqueta={`Uso del límite de ${tarjeta.nombre}`} />
          <div className="flex justify-between items-end gap-2">
            <div>
              <div className="antetitulo">Saldo usado</div>
              <div style={{ fontSize: 15, fontWeight: 500, ...tabularNums }}>{fmtQ(tarjeta.saldo)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="antetitulo">Límite</div>
              <div style={{ fontSize: 15, fontWeight: 500, ...tabularNums }}>{fmtQ(tarjeta.limite)}</div>
            </div>
          </div>

          <div className="pt-3 flex flex-col gap-2" style={{ borderTop: '1px solid var(--borde)' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="antetitulo">
                Resumen{tarjeta.resumen_actualizado ? ` · ${fmtFecha(tarjeta.resumen_actualizado)}` : ''}
              </span>
              <span className="antetitulo" style={{ color: 'var(--texto)' }}>{uso}% usado</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><div className="antetitulo">Saldo al día</div><div style={{ fontSize: 14, fontWeight: 500, ...tabularNums }}>{fmtQopt(tarjeta.saldo_dia)}</div></div>
              <div><div className="antetitulo">Al corte</div><div style={{ fontSize: 14, fontWeight: 500, ...tabularNums }}>{fmtQopt(tarjeta.saldo_corte)}</div></div>
              <div style={{ textAlign: 'right' }}><div className="antetitulo">De contado</div><div style={{ fontSize: 14, fontWeight: 500, ...tabularNums }}>{fmtQopt(tarjeta.pago_contado)}</div></div>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <IconButton size="small" onClick={onEditar} aria-label="Editar tarjeta" sx={{ color: 'var(--suave)' }}>
              <EditIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </div>
        </div>
      )}
    </motion.div>
  );
}
