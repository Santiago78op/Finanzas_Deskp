import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/shared/Layout.jsx';
import RouteFade from './components/shared/RouteFade.jsx';
import RegistroView from './components/registro/RegistroView.jsx';
import DashboardView from './components/dashboard/DashboardView.jsx';
import MovimientosView from './components/movimientos/MovimientosView.jsx';
import CuentasView from './components/cuentas/CuentasView.jsx';
import TarjetasView from './components/tarjetas/TarjetasView.jsx';
import AnalisisView from './components/analisis/AnalisisView.jsx';
import AjustesView from './components/ajustes/AjustesView.jsx';

// Rutas reales por vista (antes todo vivía en un solo useState + hash leído
// una vez al montar — la URL nunca cambiaba al navegar). "/" es el home y
// redirige a "/dashboard" (la pantalla estrella del diseño, no hace falta
// una Home aparte). Cualquier path desconocido también cae a "/dashboard".
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardView />} />
          <Route path="registro" element={<RouteFade><RegistroView /></RouteFade>} />
          <Route path="cuentas" element={<RouteFade><CuentasView /></RouteFade>} />
          <Route path="tarjetas" element={<RouteFade><TarjetasView /></RouteFade>} />
          <Route path="analisis" element={<RouteFade><AnalisisView /></RouteFade>} />
          <Route path="movimientos" element={<RouteFade><MovimientosView /></RouteFade>} />
          <Route path="ajustes" element={<RouteFade><AjustesView /></RouteFade>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
