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

const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Fallback mínimo cuando el asesor externo no está disponible.
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

  // Toma el mayor número ≥ 500; admite "15,000", "15.000" y "15 mil".
  const numerosDirectos = [...t.matchAll(/\d[\d.,]*/g)]
    .map((m) => Number(m[0].replace(/[.,]/g, '')))
    .filter((n) => n >= 500);
  const numerosEnMiles = [...t.matchAll(/(\d+(?:[.,]\d+)?)\s*(?:mil|k)\b/g)]
    .map((m) => Number(m[1].replace(',', '.')) * 1000)
    .filter((n) => Number.isFinite(n));
  const numeros = [...numerosDirectos, ...numerosEnMiles];
  const montoSoles = numeros.length ? Math.max(...numeros) : null;

  return { rubro, montoSoles };
}
