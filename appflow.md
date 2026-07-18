# Documento 03 — App Flow: Mapa de Navegación

**Lista de Páginas**

* `/` (Landing / Inicio) - Presentación del MVP, propuesta de valor rápida y CTA de entrada al mapa.
* `/explore` - Interfaz principal (Single Page Application). Contiene el mapa interactivo (Mapbox), el chat IA, visualización de competencia, y el panel de información profesional y estimación de precios.

**Tipo de Navegación**
Diseño de una sola pantalla inmersiva (Full-screen Map).

* **En Desktop:** Panel lateral izquierdo (Sidebar) para el Chat IA, y un panel derecho flotante/desplegable para la información profesional, el Score de Viabilidad y precios estimados de la zona.
* **En Móvil:** Mapa ocupando el 100% del fondo. Uso de *Bottom Sheets* (paneles inferiores deslizables): uno para la interacción de Chat y otro superpuesto que se expande para mostrar el resumen profesional y previsualización de negocios/locales.

**Primera Pantalla**
El usuario entra a `/`. Ve un titular ("Encuentra el local comercial óptimo en Arequipa con IA"), una breve descripción de la herramienta y un botón principal de "Comenzar Exploración". Al no haber login, la interacción es directa.

**Flujo de Inicio Rápido (Carga de Datos)**
[Paso 1. Clic en "Comenzar Exploración" en `/`] → [Paso 2. La app redirige a `/explore`] → [Paso 3. Muestra una animación de carga central ("Renderizando ciudad y datasets...")] → [Paso 4. Termina la carga en memoria del mapa base, demografía y locales] → [Paso 5. Desaparece el loader y se despliega el panel de Chat con mensaje de bienvenida].

**Recorrido Principal 1: Análisis Geoespacial por IA y Datos Profesionales**

* [Paso 1: El usuario escribe su intención en el chat (ej. "Cafetería por max 2500 soles")] → [Paso 2: La app muestra estado de "Analizando zona..." y ejecuta cálculos espaciales sin bloquear la UI] → [Paso 3: El usuario logra ver el Score de Viabilidad, el Punto Óptimo, y un **Panel de Información Profesional** (datos demográficos precisos, estimación de precios basada en locales de referencia y resumen del mercado)].

**Recorrido Principal 2: Análisis Interactivo por Punto en el Mapa**

* [Paso 1: El usuario hace clic libremente en cualquier ubicación específica del mapa de Arequipa] → [Paso 2: La app procesa las coordenadas de ese punto exacto] → [Paso 3: El usuario logra ver la isócrona (área de caminata) delimitada automáticamente desde ese origen y el cálculo del "Punto Óptimo" actualizado dentro de esa nueva área].

**Recorrido Principal 3: Exploración y Previsualización de la Competencia**

* [Paso 1: Tras un análisis, la app despliega pines rojos representando los negocios competidores en el área] → [Paso 2: El usuario hace clic en un pin de competencia] → [Paso 3: La app muestra una tarjeta flotante de previsualización (nombre del negocio, tipo, y características) para que el usuario conozca la saturación comercial del entorno].

**Estados Vacíos**

* `/explore` [Panel de Información Profesional]: Ilustración sutil de un gráfico en blanco con el texto: "Inicia un análisis o haz clic en el mapa para generar las métricas clave de la zona".
* `/explore` [Score de Viabilidad]: Un medidor circular atenuado (gris) con el texto "Esperando análisis...".

**Estados de Error**

* [Fallo de API LLM / Timeout]: El usuario ve un Toast (notificación flotante) naranja: "Conexión lenta con IA. Activando modo de filtros básicos." → El sistema redirige automáticamente al input Regex local.
* [Fallo de API Isócronas Mapbox]: El usuario ve un Toast naranja: "Calculando área aproximada." → El mapa dibuja inmediatamente un búfer geométrico circular de 600 metros en lugar de la isócrona de caminata real.
* [Clic fuera del perímetro permitido]: El usuario ve un Toast rojo: "El análisis del MVP está limitado a Arequipa. Por favor, selecciona un punto válido."

**Redirecciones Clave**

* Acción: Clic en "Comenzar Exploración" (Landing) → Redirige a: `/explore`
* Acción: Usuario intenta ingresar a una ruta no declarada (ej. `/admin`) → Redirige a: `/`