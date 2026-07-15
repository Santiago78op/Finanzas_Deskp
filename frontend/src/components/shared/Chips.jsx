import { useEffect } from 'react';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';

// Chips de selección única. `value` es el ítem seleccionado (o null);
// como el pintarChips() original, selecciona el primer ítem por default
// apenas hay datos, salvo que el padre ya haya elegido explícitamente null
// (se distingue con la prop `permitirNinguno`).
export default function Chips({ items, getLabel, value, onChange, permitirNinguno = false }) {
  useEffect(() => {
    if (!permitirNinguno && value === undefined && items.length) onChange(items[0]);
  }, [items, value, onChange, permitirNinguno]);

  return (
    <Stack direction="row" flexWrap="wrap" gap={1}>
      {items.map((item, i) => (
        <Chip
          key={i}
          label={getLabel(item)}
          clickable
          color={value === item ? 'primary' : 'default'}
          variant={value === item ? 'filled' : 'outlined'}
          onClick={() => onChange(item)}
        />
      ))}
    </Stack>
  );
}
