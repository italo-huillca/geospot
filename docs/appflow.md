# Documento 03 — App Flow: Mapa de Navegación (GeoSpot Risk)

**Lista de Páginas**

* `/` (Landing B2B) — Propuesta de valor para cajas/cooperativas/fintechs y CTA "Abrir plataforma".
* `/explore` — Plataforma (SPA): mapa full-screen, panel de evaluación (pestañas Analista/Riesgos), informe de riesgo territorial.

**Tipo de Navegación**
Una sola pantalla inmersiva (mapa 100% del viewport).

* **Desktop:** panel izquierdo con pestañas **"Evaluación · analista"** (formulario + copiloto IA) y **"Cartera · riesgos"** (CSV); panel derecho flotante con el Informe de Riesgo Territorial; leyenda inferior; botón "Vista 3D".
* **Móvil:** panel inferior deslizable (formulario/chat, colapsable tocando la cabecera) y pestaña "IRG N%" que expande el informe como Bottom Sheet superpuesto. Vista 3D no disponible en móvil.

**Recorrido 1: Evaluación individual (analista)**

* [Clic en el mapa para marcar el negocio] → [Formulario: rubro + monto solicitado] → [Botón "Evaluar riesgo territorial"] → [Isócrona 10 min a pie + Voronoi de competencia en el mapa] → [Informe: IRG con semáforo, recomendación con el monto, señales de alerta, métricas del área, alquiler de referencia].
* Alternativa por chat: ["Bodega en el centro, piden S/ 15,000"] → [Deepseek extrae rubro y monto] → mismo flujo.

**Recorrido 2: Análisis de cartera (riesgos)**

* [Pestaña "Cartera · riesgos"] → [Pegar CSV (id, lat, lng, rubro, saldo) o "Cargar ejemplo"] → [Worker evalúa cada crédito con buffer de 600 m] → [Mapa: círculos color = riesgo, tamaño = saldo] → [Informe de cartera: saldo total, % en riesgo alto/medio, barra de distribución, alerta de concentración crítica, top créditos en riesgo]. "✕ cerrar" vuelve al modo individual.

**Recorrido 3: Exploración de contexto**

* [Clic en un pin naranja (competencia/ancla)] → [Tarjeta: nombre, rubro, badge Competencia o Generador de tráfico].
* [Clic en un punto lavanda (aviso de alquiler)] → [Tarjeta: título, S/ mes, S/ m², enlace al aviso] — referencia de costos de la zona, no inventario.
* [Botón "Vista 3D"] → [Manzanas extruidas: altura = población, color = tráfico peatonal; pitch 55°].

**Estados Vacíos**

* Informe: gráfico atenuado + "Ingresa una solicitud o haz clic en el mapa para evaluar el riesgo territorial de la zona."
* Medidor IRG: circular gris con "Esperando evaluación...".

**Estados de Error (Toasts)**

* [Fallo LLM / timeout] → Toast naranja "Conexión lenta con IA. Activando modo de filtros básicos." + parser Regex local toma el control.
* [Fallo isócronas Geoapify] → Toast naranja "Calculando área aproximada." + buffer de 600 m.
* [Clic fuera de Arequipa] → Toast rojo "El análisis del MVP está limitado a Arequipa...".
* [CSV sin filas válidas] → Toast rojo; filas parcialmente inválidas → Toast naranja con el conteo de descartadas.

**Redirecciones Clave**

* `/` → "Abrir plataforma" → `/explore`.
* Ruta no declarada (ej. `/admin`) → `/`.

**Persistencia**
Último análisis individual, punto seleccionado y parámetros sobreviven a F5 vía `sessionStorage` (sin re-consultar APIs). La cartera es efímera: se re-pega tras recargar.
