# Documento 02 — TRD: Requisitos Técnicos (GeoSpot Risk · estado real)

**Frontend**
Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Zustand v5 (estado global con persistencia en `sessionStorage`, versionada), framer-motion (loader, transiciones del IRG, bottom sheets).

**Backend**
Sin backend tradicional. Next.js Route Handlers **exclusivamente como proxy seguro** de API keys:

* `POST /api/chat` → Deepseek (`deepseek-chat`, JSON mode, timeout 8 s).
* `GET /api/isochrone?lng&lat&minutes` → Geoapify Isoline API (walk). *(Nota: originalmente Mapbox; se migró a Geoapify por decisión del producto.)*

**Base de Datos**
Sin base de datos en servidor. Datasets estáticos GeoJSON en `/public/data/` (generados por `data/transform.mjs` desde los crudos de `data/raw/`), cargados por `fetch` al montar `/explore` y mantenidos en memoria (Zustand).

**Mapas**
`react-map-gl` v8 + **maplibre-gl** (no mapbox-gl). Estilo base `dark-matter` de Geoapify, re-tintado en runtime a paleta teal. Capas WebGL: competencia/anclas (filtradas por rubro), avisos de alquiler (referencia de costos), isócrona, celdas de Voronoi, cartera (color = IRG, tamaño = saldo) y extrusión 3D de manzanas (toggle).

**Motor Geoespacial**
`@turf/turf` v7 ejecutado íntegramente en un **Web Worker nativo** (`workers/analysis.worker.ts`):

* Área de influencia: isócrona de Geoapify o fallback `circle` de 600 m.
* IRG = 100 − score de viabilidad (pesos en `lib/geo/analysis.ts`, constantes `W`).
* Voronoi de competidores recortado al área (capa visual + mayor vacío).
* Modo batch `cartera`: score sin Voronoi por crédito, buffer fijo de 600 m.

**IA**

* Deepseek para extracción de intención (rubro, monto) con prompt B2B.
* Fallback local: parser Regex (`lib/parseIntent.ts`) si el proxy falla o excede 9 s.

**Variables de Entorno**

* `NEXT_PUBLIC_GEOAPIFY_API_KEY` (tiles + isolíneas; pública por diseño, como los tokens de tiles)
* `LLM_API_KEY` (Deepseek, solo servidor)
* `NEXT_PUBLIC_APP_URL`

**Hosting y Despliegue**
Vercel (frontend estático + route handlers). Despliegue automático desde GitHub.

**Restricciones y Reglas Técnicas**

* Procesamiento estrictamente client-side; los proxies no contienen lógica de negocio.
* Resiliencia: todo fallo externo degrada a un fallback local visible vía Toast (naranja) sin romper el flujo.
* Non-blocking UI: cálculos geoespaciales solo en el Worker; main thread < 50 ms.
* Mobile-responsive: bottom sheets para formulario/chat e informe; la vista 3D es desktop-only.
* Clics fuera del perímetro de Arequipa se rechazan con Toast rojo.

**Testing**
Autochequeos con asserts (`npx tsx`) para parser de intención, parser de cartera y motor geoespacial sobre datasets reales; E2E con `playwright-core` (scripts en scratchpad) cubriendo evaluación individual, cartera y toggle 3D.
