import { useEffect, useState } from 'react';
import { fmtQ } from '../utils.js';

// Port de animarTickers() (Magic UI number ticker): anima el monto de 0 a su
// valor cada vez que `valor` cambia, con ease cúbico sobre 650ms.
export function useTickerNumber(valor) {
  const [texto, setTexto] = useState(() => fmtQ(0));

  useEffect(() => {
    let vivo = true;
    const objetivo = parseFloat(valor) || 0;
    const inicio = performance.now();
    const dur = 650;
    const ease = t => 1 - Math.pow(1 - t, 3);

    function paso(ahora) {
      if (!vivo) return;
      const p = Math.min(1, (ahora - inicio) / dur);
      setTexto(fmtQ(objetivo * ease(p)));
      if (p < 1) requestAnimationFrame(paso);
    }
    requestAnimationFrame(paso);

    return () => { vivo = false; };
  }, [valor]);

  return texto;
}
