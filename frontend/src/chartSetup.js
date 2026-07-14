// chartSetup.js — registro único de los elementos de Chart.js que usamos
// (build modular v4: nada viene registrado por default). Importar UNA vez
// en main.jsx antes de renderizar cualquier gráfica.
import {
  Chart, CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement,
  Legend, Tooltip,
} from 'chart.js';

Chart.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Legend, Tooltip);
