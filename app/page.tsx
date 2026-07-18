import Image from "next/image";
import Link from "next/link";

export default function Landing() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
      <Image
        src="/logo_geospot.svg"
        alt="GeoSpot Risk"
        width={96}
        height={102}
        priority
      />
      <h1 className="max-w-2xl text-4xl font-bold sm:text-5xl">
        Mide el riesgo territorial antes de aprobar el crédito
      </h1>
      <p className="max-w-xl text-lg text-secondary">
        El historial crediticio dice cómo pagó ayer. GeoSpot Risk dice si su
        negocio sobrevivirá mañana: saturación de competencia, tráfico peatonal
        y demografía censal en un Índice de Riesgo Geo-comercial por solicitud.
      </p>
      <Link
        href="/explore"
        className="rounded-lg bg-primary px-8 py-3 font-semibold text-foreground shadow-sm transition-opacity hover:opacity-90"
      >
        Abrir plataforma
      </Link>
      <p className="font-mono text-xs text-secondary">
        Para cajas, cooperativas y fintechs · Piloto: Arequipa
      </p>
    </main>
  );
}
