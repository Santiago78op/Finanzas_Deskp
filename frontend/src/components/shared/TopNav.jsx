import { useTheme } from '../../hooks/useTheme.js';

const VISTAS = [
  { key: 'registro', titulo: 'Registro rápido', label: 'Registro' },
  { key: 'dashboard', titulo: 'Dashboard', label: 'Dashboard' },
  { key: 'movimientos', titulo: 'Movimientos', label: 'Movimientos' },
  { key: 'tarjetas', titulo: 'Bancos y tarjetas', label: 'Bancos' },
  { key: 'ajustes', titulo: 'Ajustes y datos', label: 'Ajustes' },
];

export { VISTAS };

export default function TopNav({ vista, onNavigate }) {
  const { tema, toggle } = useTheme();

  return (
    <header id="topnav">
      <div className="logo">
        <span className="logo-ico"><svg className="ico"><use href="#ico-billetera" /></svg></span>
        <span className="logo-txt">Finanzas<b>Q</b></span>
      </div>
      <nav id="nav">
        {VISTAS.map(v => (
          <button
            key={v.key}
            className={'nav-btn' + (vista === v.key ? ' active' : '')}
            onClick={() => onNavigate(v.key, v.titulo)}
          >
            {v.label}
          </button>
        ))}
      </nav>
      <button id="btn-tema" className="tema-btn" title="Cambiar tema claro/oscuro" onClick={toggle}>
        <svg className="ico icon-sol"><use href="#ico-sol" /></svg>
        <svg className="ico icon-luna"><use href="#ico-luna" /></svg>
      </button>
    </header>
  );
}
