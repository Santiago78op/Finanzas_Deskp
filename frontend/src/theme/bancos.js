// Identidad mínima por banco: iniciales + color, para el monograma que va en
// la cara de la tarjeta.
//
// Son monogramas, NO los logos oficiales. Incrustar la marca registrada de un
// banco sería usar propiedad ajena, y dibujar una imitación es peor todavía
// (se ve "casi igual" y no lo es). Las iniciales sobre el color de la casa
// cumplen la misma función —reconocer de quién es la tarjeta de un vistazo—
// sin apropiarse de nada. Los logos de Visa/Mastercard SÍ van dibujados: ahí
// la marca de red es información de la tarjeta, no branding de la app.
//
// La clave se compara en minúsculas y por "empieza con", para que "BI",
// "Banco Industrial" y "BI Guatemala" caigan en la misma entrada.
const BANCOS = [
  { clave: 'banco industrial', iniciales: 'BI', color: '#00529B' },
  { clave: 'industrial', iniciales: 'BI', color: '#00529B' },
  { clave: 'bi', iniciales: 'BI', color: '#00529B' },
  { clave: 'bam', iniciales: 'BAM', color: '#C0392B' },
  { clave: 'agromercantil', iniciales: 'BAM', color: '#C0392B' },
  { clave: 'g&t', iniciales: 'G&T', color: '#005BAA' },
  { clave: 'gyt', iniciales: 'G&T', color: '#005BAA' },
  { clave: 'banrural', iniciales: 'BR', color: '#0E8A5F' },
  { clave: 'promerica', iniciales: 'PR', color: '#B03A2E' },
  { clave: 'ficohsa', iniciales: 'FH', color: '#1E5F74' },
  { clave: 'inmobiliario', iniciales: 'BIN', color: '#4A5568' },
  { clave: 'azteca', iniciales: 'AZ', color: '#0E8A5F' },
];

// Respaldo para bancos que no están en la lista: color estable derivado del
// nombre (el mismo banco cae siempre en el mismo color) y tomado de la rampa
// del sistema, no inventado.
const RESPALDO = ['#1E5F74', '#0B1F3A', '#4E8195', '#33566E', '#8AA6B2', '#4A5568'];

export function identidadBanco(banco) {
  const n = (banco || '').trim().toLowerCase();
  if (!n) return { iniciales: '—', color: RESPALDO[0] };

  const conocido = BANCOS.find(b => n.startsWith(b.clave));
  if (conocido) return { iniciales: conocido.iniciales, color: conocido.color };

  // Siglas de las palabras si hay varias ("Banco Del Sur" -> BDS), o las
  // primeras letras si es una sola. Máximo 3 caracteres.
  const palabras = n.split(/\s+/).filter(Boolean);
  const iniciales = (palabras.length > 1
    ? palabras.map(p => p[0]).join('')
    : palabras[0]
  ).slice(0, 3).toUpperCase();

  const hash = [...n].reduce((h, c) => h + c.charCodeAt(0), 0);
  return { iniciales, color: RESPALDO[hash % RESPALDO.length] };
}
