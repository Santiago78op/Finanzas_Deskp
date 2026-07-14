import { useTickerNumber } from '../../hooks/useTickerNumber.js';
import { fmtQ } from '../../utils.js';

export default function PanelSalario({ d }) {
  const dias = d.dias_proximo_salario;
  const disponibleTexto = useTickerNumber(d.disponible_salario);
  const ritmo = dias ? fmtQ(Math.max(0, d.disponible_salario) / dias) + '/día' : '—';

  return (
    <div className="tarjeta-salario">
      <div>
        <div className="chico">Disponible del salario este mes</div>
        <div className="grande">{disponibleTexto}</div>
      </div>
      <div>
        <div className="chico">Próximo salario</div>
        <div className="grande">{dias === null ? '—' : dias === 0 ? '¡HOY!' : `en ${dias} días`}</div>
      </div>
      <div>
        <div className="chico">Ritmo diario disponible</div>
        <div className="grande">{ritmo}</div>
      </div>
    </div>
  );
}
