import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/AddOutlined';
import FormCuenta from './FormCuenta.jsx';
import AccountCard from '../shared/AccountCard.jsx';
import MontoAnimado from '../shared/MontoAnimado.jsx';
import { getCuentas } from '../../api/cuentas.js';
import { varsItem, varsLista } from '../../motion.js';
import Regla from '../shared/Regla.jsx';

// "Mis cuentas" con vista propia (antes vivía combinada con Tarjetas en
// TarjetasView.jsx) — split que pide FinanzasQ.dc.html (Claude Design).
// Alta/edición vía modal (no panel embebido): un formulario en el flujo
// normal se perdía entre las cards y no "resaltaba" como debería.
export default function CuentasView() {
  const [cuentas, setCuentas] = useState([]);
  const [editando, setEditando] = useState(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCuentas(await getCuentas(true));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // La grilla lista todas (incluidas las inactivas, en gris), pero el "disponible
  // total" y su conteo salen SOLO de las activas: una cuenta cerrada no es plata
  // que tengas hoy, así que tampoco se cuenta en la frase de abajo.
  const activas = cuentas.filter(c => c.activa);
  const disponibleTotal = activas.reduce((s, c) => s + c.saldo, 0);

  const abrirNueva = () => { setEditando(null); setModalAbierto(true); };
  const abrirEditar = (c) => { setEditando(c); setModalAbierto(true); };
  const cerrarModal = () => { setEditando(null); setModalAbierto(false); };

  return (
    <div id="vista-cuentas" className="vista flex flex-col">
      <Card component="section" aria-label="Disponible total" className="p-5 flex items-center justify-between gap-5 flex-wrap">
        <div>
          <Typography variant="caption" className="text-[var(--suave)] uppercase tracking-wide font-bold">Disponible total</Typography>
          <Typography variant="h4" fontWeight={700} letterSpacing="-.02em"><MontoAnimado valor={disponibleTotal} /></Typography>
        </div>
        <Typography variant="body2" className="text-[var(--suave)] max-w-xs">
          Sumado de tus {activas.length} cuenta{activas.length === 1 ? '' : 's'}. Es lo que tenés hoy, sin contar deuda de tarjetas.
        </Typography>
      </Card>

      <Regla />

      {/* Contenedor variante: las cards entran escalonadas en vez de aparecer
          las N de golpe cuando responde la API. El escalón lee como "esta es
          tu lista" y no como un salto de layout. */}
      <motion.div className="cuentas-grid" variants={varsLista} initial="oculto" animate="visible">
        {cuentas.map(c => (
          <AccountCard key={c.id} cuenta={c} onEditar={() => abrirEditar(c)} />
        ))}
        <motion.button type="button" onClick={abrirNueva} className="tile-agregar" variants={varsItem}>
          <AddIcon fontSize="small" /> Agregar cuenta
        </motion.button>
      </motion.div>

      {modalAbierto && (
        <FormCuenta editando={editando} onGuardado={() => { cerrarModal(); cargar(); }} onCerrar={cerrarModal} />
      )}
    </div>
  );
}
