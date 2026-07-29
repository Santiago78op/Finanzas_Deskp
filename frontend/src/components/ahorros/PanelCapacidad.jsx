import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import { fmtQ } from '../../utils.js';
import { tabularNums } from '../shared/estilos.js';

// "¿Cuánto puedo apartar?" — la respuesta con los números reales de la app,
// no una regla genérica del 20%.
//
//   ingreso recurrente − gasto promedio − cuotas comprometidas
//
// Los pagos a tarjeta NO se restan acá: las compras con tarjeta ya están
// contadas dentro del gasto promedio, y restarlas otra vez descontaría dos
// veces lo mismo (ver _capacidad_de_ahorro en app.py).
function Linea({ etiqueta, valor, signo, detalle }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <div style={{ minWidth: 0 }}>
        <div className="text-[15px]">{etiqueta}</div>
        {detalle && <div className="text-[13px] text-[var(--suave)]">{detalle}</div>}
      </div>
      <div className="whitespace-nowrap" style={{ ...tabularNums, fontSize: 15 }}>
        {signo}{fmtQ(Math.abs(valor))}
      </div>
    </div>
  );
}

export default function PanelCapacidad({ capacidad, requeridoTotal }) {
  const { ingreso_mensual, gasto_promedio, cuotas_comprometidas, mensual, quincenal,
          meses_historial } = capacidad;

  const sinHistorial = gasto_promedio == null;
  const negativa = mensual < 0;
  const alcanza = requeridoTotal > 0 ? mensual >= requeridoTotal : null;

  return (
    <Card component="section" aria-labelledby="sec-capacidad" className="p-5 flex flex-col gap-2">
      <Typography id="sec-capacidad" variant="caption" className="antetitulo">
        ¿Cuánto puedo apartar?
      </Typography>

      {sinHistorial ? (
        <Typography variant="body2" className="text-[var(--suave)] medida">
          Todavía no hay meses cerrados con gastos registrados, así que no puedo
          estimar tu capacidad de ahorro. Registrá gastos durante un mes completo
          y este cálculo aparece solo.
        </Typography>
      ) : (
        <>
          <div className="flex flex-col">
            <Linea etiqueta="Ingreso mensual" valor={ingreso_mensual} signo=""
                   detalle="De tus ingresos recurrentes activos" />
            <Linea etiqueta="Gasto promedio" valor={gasto_promedio} signo="−"
                   detalle={`Promedio de ${meses_historial} ${meses_historial === 1 ? 'mes cerrado' : 'meses cerrados'} · incluye compras con tarjeta`} />
            <Linea etiqueta="Cuotas comprometidas" valor={cuotas_comprometidas} signo="−"
                   detalle="Préstamos y Visa Cuotas" />
          </div>

          <div className="pt-3 mt-1 flex items-end justify-between gap-3"
               style={{ borderTop: '1px solid var(--borde)' }}>
            <div>
              <div className="antetitulo">Podés apartar</div>
              <div style={{ fontSize: 28, fontWeight: 500, ...tabularNums,
                            color: negativa ? 'var(--baja)' : 'var(--alza)' }}>
                {negativa ? '−' : ''}{fmtQ(Math.abs(mensual))}
              </div>
              <div className="text-[13px] text-[var(--suave)]">al mes</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="antetitulo">Por quincena</div>
              <div style={{ fontSize: 20, fontWeight: 500, ...tabularNums,
                            color: negativa ? 'var(--baja)' : 'var(--texto)' }}>
                {negativa ? '−' : ''}{fmtQ(Math.abs(quincenal))}
              </div>
            </div>
          </div>

          {negativa && (
            <Typography variant="body2" className="text-[var(--baja)] medida" sx={{ mt: 1 }}>
              Tus gastos y cuotas superan lo que entra: hoy no hay margen para apartar
              sin recortar algo antes.
            </Typography>
          )}
          {!negativa && alcanza === false && (
            <Typography variant="body2" className="text-[var(--suave)] medida" sx={{ mt: 1 }}>
              Tus metas con fecha piden {fmtQ(requeridoTotal)} al mes y podés apartar{' '}
              {fmtQ(mensual)}. Faltan {fmtQ(requeridoTotal - mensual)} — o corrés las
              fechas, o bajás los objetivos.
            </Typography>
          )}
          {!negativa && alcanza === true && (
            <Typography variant="body2" className="text-[var(--suave)] medida" sx={{ mt: 1 }}>
              Tus metas con fecha piden {fmtQ(requeridoTotal)} al mes: entran en lo que
              podés apartar.
            </Typography>
          )}
        </>
      )}
    </Card>
  );
}
