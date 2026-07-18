import type { SearchParams } from './types';

// Rubros canónicos: coinciden con las subcategorias del dataset transformado,
// para que el cruce de competencia sea directo contra los pines.
export const RUBROS: Record<string, string[]> = {
  cafeteria: ['cafeteria', 'cafe'],
  restaurante: ['restaurante', 'restaurant', 'cevicheria', 'polleria', 'pizzeria', 'chifa'],
  comida_rapida: ['comida rapida', 'fast food', 'hamburgueseria'],
  farmacia: ['farmacia', 'botica'],
  boutique: ['boutique', 'tienda de ropa', 'ropa', 'moda'],
  panaderia: ['panaderia', 'pasteleria'],
  bar: ['bar', 'licoreria', 'pub'],
  peluqueria: ['peluqueria', 'barberia', 'salon de belleza'],
  ferreteria: ['ferreteria'],
  bodega: ['bodega', 'minimarket', 'abarrotes'],
  supermercado: ['supermercado'],
  optica: ['optica'],
  lavanderia: ['lavanderia'],
  zapateria: ['zapateria', 'zapatos'],
  libreria: ['libreria', 'libros'],
  dentista: ['dentista', 'consultorio dental'],
};

export const SYSTEM_PROMPT = `Eres el copiloto de GeoSpot Risk, plataforma B2B que evalúa el riesgo territorial de créditos a micronegocios en Arequipa.
El usuario es un analista de crédito describiendo una solicitud. Extrae los datos y responde SOLO con un objeto JSON con estas claves:
- "rubro": el giro del negocio solicitante, uno de [${Object.keys(RUBROS).join(', ')}] o null si no se menciona.
- "monto_solicitado_soles": número (monto del crédito pedido en soles) o null.
- "respuesta": una frase corta y profesional en español confirmando lo entendido.`;

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// El chat solo extrae rubro y monto; experiencia/capital vienen del formulario.
export type IntentParams = Pick<SearchParams, 'rubro' | 'montoSoles'>;

// Fallback local: si el LLM falla o hace timeout, este parser toma el control.
export function parseIntentRegex(texto: string): IntentParams {
  const t = normalizar(texto);

  let rubro: string | null = null;
  for (const [slug, keywords] of Object.entries(RUBROS)) {
    if (keywords.some((k) => t.includes(k))) {
      rubro = slug;
      break;
    }
  }

  // ponytail: toma el mayor número ≥ 500 como monto del crédito; casos ambiguos
  // los resuelve el LLM (este es solo el modo degradado).
  const numeros = [...t.matchAll(/\d{3,7}/g)].map((m) => Number(m[0])).filter((n) => n >= 500);
  const montoSoles = numeros.length ? Math.max(...numeros) : null;

  return { rubro, montoSoles };
}

// Convierte el JSON devuelto por Deepseek en SearchParams validados.
export function parseLlmContent(content: string): { params: IntentParams; respuesta: string | null } {
  const data = JSON.parse(content);
  const rubro = typeof data.rubro === 'string' && data.rubro in RUBROS ? data.rubro : null;
  const monto = Number(data.monto_solicitado_soles);
  return {
    params: {
      rubro,
      montoSoles: Number.isFinite(monto) && monto > 0 ? monto : null,
    },
    respuesta: typeof data.respuesta === 'string' ? data.respuesta : null,
  };
}
