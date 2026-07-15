import Typography from '@mui/material/Typography';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';

// Un carrusel con 0-1 ítems no aporta nada (nada que deslizar) — Swiper se
// usa solo a partir de 2 ítems; si no, se muestra la card sola o el texto
// de estado vacío de siempre, sin envoltorio de carrusel.
export default function GridOCarrusel({ items, render, vacio }) {
  if (!items.length) return <Typography variant="body2" className="text-[var(--suave)]">{vacio}</Typography>;
  if (items.length === 1) return <div>{render(items[0])}</div>;
  return (
    <Swiper
      modules={[Navigation, Pagination]}
      navigation
      pagination={{ clickable: true }}
      spaceBetween={16}
      slidesPerView="auto"
      className="!pb-9"
    >
      {items.map(item => (
        <SwiperSlide key={item.id} style={{ width: 'auto' }}>{render(item)}</SwiperSlide>
      ))}
    </Swiper>
  );
}
