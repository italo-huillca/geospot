# Documento 01 — PRD: GeoSpot Risk (Hackathon MVP · Pivot B2B)

**Tagline**
La capa de riesgo territorial que le falta al credit scoring: el historial dice cómo pagó ayer; GeoSpot Risk dice si su negocio sobrevivirá mañana.

**Problema**
Las cajas municipales, cooperativas y fintechs evalúan créditos a micronegocios con historial crediticio y visitas de campo, pero **nadie mide el riesgo de la ubicación del negocio**: saturación de competencia, tráfico peatonal, demografía del entorno. Un crédito a una bodega parada en una zona comercialmente muerta es un default anunciado que ningún buró detecta.

**Usuario Objetivo (B2B, dos personas)**

* **Analista de créditos**: evalúa solicitudes una por una; necesita un informe territorial en segundos para adjuntar al expediente.
* **Gerente / área de riesgos**: monitorea la cartera agregada (concentraciones, provisiones SBS); necesita ver la exposición territorial de todos los créditos vigentes. **Es quien compra.**

**Funcionalidades Principales (Imprescindibles)**

* **IRG — Índice de Riesgo Geo-comercial (0-100%)**: inverso del score de viabilidad comercial; cruza demografía censal, tráfico peatonal, NSE, anclas comerciales y saturación de competencia sobre el área de influencia real (isócrona de 10 min a pie).
* **Evaluación individual**: formulario (rubro + monto solicitado + ubicación por clic en mapa) → informe con IRG, semáforo, señales de alerta y recomendación accionable (proceder / verificar en campo / ajustar condiciones).
* **Copiloto IA**: el analista describe la solicitud en lenguaje natural ("bodega en el centro, piden S/15,000") y el sistema extrae rubro y monto (Deepseek + fallback Regex local).
* **Análisis de cartera**: pegar CSV de créditos vigentes georreferenciados → mapa de exposición (color = riesgo, tamaño = saldo), % de saldo en riesgo alto/medio, alerta de concentración crítica y top créditos en riesgo. Procesado 100% en el navegador vía Web Worker.
* **Vista 3D "gemelo digital"** (toggle): manzanas extruidas por población y coloreadas por tráfico peatonal.
* Motor geométrico de vacíos de competencia (Voronoi) como mitigante territorial visible.
* Sistema de resiliencia: fallback Regex si el LLM falla, buffer de 600 m si la API de isócronas falla.

**Fuera del Alcance**

* Reemplazar el credit scoring tradicional (GeoSpot Risk es una capa complementaria).
* Integración core-bancario, decisión automática de crédito, datos de mora reales (v2: calibración del IRG con mora georreferenciada del cliente).
* Backend con base de datos (procesamiento 100% client-side; los proxies solo ocultan API keys).

**Historias de Usuario**

* Como analista, quiero marcar el negocio en el mapa y obtener el IRG con señales de alerta en segundos, para adjuntarlo al expediente sin ir a campo primero.
* Como analista, quiero describir la solicitud por chat para no llenar formularios.
* Como gerente de riesgos, quiero pegar mi cartera vigente y ver qué % del saldo está en zonas de riesgo territorial alto y dónde se concentra.
* Como gerente de riesgos, quiero un top de créditos en riesgo territorial para priorizar seguimiento y cobranza de campo.
* Como jurado evaluador, quiero que la demo sobreviva caídas de APIs mediante fallbacks automáticos.

**Métricas de Éxito**

* Time-to-informe individual: < 5 s desde el clic/formulario hasta el IRG renderizado.
* Cartera de ~100 créditos analizada en < 5 s sin bloquear la UI (0 long tasks severos).
* 100% de uptime visual ante fallos de LLM o isócronas (fallbacks Regex y buffer 600 m).
* Modelo de negocio demostrable: informe por consulta (analista) + dashboard de cartera (riesgos).

**Calibración (moat de datos)**
Los pesos del IRG (demanda 30%, tráfico 20%, NSE 15%, sinergia 15%, vacío de competencia 20%) son heurísticos y viven como constantes editables. La v2 los calibra con regresión logística sobre la mora georreferenciada de cada institución cliente: misma arquitectura, pesos aprendidos.
