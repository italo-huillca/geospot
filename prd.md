# Documento 01 — PRD: GeoSpot AI Arequipa (Hackathon MVP)

**Tagline**
Un copiloto de IA y geomarketing ejecutado en el navegador que encuentra el local comercial óptimo cruzando demografía, vacíos de competencia y oferta inmobiliaria real.

**Problema**
Los emprendedores y pequeños inversionistas retail eligen locales comerciales a ciegas o guiándose únicamente por el precio en portales inmobiliarios, asumiendo un alto riesgo de fracaso al carecer de herramientas accesibles para analizar la demanda demográfica, la saturación de competencia y las sinergias del entorno.

**Usuario Objetivo**
Emprendedores PyME e inversionistas de retail local en Arequipa (ej. dueños de cafeterías, boutiques o farmacias). Tienen el capital para alquilar, pero no cuentan con presupuesto corporativo para estudios de mercado complejos y necesitan una solución rápida (con baja barrera técnica o filtros precisos) que transforme la data espacial en un alquiler directamente accionable.

**Funcionalidades Principales (Imprescindibles)**

* Chatbot con procesamiento de lenguaje natural para extraer la intención del usuario y asignar pesos demográficos y de competencia automáticamente.
* Interfaz de filtros manuales complementarios para ajustar de forma granular el rubro, perfil de cliente y restricciones de precio de alquiler.
* Algoritmo de "Score de Viabilidad" (0-100%) dinámico basado en demografía hiper-segmentada, competencia temporal y generadores de tráfico peatonal.
* Cálculo de isócronas (10 minutos a pie) para delimitar el área real de influencia del consumidor.
* Motor de "Punto Óptimo" geométrico (Voronoi y Turf.js) para localizar visualmente el mayor vacío de competencia en la zona.
* Optimización de rendimiento mediante *chunking* (fragmentación de datos o Web Workers) para procesar altos volúmenes de información espacial sin bloquear el navegador.
* Emparejamiento en tiempo real con un dataset de 71 locales comerciales disponibles, mostrando precio/m² y botón de contacto por WhatsApp.
* Sistema de Resiliencia Técnica con fallbacks automáticos (parser Regex y radios de 600m) para garantizar el 100% de uptime en el navegador si fallan las APIs.

**Opcionales**

* Ampliación del dataset de locales a un scraping dinámico de portales inmobiliarios en tiempo real.
* Integración de datos de tráfico vehicular o peatonal vivo.
* Expansión del análisis espacial a otras provincias de la región.

**Fuera del Alcance**

* Uso de arquitectura backend tradicional o bases de datos en servidor (procesamiento 100% client-side).
* Contratación, firma de contratos o pasarelas de pago dentro de la plataforma.
* Proyecciones financieras, flujos de caja o contabilidad del negocio del usuario.
* Recomendaciones fuera del perímetro predefinido de Arequipa para este MVP.

**Historias de Usuario**

* Como emprendedor, quiero escribir mi idea en un chat para que el sistema asigne parámetros de análisis sin tener que aprender a usar herramientas GIS.
* Como usuario analítico, quiero usar filtros manuales en la interfaz para refinar mi búsqueda si el chat no captura el matiz exacto que busco para mi local.
* Como dueño de negocio, quiero ver un Score de Viabilidad codificado por colores para entender en menos de 5 segundos el potencial comercial de una cuadra.
* Como inversionista, quiero visualizar en el mapa el "Punto Óptimo" de Voronoi para descubrir y capitalizar los "huecos" sin competencia.
* Como usuario listo para abrir un negocio, quiero ver pines de locales en alquiler dentro de mi área recomendada para contactar al arrendador inmediatamente.
* Como usuario con una laptop estándar, quiero que el sistema procese la data en fragmentos (chunks) para que el mapa y el navegador no se congelen durante cálculos complejos.
* Como jurado evaluador, quiero que la plataforma mantenga su operatividad mediante fallbacks si la IA o los mapas fallan para que la demo no se interrumpa.

**Métricas de Éxito**

* **Time-to-Insight:** < 5 segundos de tiempo de carga desde el envío del prompt/filtro hasta el renderizado del Score de Viabilidad y el Punto Óptimo.
* **Fluidez del Hilo Principal (Main Thread):** 0 bloqueos severos del navegador al ejecutar el cálculo de Voronoi y carga de datos, manteniendo 60 FPS gracias a la arquitectura por chunks.
* **Tasa de Supervivencia de Fallos:** 100% de uptime visual en la interfaz, logrando que el parser Regex y el radio geométrico suplan las caídas externas automáticamente.
* **Match Rate Inmobiliario:** Más del 50% de las consultas evaluadas conectan el área de influencia con al menos 1 de los 71 avisos reales disponibles.