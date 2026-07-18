import Image from "next/image";
import Link from "next/link";

export default function Landing() {
  return (
    <main className="relative flex flex-1 flex-col justify-center px-6 py-24 sm:px-16">
      <span className="eyebrow absolute right-6 top-8 hidden sm:right-16 sm:block">
        -16.3989&deg; S &middot; -71.5370&deg; O
      </span>

      <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-8">
        <Image src="/logo_geospot.svg" alt="GeoSpot Risk" width={56} height={60} priority />

        <p className="eyebrow text-primary">Motor de riesgo territorial &middot; Piloto Arequipa</p>

        <h1 className="text-5xl font-bold leading-[1.05] sm:text-6xl">
          Mide el riesgo territorial <span className="text-primary">antes</span> de aprobar el
          crédito.
        </h1>

        <p className="max-w-xl text-lg text-secondary">
          El historial crediticio dice cómo pagó ayer. GeoSpot Risk dice si su negocio
          sobrevivirá mañana: saturación de competencia, tráfico peatonal y demografía censal en
          un Índice de Riesgo Geo-comercial por solicitud.
        </p>

        <Link href="/explore" className="btn-primary px-8 py-3">
          Abrir plataforma
        </Link>

        <p className="eyebrow">Para cajas, cooperativas y fintechs</p>
      </div>
    </main>
  );
}
