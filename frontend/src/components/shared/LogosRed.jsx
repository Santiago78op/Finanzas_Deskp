// Marcas de red de las tarjetas. A diferencia de los bancos (ver
// theme/bancos.js, donde se usa un monograma), acá sí van dibujadas: la red
// es un dato de la tarjeta que el usuario necesita reconocer, y estas dos
// marcas tienen una forma canónica y simple.
//
// Mastercard: dos círculos que se solapan, rojo y ámbar, con la intersección
// en naranja. Visa: la palabra en su azul, con el remate del vértice de la V.
// `sobreOscuro` invierte el wordmark de Visa a blanco para cuando la tarjeta
// tiene fondo oscuro (tema oscuro).

export function LogoMastercard({ alto = 22 }) {
  const ancho = alto * (36 / 22);
  return (
    <svg width={ancho} height={alto} viewBox="0 0 36 22" role="img" aria-label="Mastercard">
      <circle cx="13" cy="11" r="10" fill="#EB001B" />
      <circle cx="23" cy="11" r="10" fill="#F79E1B" />
      {/* La lente de intersección: el naranja oscuro donde se cruzan. Se
          dibuja aparte porque un simple solapado dejaría el ámbar tapando al
          rojo, y la marca real muestra la mezcla. */}
      <path
        d="M18 3.2a10 10 0 0 0 0 15.6 10 10 0 0 0 0-15.6Z"
        fill="#FF5F00"
      />
    </svg>
  );
}

export function LogoVisa({ alto = 16, sobreOscuro = false }) {
  const ancho = alto * (50 / 16);
  return (
    <svg width={ancho} height={alto} viewBox="0 0 50 16" role="img" aria-label="Visa">
      <text
        x="0" y="13"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="15" fontStyle="italic" fontWeight="700"
        letterSpacing="-.5"
        fill={sobreOscuro ? '#FFFFFF' : '#1A1F71'}
      >
        VISA
      </text>
    </svg>
  );
}

export function LogoRed({ marca, alto, sobreOscuro }) {
  if (marca === 'Mastercard') return <LogoMastercard alto={alto ?? 22} />;
  if (marca === 'Visa') return <LogoVisa alto={alto ?? 16} sobreOscuro={sobreOscuro} />;
  return null;
}

// Respaldo para tarjetas viejas sin el campo `marca`: se deduce del nombre,
// que es lo que hacía la app antes de que la red fuera un dato propio.
export function redDe(tarjeta) {
  if (tarjeta.marca) return tarjeta.marca;
  const n = (tarjeta.nombre || '').toLowerCase();
  if (n.includes('visa')) return 'Visa';
  if (n.includes('master')) return 'Mastercard';
  return null;
}
