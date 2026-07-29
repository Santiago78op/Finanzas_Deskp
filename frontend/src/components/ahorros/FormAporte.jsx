import { useState } from 'react';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import Modal from '../shared/Modal.jsx';
import { crearAporte } from '../../api/ahorros.js';
import { useToast } from '../shared/Toast.jsx';
import { fmtQ, hoyISO } from '../../utils.js';

// Apartar o sacar plata de un sobre.
//
// El texto de abajo insiste en que esto NO mueve dinero, porque es la
// confusión natural: uno espera que "apartar Q500" descuente algo. No lo hace
// — tu saldo total sigue igual, solo baja lo que queda libre para gastar.
export default function FormAporte({ ahorro, onGuardado, onCerrar }) {
  const toast = useToast();
  const [sentido, setSentido] = useState('apartar');
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState(hoyISO());
  const [nota, setNota] = useState('');

  const sacando = sentido === 'sacar';

  const guardar = async () => {
    const valor = parseFloat(monto);
    if (!valor || valor <= 0) { toast('Poné un monto mayor a 0', true); return; }
    try {
      await crearAporte(ahorro.id, { fecha, monto: sacando ? -valor : valor, nota });
      toast(sacando ? 'Sacaste del ahorro ✓' : 'Apartado ✓');
      onGuardado();
    } catch (err) { toast(err.message, true); }
  };

  return (
    <Modal
      titulo={ahorro.nombre} onCerrar={onCerrar} onGuardar={guardar}
      labelGuardar={sacando ? 'Sacar' : 'Apartar'}
    >
      <ToggleButtonGroup
        exclusive value={sentido} size="small"
        onChange={(_, v) => v && setSentido(v)}
        aria-label="Apartar o sacar"
      >
        <ToggleButton value="apartar">Apartar</ToggleButton>
        <ToggleButton value="sacar">Sacar</ToggleButton>
      </ToggleButtonGroup>

      <Typography variant="body2" className="text-[var(--suave)]">
        Tenés {fmtQ(ahorro.saldo)} apartados acá.
      </Typography>

      <TextField label="Monto (Q)" type="number" required autoFocus
        inputProps={{ step: 0.01, min: 0.01 }}
        value={monto} onChange={e => setMonto(e.target.value)} />

      {/* Sin shrink, MUI v9 monta la etiqueta sobre el "dd/mm/aaaa" nativo y
          no se lee nada (mismo arreglo que el resto de los type="date"). */}
      <TextField label="Fecha" type="date" value={fecha}
        slotProps={{ inputLabel: { shrink: true } }}
        onChange={e => setFecha(e.target.value)} />

      <TextField label="Nota" placeholder="Opcional"
        value={nota} onChange={e => setNota(e.target.value)} />

      <Typography variant="body2" className="text-[var(--suave)]">
        {sacando
          ? 'Sacar no registra un gasto: solo deja de estar comprometido y vuelve a contarse como dinero libre.'
          : 'Apartar no mueve plata de ninguna cuenta. Tu saldo total sigue igual; lo que baja es cuánto te queda libre para gastar.'}
      </Typography>
    </Modal>
  );
}
