# Documento 05 — Esquema de Datos Estáticos: Modelado GeoJSON (MVP Client-Side)

**Estructura Estándar Base**
Todos los archivos seguirán el formato RFC 7946 GeoJSON. La validación y el tipado en TypeScript (Frontend) se centrarán exclusivamente en el objeto `properties` de cada `Feature`.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "...", "coordinates": [...] },
      "properties": { ... } 
    }
  ]
}

```

### **1. Archivo: `manzanas_centro.geojson` (Demografía)**

*Geometría esperada: `Polygon` o `MultiPolygon` (Límites de la manzana).*
*Uso principal: Cálculo del Score de Viabilidad mediante intersección con la isócrona de 10 minutos.*

**Estructura de `properties`:**

* `id` (string): Identificador único de la manzana (ej. UBIGEO + correlativo).
* `poblacion_total` (number): Cantidad estimada de habitantes en la manzana.
* `nivel_socioeconomico` (string): Segmento predominante (ej. "A", "B", "C", "D").
* `trafico_peatonal` (number): Índice normalizado (0 a 100) o peso estimado de tránsito en esa cuadra.
* `zonificacion` (string): Uso de suelo legal (ej. "Comercial", "Residencial", "Mixto").

### **2. Archivo: `todos_los_negocios.geojson` (Competencia / OSM)**

*Geometría esperada: `Point` (Ubicación exacta del negocio).*
*Uso principal: Renderizado de pines de competencia y cálculo del "Punto Óptimo" (Diagrama de Voronoi) para encontrar vacíos.*

**Estructura de `properties`:**

* `id` (string): ID único del nodo de OpenStreetMap u origen de datos.
* `nombre` (string): Nombre comercial del negocio.
* `categoria_principal` (string): Rubro macro para los filtros (ej. "gastronomia", "salud", "retail").
* `subcategoria` (string): Etiqueta específica (ej. "cafeteria", "farmacia", "boutique").
* `generador_trafico` (boolean): `true` si es un negocio ancla que atrae gente (ej. supermercado, banco, universidad), útil para sumar puntos al Score de Viabilidad en lugar de restar como competencia.

### **3. Archivo: `locales_reales.geojson` (Oferta Inmobiliaria / Scraper)**

*Geometría esperada: `Point` (Ubicación del local en alquiler).*
*Uso principal: Emparejamiento (Match) de la zona óptima con la oferta real y visualización de la tarjeta de contacto.*

**Estructura de `properties`:**

* `id` (string): Identificador único del aviso (hash o ID del portal).
* `titulo` (string): Título original del anuncio.
* `precio_soles` (number): Costo de alquiler mensual.
* `area_m2` (number): Tamaño del local.
* `precio_m2` (number): Precio por metro cuadrado (calculado previamente en el scraper para acelerar filtros de rango).
* `url_origen` (string): Link directo al portal inmobiliario.
* `telefono_contacto` (string): Número para el botón de "Contactar por WhatsApp".
* `imagen_url` (string): URL de la fotografía principal del local.

### **4. Archivo: `distritos.geojson` (Flujo Peatonal Metropolitano)**

*Geometría esperada: `Point` (centro del distrito).*
*Uso principal: contexto en el informe y fallback de tráfico peatonal fuera de la cobertura censal del Cercado.*

**Estructura de `properties`:**

* `nombre` (string): Nombre del distrito.
* `clase` (string): "Alto" | "Moderado" | "Bajo" | "Muy Bajo".
* `flujo_score` (number): Índice 0-100 normalizado del composite OSM (Comercial 25% + Peatonal 25% + Turismo 20% + Edificios 15% + Servicios 10% + Recreación 5%).

### **5. Entrada de usuario: CSV de Cartera (B2B, no es archivo del repo)**

*Pegado por el usuario en la pestaña "Cartera · riesgos". Separador `,` o `;`, cabecera opcional.*

**Columnas (alias aceptados):**

* `id` (`codigo`, `credito`): identificador del crédito.
* `lat` (`latitud`) / `lng` (`lon`, `longitud`): coordenadas del negocio (deben caer en Arequipa).
* `rubro` (`giro`, `actividad`): opcional, uno de los rubros canónicos.
* `saldo` (`monto`, `capital`): saldo vigente en soles (> 0).

---

### **Gestión de Estado (Frontend / React)**

Dado que el MVP es *stateless* y no hay base de datos, el flujo de lectura y persistencia en memoria se regirá por estas reglas:

* **Carga Inicial:** Al montar `/explore`, los 4 archivos `.geojson` se cargan mediante `fetch` desde `/public/data/` y se almacenan en el estado global de Zustand (`useGeoStore`). Se regeneran con `node data/transform.mjs` desde los crudos de `data/raw/`.
* **Estado del Chat:** El historial de la conversación con DeepSeek se mantendrá en un `useState` local del componente `ChatPanel`.
* **Persistencia Temporal:** El resultado del último análisis (Polígono de la Isócrona, Punto Óptimo calculado y Score de Viabilidad actual) se guardará en `sessionStorage` codificado como string (`JSON.stringify`). Si el juez presiona F5 o recarga la página desde el móvil, el mapa recuperará este estado instantáneamente sin re-consultar a las APIs.