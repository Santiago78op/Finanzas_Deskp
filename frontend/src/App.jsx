import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/shared/Layout.jsx';
import RegistroView from './components/registro/RegistroView.jsx';
import DashboardView from './components/dashboard/DashboardView.jsx';
import MovimientosView from './components/movimientos/MovimientosView.jsx';
import CuentasView from './components/cuentas/CuentasView.jsx';
import TarjetasView from './components/tarjetas/TarjetasView.jsx';
import PrestamosView from './components/prestamos/PrestamosView.jsx';
import AhorrosView from './components/ahorros/AhorrosView.jsx';
import AnalisisView from './components/analisis/AnalisisView.jsx';
import AjustesView from './components/ajustes/AjustesView.jsx';

// Rutas reales por vista (antes todo vivía en un solo useState + hash leído
// una vez al montar — la URL nunca cambiaba al navegar). "/" es el home y
// redirige a "/dashboard" (la pantalla estrella del diseño, no hace falta
// una Home aparte). Cualquier path desconocido también cae a "/dashboard".
//
// Las vistas ya no se envuelven en <RouteFade>: la transición de entrada Y
// salida la hace un solo <AnimatePresence> alrededor del <Outlet/> en
// Layout.jsx, así que vale para todas las rutas por igual (Dashboard incluido,
// que antes quedaba afuera).
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardView />} />
          <Route path="registro" element={<RegistroView />} />
          <Route path="cuentas" element={<CuentasView />} />
          <Route path="tarjetas" element={<TarjetasView />} />
          <Route path="prestamos" element={<PrestamosView />} />
          <Route path="ahorros" element={<AhorrosView />} />
          <Route path="analisis" element={<AnalisisView />} />
          <Route path="movimientos" element={<MovimientosView />} />
          <Route path="ajustes" element={<AjustesView />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
