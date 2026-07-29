import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme as useMuiTheme } from '@mui/material/styles';

// `extra`: acción secundaria (ej. "Eliminar cuenta") alineada a la izquierda,
// separada de Cancelar/Guardar — para acciones destructivas que no encajan
// como la acción primaria del modal.
export default function Modal({ titulo, onCerrar, onGuardar, children, labelGuardar = 'Guardar', labelCerrar = 'Cancelar', peligro = false, extra }) {
  const muiTheme = useMuiTheme();
  const fullScreen = useMediaQuery(muiTheme.breakpoints.down('sm'));

  return (
    <Dialog open onClose={onCerrar} fullWidth maxWidth="xs" fullScreen={fullScreen}>
      <DialogTitle>{titulo}</DialogTitle>
      {/* pt:1 y overflow visible en el eje X: el DialogContent de MUI recorta
          por arriba la etiqueta flotante del PRIMER campo (la "Tipo" o "Banco"
          que aparecía cortada a la mitad), porque la etiqueta se dibuja fuera
          del borde superior del input y el contenedor la corta al hacer
          scroll. El padding le da el aire que necesita. */}
      <DialogContent className="flex flex-col gap-3" sx={{ pt: 2 }}>{children}</DialogContent>
      <DialogActions sx={{ justifyContent: extra ? 'space-between' : 'flex-end' }}>
        {extra}
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={onCerrar}>{labelCerrar}</Button>
          <Button onClick={onGuardar} variant="contained" color={peligro ? 'error' : 'primary'}>{labelGuardar}</Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
