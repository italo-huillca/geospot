# Documento 02 — TRD: Requisitos Técnicos

**Frontend**
Next.js 14+ (App Router), TypeScript, Tailwind CSS (para estilos rápidos y consistentes) y Zustand (para el manejo del estado global, ideal para MVP por su nulo *boilerplate*).

**Backend**
Sin backend tradicional. Se utilizarán Next.js API Routes (Serverless Functions) **exclusivamente como un proxy seguro** para ocultar las API Keys (LLM y mapas) del cliente. Toda la lógica de negocio y cálculos pesados se ejecutarán estrictamente en el navegador.

**Base de Datos**
Sin base de datos en servidor. Los datos (dataset de 71 locales comerciales, polígonos demográficos) se almacenarán como archivos estáticos `JSON` / `GeoJSON` servidos desde el CDN o importados directamente en el bundle, gestionados en memoria por el cliente.

**Auth**
Sin autenticación requerida para este MVP (reducción de fricción para los usuarios e inversionistas durante la evaluación de la hackathon).

**Hosting y Despliegue**
Vercel (Hosting unificado para el Frontend estático y las Serverless Functions del proxy de APIs. Capa gratuita generosa y despliegues automáticos desde GitHub).

**APIs de Terceros**

* Deepseek - Procesamiento de Lenguaje Natural para extraer la intención del usuario del chat y convertirla en parámetros estructurados (JSON). 
* Mapbox API - Renderizado del mapa interactivo y cálculo de Isócronas (Isochrone API para los 10 minutos a pie). - Nivel: Gratuito (Hasta 50,000 cargas de mapa y 100,000 peticiones de isócronas al mes).

**Librerías Clave**

* `@turf/turf` (v6+): Motor geoespacial principal para calcular diagramas de Voronoi, intersecciones, cálculo de distancias y el "Punto Óptimo" en el cliente.
* `react-map-gl` (con `mapbox-gl`): Wrapper de React para renderizar mapas vectoriales de alto rendimiento soportados por WebGL.
* `comlink` (opcional) o *Native Web Workers API*: Para envolver los cálculos pesados de Turf.js y procesamiento del GeoJSON en hilos secundarios (Workers), garantizando que la UI y el mapa mantengan 60 FPS sin congelarse.
* `framer-motion`: Para animaciones fluidas en la UI (ej. transición del Score de Viabilidad) sin impactar el rendimiento.

**Variables de Entorno**

* `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`
* `LLM_API_KEY` (Gemini u OpenAI, accesible solo desde el servidor/proxy)
* `NEXT_PUBLIC_APP_URL`

**Restricciones y Reglas Técnicas**

* **Procesamiento estrictamente Client-Side:** Prohibido delegar cálculos algorítmicos o cruces de bases de datos a un servidor. Toda la carga algorítmica de viabilidad debe vivir en el navegador.
* **Resiliencia de Red (Fallbacks):** Si el LLM falla o hace timeout, el sistema debe caer elegantemente a un parser de expresiones regulares (Regex) local. Si la API de isócronas falla, debe caer a un búfer geométrico circular de 600 metros de radio usando Turf.js.
* **Non-blocking UI (Web Workers):** Cualquier cálculo geoespacial iterativo (especialmente Voronoi sobre el dataset) debe dividirse en *chunks* (fragmentación) o delegarse a un Web Worker. El *Main Thread* no puede bloquearse por más de 50ms.
* **Mobile-Responsive:** La interfaz de chat, los filtros y el mapa deben ser 100% funcionales en dispositivos móviles, ya que muchos inversionistas buscarán locales estando en la calle.