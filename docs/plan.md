# Documento 06 — Plan de Implementación: Secuencia de Construcción

**Fase 1: Configuración Inicial**

* Inicializar proyecto con Next.js 14+ (App Router) y TypeScript.
* Instalar dependencias clave: `tailwindcss`, `zustand`, `react-map-gl`, `mapbox-gl`, `@turf/turf`, `framer-motion` y `comlink` (para Web Workers).
* Configurar estructura de carpetas (ej. `/app`, `/components`, `/store`, `/lib/geo`, `/data`, `/workers`).
* Configurar archivo `.env.local` con las variables declaradas: `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `LLM_API_KEY` y `NEXT_PUBLIC_APP_URL`.

**Fase 2: Base de Datos y Backend Base (Proxies y Archivos Estáticos)**

* Importar y estructurar los datasets estáticos (`JSON`/`GeoJSON`) de demografía y los 71 locales comerciales dentro de la carpeta `/data`.
* Crear el endpoint de servidor `/api/chat` (Next.js API Route) que actuará como proxy seguro para comunicarse con la API de Deepseek sin exponer la `LLM_API_KEY`.
* Crear el endpoint de servidor `/api/isochrone` para actuar como proxy hacia Mapbox Isochrone API.
* Probar los endpoints mediante Postman/cURL para asegurar que devuelven los formatos esperados (JSON estructurado y GeoJSON).

**Fase 3: Autenticación (Manejo de Sesión Anónima y Estado Global)**

* *(Nota: Según el TRD, la autenticación tradicional está fuera del alcance. Esta fase se destina al estado de la "sesión" del usuario en la SPA).*
* Crear el store global con Zustand (`useAppStore`) para manejar el estado de la exploración (coordenadas seleccionadas, parámetros de búsqueda actuales, estado de carga, y resultados del análisis).
* Configurar las persistencias en memoria del navegador para asegurar que recargar la página `/explore` no rompa el estado actual de los filtros del usuario.
* Construir la lógica de ruteo y redirección (ej. redirigir de `/admin` a `/`).

**Fase 4: Funcionalidad Principal 1 - Mapa Base y Visualización de Datos**

* Construir la página Landing (`/`) con el CTA "Comenzar Exploración" que redirija a `/explore`.
* Implementar el componente principal del mapa en `/explore` utilizando `react-map-gl` abarcando el 100% del viewport.
* Renderizar las capas vectoriales en el mapa conectando los archivos estáticos de `/data` (pines de los 71 locales en alquiler y ubicaciones de la competencia).
* Construir los eventos de interacción base (clics en el mapa) para capturar las coordenadas exactas de selección y guardarlas en el store de Zustand.

**Fase 5: Funcionalidad Principal 2 - Chat IA, Filtros y Resiliencia**

* Construir los componentes de UI del Chatbot y los Filtros Manuales en el panel lateral (Desktop) o Bottom Sheet (Móvil).
* Conectar el componente de Chat con el proxy `/api/chat`, implementando la lógica para transformar la respuesta del LLM en parámetros de búsqueda estructurados.
* Implementar el sistema de "Fallback de Lenguaje": un *parser Regex local* que se active automáticamente y extraiga intenciones básicas si el proxy `/api/chat` falla o hace timeout.
* Construir las tarjetas flotantes de previsualización al hacer clic en un pin de competencia o un local disponible (mostrando precio/m² y botón de WhatsApp).

**Fase 6: Funcionalidad Principal 3 - Motor Geoespacial y Viabilidad**

* Configurar un Web Worker (usando Web Workers API nativa o `comlink`) para aislar los cálculos matemáticos del hilo principal.
* Implementar la lógica de Turf.js en el Web Worker para generar las isócronas (o el fallback circular de 600m) y calcular el "Punto Óptimo" mediante polígonos de Voronoi.
* Desarrollar el algoritmo del "Score de Viabilidad" (0-100%) dentro del Worker, cruzando la demografía del área delimitada y los locales competidores.
* Conectar la respuesta del Web Worker con la UI para pintar el polígono de caminata, renderizar el "Punto Óptimo" en el mapa y poblar el "Panel de Información Profesional" sin bloquear los 60 FPS del navegador.

**Fase 7: Pulido UI y UX**

* Construir el diseño adaptativo: Sidebar fijo a la izquierda en Desktop y comportamiento de *Bottom Sheets* superpuestos en dispositivos Móviles.
* Integrar animaciones fluidas con `framer-motion` para la pantalla inicial de carga ("Renderizando ciudad y datasets...") y las transiciones del Score de Viabilidad.
* Diseñar e integrar el Estado Vacío en el panel profesional (gráfico en blanco con instrucciones) y el medidor circular atenuado (gris) para el Score.
* Aplicar el sistema de Toasts (Notificaciones flotantes) para retroalimentación del usuario de forma no intrusiva.

**Fase 8: Testing y Manejo de Errores**

* Prueba manual exhaustiva del *happy path*: Búsqueda en el chat -> Cálculos Geoespaciales -> Visualización del Score y Punto Óptimo -> Clic en local sugerido.
* Forzar caídas de red y errores de API para verificar visualmente que: 1) El Toast naranja advierte al usuario, 2) El parser Regex toma el control del chat, 3) El buffer de 600m reemplaza a la isócrona de Mapbox.
* Validar que el evento de hacer clic fuera de los límites de Arequipa dispare correctamente el Toast de error rojo.
* Realizar perfiles de rendimiento (Performance Profiling) en las DevTools del navegador para garantizar que la UI no se congele (0 *Long Tasks* severos) durante el cálculo de Voronoi.

**Fase 9: Despliegue (Deploy)**

* Configurar el proyecto y conectar el repositorio de GitHub en Vercel.
* Insertar de manera segura las variables de entorno de producción (`NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`, `LLM_API_KEY`, `NEXT_PUBLIC_APP_URL`) en el panel de Vercel.
* Desplegar a producción y realizar pruebas de carga rápida en red 3G simulada para asegurar que los bundles iniciales del mapa y los datasets estáticos se entregan correctamente.
* Verificar que la geolocalización (si se usa) y las animaciones respondan fluidamente desde la URL en vivo, sin problemas de CORS en los proxies.

**Criterios de Completitud Global**

* El usuario puede entrar desde el navegador (móvil o desktop), enviar una consulta por chat o hacer clic en el mapa, y ver cómo se dibuja el área de influencia (isócrona/buffer), se calcula el Score de Viabilidad y se visualiza el Punto Óptimo de Voronoi en menos de 5 segundos. Todo ello ocurre manteniendo la fluidez visual a 60 FPS (sin bloqueos de pantalla) y con 100% de tolerancia a fallos de APIs externas, sin requerir base de datos backend ni registro de usuario.