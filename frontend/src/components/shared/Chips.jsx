import { useEffect } from 'react';

// Chips de selección única. `value` es el ítem seleccionado (o null);
// como el pintarChips() original, selecciona el primer ítem por default
// apenas hay datos, salvo que el padre ya haya elegido explícitamente null
// (se distingue con la prop `permitirNinguno`).
export default function Chips({ items, getLabel, value, onChange, permitirNinguno = false }) {
  useEffect(() => {
    if (!permitirNinguno && value === undefined && items.length) onChange(items[0]);
  }, [items, value, onChange, permitirNinguno]);

  return (
    <div className="chips">
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          className={'chip' + (value === item ? ' sel' : '')}
          onClick={() => onChange(item)}
        >
          {getLabel(item)}
        </button>
      ))}
    </div>
  );
}
