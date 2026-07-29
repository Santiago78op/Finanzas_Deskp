import { AnimatePresence, motion } from 'motion/react';
import TableContainer from '@mui/material/TableContainer';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { fmtFecha, fmtQ } from '../../utils.js';
import { ENTRADA, SALIDA } from '../../motion.js';
import { tablaScroll } from './movimientos.styles.js';

const COLOR_TIPO = {
  gasto: 'error', ingreso: 'success', pago: 'warning',
  pago_prestamo: 'info', pago_visacuota: 'secondary',
};

const MotionRow = motion.create(TableRow);

export default function TablaMovimientos({ movs, onEditar, onEliminar }) {
  if (!movs.length) return <Typography variant="body2" className="texto-suave">No hay movimientos con esos filtros.</Typography>;

  return (
    <TableContainer sx={tablaScroll}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Fecha</TableCell>
            <TableCell>Tipo</TableCell>
            <TableCell>Descripción</TableCell>
            <TableCell>Categoría</TableCell>
            <TableCell>Método</TableCell>
            <TableCell align="right">Monto</TableCell>
            <TableCell></TableCell>
          </TableRow>
        </TableHead>
        {/* Las filas entran y salen en vez de aparecer/desaparecer de golpe.
            Importa sobre todo al FILTRAR (antes la tabla parpadeaba entera y
            costaba ver que era la misma lista, más corta) y al BORRAR: la fila
            se va sola y las de abajo suben, así se ve QUÉ se eliminó.
            `initial={false}`: la primera pintada no anima — la animación es
            para los cambios, no para la carga. */}
        <TableBody>
          <AnimatePresence initial={false}>
          {movs.map((m, i) => (
            <MotionRow
              key={`${m.tipo}-${m.id}`}
              className={`mov-${m.tipo}`}
              layout="position"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: ENTRADA }}
              exit={{ opacity: 0, x: -24, transition: SALIDA }}
            >
              <TableCell>{fmtFecha(m.fecha)}</TableCell>
              <TableCell><Chip size="small" label={m.tipo} color={COLOR_TIPO[m.tipo] || 'default'} /></TableCell>
              <TableCell>{m.descripcion || '—'}</TableCell>
              <TableCell>{m.categoria || '—'}</TableCell>
              <TableCell>{m.metodo_etiqueta}</TableCell>
              <TableCell align="right">{m.tipo === 'ingreso' ? '+' : '−'}{fmtQ(m.monto)}</TableCell>
              <TableCell>
                <Tooltip title="Editar">
                  <IconButton size="small" onClick={() => onEditar(i)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Eliminar">
                  <IconButton size="small" onClick={() => onEliminar(i)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </TableCell>
            </MotionRow>
          ))}
          </AnimatePresence>
        </TableBody>
      </Table>
    </TableContainer>
  );
}
