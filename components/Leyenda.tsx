'use client';

// Leyenda de colores del mapa. En desktop flota sobre el mapa;
// en móvil vive dentro del Bottom Sheet del panel profesional.
const ITEMS: { simbolo: React.ReactNode; texto: string }[] = [
  {
    simbolo: <span className="h-3 w-3 rounded-full border border-white bg-[#ffa726]" />,
    texto: 'Competencia (rubro filtrado)',
  },
  {
    simbolo: <span className="h-2 w-2 rounded-full bg-[#ffa726] opacity-40" />,
    texto: 'Ancla comercial (genera tráfico)',
  },
  {
    simbolo: <span className="h-2.5 w-2.5 rounded-full bg-accent" />,
    texto: 'Aviso de alquiler (costo de zona)',
  },
  {
    simbolo: <span className="h-3 w-3 rounded-full bg-success ring-2 ring-success/30" />,
    texto: 'Zona de menor competencia',
  },
  {
    simbolo: (
      <svg width="10" height="14" viewBox="0 0 24 32" aria-hidden>
        <path
          d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20C24 5.4 18.6 0 12 0z"
          fill="#ff4444"
        />
      </svg>
    ),
    texto: 'Negocio evaluado',
  },
  {
    simbolo: <span className="h-0.5 w-4 bg-primary" />,
    texto: 'Área e influencia (Voronoi)',
  },
];

export default function Leyenda({ className = '' }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-secondary ${className}`}>
      {ITEMS.map((i) => (
        <li key={i.texto} className="flex items-center gap-1.5">
          {i.simbolo}
          {i.texto}
        </li>
      ))}
    </ul>
  );
}
