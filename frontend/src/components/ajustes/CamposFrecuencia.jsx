import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

// Los campos de calendario de un recurrente: cada cuándo y qué día(s).
//
// Compartido entre ingresos recurrentes y pagos frecuentes. Los dos
// formularios tenían su propia copia de estos campos, y así fue como el
// soporte de frecuencia Anual quedó solo del lado de los ingresos: se agregó
// en una copia y nadie se acordó de la otra. Con un componente, la próxima
// frecuencia aparece en los dos a la vez.
//
// `valores` y `alCambiar` trabajan sobre el mismo objeto de formulario del
// padre: este componente no tiene estado propio.
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Cómo se lee un recurrente en la lista de abajo de cada formulario.
export function describirFrecuencia(r, fmtQ) {
  if (r.frecuencia === 'Quincenal') {
    return `${fmtQ(r.monto)} por quincena, los días ${r.dia_mes} y ${r.dia_mes_2}`;
  }
  if (r.frecuencia === 'Anual') {
    const primero = `${MESES[r.mes_1 - 1]} ${r.dia_mes}`;
    if (!r.mes_2) return `${fmtQ(r.monto)} una vez al año, el ${primero}`;
    return `${fmtQ(r.monto)} por pago, el ${primero} y el ${MESES[r.mes_2 - 1]} ${r.dia_mes_2 || r.dia_mes}`;
  }
  return `${fmtQ(r.monto)} el día ${r.dia_mes}`;
}

// Los tres valores que el padre manda a la API, derivados de la frecuencia.
// Vive acá para que las reglas de "qué campo aplica a qué frecuencia" no se
// dupliquen tampoco en el submit de cada formulario.
export function camposParaLaApi(form) {
  const esQuincenal = form.frecuencia === 'Quincenal';
  const esAnual = form.frecuencia === 'Anual';
  const dosPagos = esAnual && !!form.mes_2;
  return {
    dia_mes_2: (esQuincenal || dosPagos) ? parseInt(form.dia_mes_2) : null,
    mes_1: esAnual ? parseInt(form.mes_1) : null,
    mes_2: dosPagos ? parseInt(form.mes_2) : null,
  };
}

export default function CamposFrecuencia({ valores, alCambiar, etiquetaAnual }) {
  const esQuincenal = valores.frecuencia === 'Quincenal';
  const esAnual = valores.frecuencia === 'Anual';
  const dosPagos = esAnual && !!valores.mes_2;

  const set = (campo) => (e) => alCambiar(campo, e.target.value);

  return (
    <>
      <TextField select label="Frecuencia" value={valores.frecuencia}
        onChange={set('frecuencia')}>
        <MenuItem value="Mensual">Mensual (una vez al mes)</MenuItem>
        <MenuItem value="Quincenal">Quincenal (dos veces al mes)</MenuItem>
        <MenuItem value="Anual">{etiquetaAnual}</MenuItem>
      </TextField>

      {esAnual && (
        <TextField select label="Mes del pago" required value={valores.mes_1}
          onChange={set('mes_1')}>
          {MESES.map((m, i) => <MenuItem key={m} value={String(i + 1)}>{m}</MenuItem>)}
        </TextField>
      )}

      <TextField label={esAnual ? 'Día del pago' : 'Día de pago'} type="number"
        inputProps={{ min: 1, max: 31 }} required
        value={valores.dia_mes} onChange={set('dia_mes')} />

      {esAnual && (
        <TextField select label="Segundo pago (opcional)" value={valores.mes_2}
          helperText="Dejalo vacío si se paga una sola vez al año"
          onChange={set('mes_2')}>
          <MenuItem value="">Sin segundo pago</MenuItem>
          {MESES.map((m, i) => <MenuItem key={m} value={String(i + 1)}>{m}</MenuItem>)}
        </TextField>
      )}

      {(esQuincenal || dosPagos) && (
        <TextField
          label={esQuincenal ? 'Segundo día de pago' : 'Día del segundo pago'}
          type="number" inputProps={{ min: 1, max: 31 }} required
          title={esQuincenal
            ? 'El primer día ya lo pusiste arriba — acá va la segunda fecha del mes (ej. si es los 15 y los 30, acá va 30).'
            : 'Día del mes en que cae el segundo pago anual.'}
          value={valores.dia_mes_2} onChange={set('dia_mes_2')} />
      )}
    </>
  );
}
