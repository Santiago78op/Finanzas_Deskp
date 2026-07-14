import { useEffect, useState } from 'react';
import { api } from '../../api.js';
import { fmtQ } from '../../utils.js';
import { useDataVersion } from '../../context/DataVersionContext.jsx';

// Franja de cifras clave visible en toda la app (no solo en Dashboard). Hace
// su propio fetch independiente del mes actual — no depende de que el
// usuario haya entrado a Dashboard todavía. Vive montado una sola vez (fuera
// del ciclo de vida de las vistas), así que escucha `version` para
// refrescarse cada vez que se guarda/edita/borra algo en cualquier vista.
export default function TickerGlobal() {
  const [d, setD] = useState(null);
  const { version } = useDataVersion();

  useEffect(() => {
    let vivo = true;
    api('/api/dashboard').then(data => { if (vivo) setD(data); }).catch(() => {});
    return () => { vivo = false; };
  }, [version]);

  if (!d) return <div id="ticker-global"><div className="ticker-pista" /></div>;

  const items = [
    ['Saldo en cuentas', d.dinero_total],
    ['Ingresos del mes', d.ingresos],
    ['Gastos del mes', d.gastos],
    ['Deuda en tarjetas', d.deuda_total],
  ];
  // Duplicado para el loop continuo (CSS anima translateX(-50%)).
  const dosVueltas = [...items, ...items];

  return (
    <div id="ticker-global">
      <div className="ticker-pista">
        {dosVueltas.map(([t, v], i) => (
          <span className="ticker-item" key={i}>{t}<b>{fmtQ(v)}</b></span>
        ))}
      </div>
    </div>
  );
}
