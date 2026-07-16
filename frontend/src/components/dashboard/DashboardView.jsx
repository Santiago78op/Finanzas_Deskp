import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ScheduleIcon from '@mui/icons-material/Schedule';
import MesSelector from './MesSelector.jsx';
import CreditCard from '../shared/CreditCard.jsx';
import { api } from '../../api.js';
import { fmtQ, MESES } from '../../utils.js';
import { ACC } from '../../theme/colores.js';
import { useDashboardReveal } from '../../hooks/useDashboardReveal.js';
import { useDataVersion } from '../../context/DataVersionContext.jsx';
import { motionOK } from '../../motion.js';

// Composición nueva (FinanzasQ.dc.html, Claude Design): resumen narrativo en
// tarjetas "pregunta → respuesta" en vez del dashboard denso anterior de 6
// gráficas de Chart.js. Mismo endpoint /api/dashboard, otra presentación —
// Patrimonio y "Disponible del salario" no tienen lugar en esta composición
// (el mockup no los incluye); si hacen falta de vuelta, es una vista propia,
// no un widget más acá.
export default function DashboardView({ onNavigate }) {
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [d, setD] = useState(null);
  const [movs, setMovs] = useState([]);
  const { version } = useDataVersion();
  const rootRef = useRef(null);
  useDashboardReveal(rootRef, motionOK, [d]);

  const cargar = useCallback(async () => {
    setD(await api(`/api/dashboard?anio=${anio}&mes=${mes}`));
    setMovs(await api('/api/movimientos'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes, version]);

  useEffect(() => { cargar(); }, [cargar]);

  const cambiarMes = (delta) => {
    let m = mes + delta, a = anio;
    if (m < 1) { m = 12; a--; }
    if (m > 12) { m = 1; a++; }
    setMes(m); setAnio(a);
  };

  if (!d) return null;

  const aFavor = d.balance >= 0;
  const gastoBarW = d.ingresos > 0 ? Math.min(100, Math.round(d.gastos / d.ingresos * 100)) : (d.gastos > 0 ? 100 : 0);
  const tarjetasPorPago = [...d.tarjetas].sort((a, b) => a.dias_pago - b.dias_pago).slice(0, 3);
  const maxCategoria = d.analisis.top_categorias[0]?.total || 1;

  const colorMovimiento = (m) => {
    if (m.tipo === 'ingreso') return 'var(--ingreso)';
    if (m.tipo === 'pago') return 'var(--pago)';
    const hash = [...(m.categoria || '')].reduce((h, ch) => h + ch.charCodeAt(0), 0);
    return ACC[hash % 6];
  };

  return (
    <div id="vista-dashboard" className="vista" ref={rootRef}>
      <MesSelector anio={anio} mes={mes} onCambiar={cambiarMes} />

      {d.deuda_supera_ingresos && (
        <div className="banner-alerta reveal-block">
          ⚠️ Tu deuda en tarjetas ({fmtQ(d.deuda_total)}) rebasa tus ingresos del mes ({fmtQ(d.ingresos)})
        </div>
      )}

      <div className="dash-grid">
        <Card component="section" aria-label="Balance del mes" className="reveal-block p-5 dash-span-12 flex items-center justify-between gap-6 flex-wrap">
          <div style={{ minWidth: 280, flex: 1 }}>
            <Typography variant="body2" fontWeight={500} className="text-[var(--suave)]">Buenas 👋</Typography>
            <Typography variant="h6" fontWeight={600} lineHeight={1.35} className="mt-1" style={{ textWrap: 'pretty' }}>
              Vas <b className={aFavor ? 'text-[var(--ingreso)]' : 'text-[var(--gasto)]'}>{fmtQ(Math.abs(d.balance))}</b> {aFavor ? 'a favor' : 'en contra'} este mes.{' '}
              {aFavor ? 'Tus gastos van por debajo de lo que entra — seguí así.' : 'Tus gastos superaron lo que entró — con cuidado los próximos días.'}
            </Typography>
            <Typography variant="body2" className="text-[var(--suave)] mt-2">
              Ingresos {fmtQ(d.ingresos)} · Gastos {fmtQ(d.gastos)} · Deuda en tarjetas {fmtQ(d.deuda_total)}
            </Typography>
          </div>
          <div style={{ textAlign: 'right', flex: 'none' }}>
            <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Balance del mes</Typography>
            <Typography variant="h4" fontWeight={700} className={aFavor ? 'text-[var(--ingreso)]' : 'text-[var(--gasto)]'} style={{ fontVariantNumeric: 'tabular-nums' }}>
              {aFavor ? '+' : '−'}{fmtQ(Math.abs(d.balance))}
            </Typography>
          </div>
        </Card>

        <Card component="section" aria-labelledby="sec-cuanto-tengo" className="reveal-block p-5 dash-span-4 flex flex-col gap-3">
          <Typography id="sec-cuanto-tengo" variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">¿Cuánto tengo?</Typography>
          <div>
            <Typography variant="h5" fontWeight={700} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(d.dinero_total)}</Typography>
            <Typography variant="body2" className="text-[var(--suave)]">Disponible en {d.cuentas.length} cuenta{d.cuentas.length === 1 ? '' : 's'}</Typography>
          </div>
          <div className="flex flex-col">
            {d.cuentas.length === 0 && <Typography variant="body2" className="text-[var(--suave)]">Sin cuentas registradas.</Typography>}
            {d.cuentas.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-1.5" style={{ borderBottom: i < d.cuentas.length - 1 ? '1px solid var(--borde)' : 'none' }}>
                <div className="flex items-center gap-2.5" style={{ minWidth: 0 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, flex: 'none', background: ACC[c.id % 6] }} />
                  <div style={{ minWidth: 0 }}>
                    <div className="text-sm font-semibold truncate">{c.nombre}</div>
                    <div className="text-xs text-[var(--suave)]">{c.banco} · {c.tipo}</div>
                  </div>
                </div>
                <div className="text-sm font-semibold whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(c.saldo)}</div>
              </div>
            ))}
          </div>
          <Button size="small" onClick={() => onNavigate('cuentas')} sx={{ alignSelf: 'flex-start', mt: 'auto', textTransform: 'none', color: 'var(--suave)' }}>Ver mis cuentas →</Button>
        </Card>

        <Card component="section" aria-labelledby="sec-como-va" className="reveal-block p-5 dash-span-4 flex flex-col gap-4">
          <Typography id="sec-como-va" variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">¿Cómo va el mes?</Typography>
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2 text-[var(--ingreso)]"><TrendingUpIcon sx={{ fontSize: 16 }} /><span className="text-[var(--texto)]">Ingresos</span></span>
                <span className="text-[var(--ingreso)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(d.ingresos)}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full" style={{ background: 'var(--panel2)' }}>
                <div className="h-full rounded-full" style={{ width: '100%', background: 'var(--ingreso)' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span className="flex items-center gap-2 text-[var(--gasto)]"><TrendingDownIcon sx={{ fontSize: 16 }} /><span className="text-[var(--texto)]">Gastos</span></span>
                <span className="text-[var(--gasto)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(d.gastos)}</span>
              </div>
              <div className="mt-1.5 h-2 rounded-full" style={{ background: 'var(--panel2)' }}>
                <div className="h-full rounded-full" style={{ width: `${gastoBarW}%`, background: 'var(--gasto)' }} />
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between pt-3 mt-auto" style={{ borderTop: '1px solid var(--borde)' }}>
            <span className="text-sm font-semibold text-[var(--suave)]">Balance del mes</span>
            <span className={`font-bold ${aFavor ? 'text-[var(--ingreso)]' : 'text-[var(--gasto)]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(d.balance)}</span>
          </div>
        </Card>

        <Card component="section" aria-labelledby="sec-cuanto-debo" className="reveal-block p-5 dash-span-4 flex flex-col gap-3">
          <Typography id="sec-cuanto-debo" variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">¿Cuánto debo en tarjetas?</Typography>
          {d.tarjetas.length > 0
            ? <CreditCard tarjeta={d.tarjetas[0]} />
            : <Typography variant="body2" className="text-[var(--suave)]">Sin tarjetas registradas.</Typography>}
          <div className="flex items-end justify-between">
            <div>
              <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Deuda total</Typography>
              <Typography variant="h5" fontWeight={700} className="text-[var(--pago)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(d.deuda_total)}</Typography>
            </div>
            <Typography variant="body2" className="text-[var(--suave)]" style={{ textAlign: 'right' }}>{d.tarjetas.length} tarjeta{d.tarjetas.length === 1 ? '' : 's'}</Typography>
          </div>
          <Button size="small" onClick={() => onNavigate('tarjetas')} sx={{ alignSelf: 'flex-start', mt: 'auto', textTransform: 'none', color: 'var(--suave)' }}>Ver tarjetas →</Button>
        </Card>

        <Card component="section" aria-labelledby="sec-en-que-gasto" className="reveal-block p-5 dash-span-7 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <Typography id="sec-en-que-gasto" variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">¿En qué gasto más?</Typography>
            <Typography variant="caption" className="text-[var(--suave)]">{MESES[mes]}</Typography>
          </div>
          {!d.analisis.top_categorias.length && <Typography variant="body2" className="text-[var(--suave)]">Sin gastos este mes todavía.</Typography>}
          {d.analisis.top_categorias.map((c, i) => (
            <div key={c.nombre} className="py-1.5">
              <div className="flex justify-between gap-2 text-sm mb-1.5">
                <span className="font-semibold">{c.nombre}</span>
                <span className="font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(c.total)}</span>
              </div>
              <div className="h-2.5 rounded-full" style={{ background: 'var(--panel2)' }}>
                <div className="h-full rounded-full" style={{ width: `${Math.round(c.total / maxCategoria * 100)}%`, background: ACC[i % 6] }} />
              </div>
            </div>
          ))}
          {d.analisis.top_categorias.length > 0 && (
            <div className="flex justify-between items-center pt-3 mt-1.5" style={{ borderTop: '1px solid var(--borde)' }}>
              <span className="text-sm font-semibold text-[var(--suave)]">Total gastado en {MESES[mes]}</span>
              <span className="font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(d.gastos)}</span>
            </div>
          )}
        </Card>

        <Card component="section" aria-labelledby="sec-proximos-pagos" className="reveal-block p-5 dash-span-5 flex flex-col gap-1">
          <Typography id="sec-proximos-pagos" variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold mb-1">Próximos pagos</Typography>
          {!tarjetasPorPago.length && <Typography variant="body2" className="text-[var(--suave)]">Sin tarjetas registradas.</Typography>}
          {tarjetasPorPago.map(t => (
            <div key={t.id} className="flex items-center justify-between gap-2 py-2.5">
              <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                <span style={{
                  width: 36, height: 36, borderRadius: 999, flex: 'none', background: 'var(--panel2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--pago)',
                }}><ScheduleIcon sx={{ fontSize: 18 }} /></span>
                <div style={{ minWidth: 0 }}>
                  <div className="text-sm font-semibold truncate">{t.nombre}</div>
                  <div className="text-xs font-semibold text-[var(--pago)]">Vence en {t.dias_pago} día{t.dias_pago === 1 ? '' : 's'}</div>
                </div>
              </div>
              <div className="font-bold whitespace-nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtQ(t.saldo)}</div>
            </div>
          ))}
        </Card>

        <Card component="section" aria-labelledby="sec-ultimos-movs" className="reveal-block p-5 dash-span-12 flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 mb-1">
            <Typography id="sec-ultimos-movs" variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Últimos movimientos</Typography>
            <Button size="small" onClick={() => onNavigate('movimientos')} sx={{ textTransform: 'none', color: 'var(--suave)' }}>Ver todos →</Button>
          </div>
          {!movs.length && <Typography variant="body2" className="text-[var(--suave)]">Sin movimientos todavía.</Typography>}
          {movs.length > 0 && (
            <div style={{ overflowX: 'auto' }}>
              <div className="grid-movs text-xs font-bold uppercase tracking-wide text-[var(--suave)]" style={{ borderBottom: '1px solid var(--borde)', paddingBottom: 10 }}>
                <div>Fecha</div><div>Descripción</div><div>Categoría</div><div style={{ textAlign: 'right' }}>Monto</div>
              </div>
              {movs.slice(0, 6).map(m => (
                <div key={`${m.tipo}-${m.id}`} className="grid-movs items-center" style={{ padding: '11px 0', borderBottom: '1px solid var(--borde)' }}>
                  <div className="text-sm text-[var(--suave)]" style={{ fontVariantNumeric: 'tabular-nums' }}>{m.fecha}</div>
                  <div className="text-sm font-semibold truncate">{m.descripcion || '—'}</div>
                  <div>
                    <span className="inline-flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: 'var(--panel2)' }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, flex: 'none', background: colorMovimiento(m) }} />
                      {m.categoria || (m.tipo === 'ingreso' ? 'Ingreso' : m.tipo === 'pago' ? 'Pago' : '—')}
                    </span>
                  </div>
                  <div className={`flex items-center justify-end gap-1 text-sm font-bold text-right ${m.tipo === 'ingreso' ? 'text-[var(--ingreso)]' : m.tipo === 'pago' ? 'text-[var(--pago)]' : 'text-[var(--gasto)]'}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {m.tipo === 'ingreso' ? <TrendingUpIcon sx={{ fontSize: 15 }} /> : <TrendingDownIcon sx={{ fontSize: 15 }} />}
                    {m.tipo === 'ingreso' ? '+' : '−'}{fmtQ(m.monto)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
