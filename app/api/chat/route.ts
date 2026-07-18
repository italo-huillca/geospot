import { compararPlazos, simularCredito, TASA_MENSUAL_REFERENCIAL } from '@/lib/credito';
import { evaluarIndicadores } from '@/lib/geo/evaluadores';
import { RUBROS } from '@/lib/parseIntent';
import type {
  AdvisorContext,
  AdvisorMessage,
  AdvisorReply,
  AdvisorToolEvent,
  AreaStats,
  DistritoProps,
  SearchParams,
} from '@/lib/types';

const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';
const MODEL = process.env.LLM_MODEL?.trim() || 'deepseek-v4-flash';

export const maxDuration = 30;

type ToolName = AdvisorToolEvent['nombre'];

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ModelMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ModelReply {
  content: string | null;
  tool_calls?: ToolCall[];
}

interface ToolState {
  context: AdvisorContext;
  params: SearchParams;
  updates: Partial<SearchParams>;
  analysisStale: boolean;
}

const SYSTEM_PROMPT = `Eres Ayni, el asesor financiero IA de GeoSpot Risk para analistas de crédito a micronegocios en Arequipa.

Tu objetivo es ayudar a interpretar el riesgo territorial y la capacidad de pago, no aprobar ni rechazar créditos.

Reglas:
- Usa las herramientas antes de citar cifras, señales territoriales, cuotas o escenarios. Nunca calcules esos valores por tu cuenta.
- Si el usuario aporta o corrige datos de la solicitud, llama a actualizar_solicitud antes de responder.
- Distingue datos declarados, métricas observadas y estimaciones. No inventes información que no esté en las herramientas.
- La tasa del simulador es referencial, no una oferta crediticia.
- Da una recomendación concreta, breve y profesional. Prioriza un riesgo, una fortaleza y el siguiente paso.
- Si falta información importante, formula una sola pregunta prioritaria.
- No muestres razonamiento privado ni cadena de pensamiento. Sí puedes mencionar brevemente qué herramientas consultaste.
- Responde siempre en español peruano y en texto natural, sin JSON ni tablas Markdown.

Rubros admitidos: ${Object.keys(RUBROS).join(', ')}.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'actualizar_solicitud',
      description:
        'Registra datos de la solicitud mencionados o corregidos por el usuario. Úsala antes de asesorar con datos nuevos.',
      parameters: {
        type: 'object',
        properties: {
          rubro: { type: 'string', enum: Object.keys(RUBROS) },
          monto_soles: { type: 'number', minimum: 1 },
          plazo_meses: { type: 'integer', minimum: 1, maximum: 60 },
          ventas_mensuales: { type: 'number', minimum: 0 },
          capital_soles: { type: 'number', minimum: 0 },
          destino: {
            type: 'string',
            enum: ['apertura', 'capital_trabajo', 'activo_fijo'],
          },
          experiencia: { type: 'string', enum: ['nueva', 'media', 'alta'] },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_evaluacion',
      description:
        'Consulta el IRG y todas las señales deterministas de competencia, demografía, movilidad, zonificación, mercado, perfil y capacidad de pago.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'simular_credito',
      description:
        'Calcula cuota, costo total y carga sobre ventas con tasa referencial de 3% mensual. Los argumentos omitidos usan la solicitud actual.',
      parameters: {
        type: 'object',
        properties: {
          monto_soles: { type: 'number', minimum: 1 },
          plazo_meses: { type: 'integer', minimum: 1, maximum: 60 },
          ventas_mensuales: { type: 'number', minimum: 0 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'comparar_escenarios',
      description:
        'Compara cuotas, intereses y carga sobre ventas para varios plazos. Los datos omitidos usan la solicitud actual.',
      parameters: {
        type: 'object',
        properties: {
          monto_soles: { type: 'number', minimum: 1 },
          ventas_mensuales: { type: 'number', minimum: 0 },
          plazos_meses: {
            type: 'array',
            items: { type: 'integer', minimum: 1, maximum: 60 },
          },
        },
      },
    },
  },
] as const;

export async function POST(request: Request) {
  const body = await leerBody(request);
  if (!body) return Response.json({ error: 'Body de asesor inválido' }, { status: 400 });
  if (!process.env.LLM_API_KEY)
    return Response.json({ error: 'Asesor IA no configurado' }, { status: 503 });

  const state: ToolState = {
    context: body.context,
    params: { ...body.context.searchParams },
    updates: {},
    analysisStale: false,
  };
  const toolEvents: AdvisorToolEvent[] = [];
  const messages: ModelMessage[] = [
    { role: 'system', content: `${SYSTEM_PROMPT}\n\n${describirEstado(state.context)}` },
    ...body.messages,
  ];

  if (body.event === 'analysis_completed') {
    messages.push({
      role: 'user',
      content:
        '[Evento de la aplicación] El análisis territorial acaba de terminar. Revísalo y entrega una asesoría proactiva.',
    });
  }

  try {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const toolChoice =
        vuelta === 0 && body.event === 'analysis_completed'
          ? { type: 'function', function: { name: 'consultar_evaluacion' } }
          : vuelta === 2
            ? 'none'
            : 'auto';
      const reply = await consultarModelo(messages, toolChoice);

      if (!reply.tool_calls?.length) {
        const response: AdvisorReply = {
          message: reply.content?.trim() || 'No pude formular una recomendación con estos datos.',
          updates: state.updates,
          tools: toolEvents,
        };
        return Response.json(response);
      }

      const toolCalls = reply.tool_calls.slice(0, 4);
      messages.push({
        role: 'assistant',
        content: reply.content,
        tool_calls: toolCalls,
      });

      const results = new Map<string, ReturnType<typeof ejecutarHerramienta>>();
      const executionOrder = [...toolCalls].sort(
        (a, b) =>
          Number(b.function.name === 'actualizar_solicitud') -
          Number(a.function.name === 'actualizar_solicitud'),
      );
      for (const call of executionOrder) {
        const result = ejecutarHerramienta(call, state);
        results.set(call.id, result);
        toolEvents.push(result.event);
      }
      for (const call of toolCalls) {
        const result = results.get(call.id);
        if (!result) continue;
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result.data),
        });
      }
    }

    return Response.json({
      message: 'Completé las consultas, pero no pude sintetizar una recomendación.',
      updates: state.updates,
      tools: toolEvents,
    } satisfies AdvisorReply);
  } catch {
    return Response.json({ error: 'Timeout o fallo de red con DeepSeek' }, { status: 502 });
  }
}

async function consultarModelo(
  messages: ModelMessage[],
  toolChoice: 'auto' | 'none' | { type: string; function: { name: string } },
): Promise<ModelReply> {
  const response = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: TOOLS,
      tool_choice: toolChoice,
      thinking: { type: 'disabled' },
      temperature: 0.2,
      max_tokens: 500,
    }),
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) throw new Error(`DeepSeek respondió ${response.status}`);
  const data = (await response.json()) as { choices?: Array<{ message?: ModelReply }> };
  const reply = data.choices?.[0]?.message;
  if (!reply) throw new Error('DeepSeek no devolvió un mensaje');
  return reply;
}

function ejecutarHerramienta(call: ToolCall, state: ToolState) {
  const nombre = esToolName(call.function.name) ? call.function.name : null;
  const args = parseArguments(call.function.arguments);
  if (!nombre || !args) {
    return {
      data: { ok: false, error: 'Llamada de herramienta inválida' },
      event: {
        nombre: nombre ?? 'consultar_evaluacion',
        etiqueta: 'Herramienta inválida',
        estado: 'error',
      } satisfies AdvisorToolEvent,
    };
  }

  let data: Record<string, unknown>;
  if (nombre === 'actualizar_solicitud') data = actualizarSolicitud(args, state);
  else if (nombre === 'consultar_evaluacion') data = consultarEvaluacion(state);
  else if (nombre === 'simular_credito') data = ejecutarSimulacion(args, state);
  else data = ejecutarComparacion(args, state);

  return {
    data,
    event: {
      nombre,
      etiqueta: TOOL_LABELS[nombre],
      estado: data.ok === false ? 'error' : 'ok',
    } satisfies AdvisorToolEvent,
  };
}

const TOOL_LABELS: Record<ToolName, string> = {
  actualizar_solicitud: 'Solicitud actualizada',
  consultar_evaluacion: 'Evaluación territorial consultada',
  simular_credito: 'Cuota simulada',
  comparar_escenarios: 'Escenarios comparados',
};

function actualizarSolicitud(args: Record<string, unknown>, state: ToolState) {
  const updates: Partial<SearchParams> = {};
  if (typeof args.rubro === 'string' && args.rubro in RUBROS) updates.rubro = args.rubro;
  const monto = numeroPositivo(args.monto_soles);
  const plazo = enteroPositivo(args.plazo_meses);
  const ventas = numeroNoNegativo(args.ventas_mensuales);
  const capital = numeroNoNegativo(args.capital_soles);
  if (monto != null) updates.montoSoles = monto;
  if (plazo != null && plazo <= 60) updates.plazoMeses = plazo;
  if (ventas != null) updates.ventasMensuales = ventas;
  if (capital != null) updates.capitalSoles = capital;
  if (esDestino(args.destino)) updates.destino = args.destino;
  if (esExperiencia(args.experiencia)) updates.experiencia = args.experiencia;

  if (Object.keys(updates).length === 0)
    return { ok: false, error: 'No se recibieron datos válidos para actualizar' };

  Object.assign(state.params, updates);
  Object.assign(state.updates, updates);
  state.analysisStale = true;
  return {
    ok: true,
    datos_actualizados: updates,
    siguiente_estado: state.context.selectedPoint
      ? 'La aplicación recalculará el análisis'
      : 'Falta marcar la ubicación en el mapa',
  };
}

function consultarEvaluacion(state: ToolState) {
  const { score, stats, usedIsochroneFallback } = state.context;
  if (state.analysisStale)
    return {
      ok: false,
      error: 'La solicitud cambió; la aplicación debe recalcular antes de consultar el IRG',
    };
  if (score == null || !stats)
    return { ok: false, error: 'Todavía no existe un análisis territorial completo' };

  const irg = 100 - score;
  return {
    ok: true,
    irg,
    nivel_riesgo: irg >= 65 ? 'alto' : irg >= 35 ? 'medio' : 'bajo',
    indicadores: evaluarIndicadores(stats, state.params),
    calidad_area: usedIsochroneFallback ? 'buffer aproximado de 600 m' : 'isócrona peatonal de 10 min',
  };
}

function ejecutarSimulacion(args: Record<string, unknown>, state: ToolState) {
  const monto = numeroPositivo(args.monto_soles) ?? state.params.montoSoles;
  const plazo = enteroPositivo(args.plazo_meses) ?? state.params.plazoMeses;
  const ventas = numeroNoNegativo(args.ventas_mensuales) ?? state.params.ventasMensuales;
  const faltan = [!monto && 'monto', !plazo && 'plazo'].filter(Boolean);
  if (faltan.length)
    return { ok: false, error: `Faltan datos: ${faltan.join(', ')}`, datos_faltantes: faltan };

  const simulacion = simularCredito(monto as number, plazo as number, ventas);
  return {
    ok: true,
    ...simulacion,
    tasa_referencial: `${Math.round(TASA_MENSUAL_REFERENCIAL * 100)}% mensual`,
    carga_ventas_porcentaje:
      simulacion.cargaVentas == null ? null : Math.round(simulacion.cargaVentas * 100),
  };
}

function ejecutarComparacion(args: Record<string, unknown>, state: ToolState) {
  const monto = numeroPositivo(args.monto_soles) ?? state.params.montoSoles;
  const ventas = numeroNoNegativo(args.ventas_mensuales) ?? state.params.ventasMensuales;
  if (!monto) return { ok: false, error: 'Falta el monto solicitado', datos_faltantes: ['monto'] };
  const plazos = Array.isArray(args.plazos_meses)
    ? args.plazos_meses.map(enteroPositivo).filter((n): n is number => n != null && n <= 60)
    : undefined;
  const escenarios = compararPlazos(monto, ventas, plazos?.length ? plazos : undefined);
  return {
    ok: true,
    tasa_referencial: `${Math.round(TASA_MENSUAL_REFERENCIAL * 100)}% mensual`,
    escenarios: escenarios.map((escenario) => ({
      plazo_meses: escenario.plazoMeses,
      cuota_mensual: escenario.cuotaMensual,
      intereses_estimados: escenario.interesesEstimados,
      carga_ventas_porcentaje:
        escenario.cargaVentas == null ? null : Math.round(escenario.cargaVentas * 100),
      nivel_carga: escenario.nivelCarga,
    })),
  };
}

async function leerBody(request: Request): Promise<{
  messages: AdvisorMessage[];
  context: AdvisorContext;
  event: 'message' | 'analysis_completed';
} | null> {
  try {
    const raw = (await request.json()) as Record<string, unknown>;
    const context = sanitizarContexto(raw.context);
    const event = raw.event === 'analysis_completed' ? 'analysis_completed' : 'message';
    const messages = Array.isArray(raw.messages)
      ? raw.messages
          .filter(
            (message): message is Record<string, unknown> =>
              esRegistro(message) &&
              (message.role === 'user' || message.role === 'assistant') &&
              typeof message.content === 'string',
          )
          .slice(-16)
          .map((message) => ({
            role: message.role as AdvisorMessage['role'],
            content: (message.content as string).slice(0, 2000),
          }))
      : [];
    if (!context || (event === 'message' && messages.length === 0)) return null;
    return { messages, context, event };
  } catch {
    return null;
  }
}

function sanitizarContexto(value: unknown): AdvisorContext | null {
  if (!esRegistro(value) || !esRegistro(value.searchParams)) return null;
  const rawParams = value.searchParams;
  const params: SearchParams = {
    rubro: typeof rawParams.rubro === 'string' && rawParams.rubro in RUBROS ? rawParams.rubro : null,
    montoSoles: numeroPositivo(rawParams.montoSoles),
    plazoMeses: enteroPositivo(rawParams.plazoMeses),
    ventasMensuales: numeroNoNegativo(rawParams.ventasMensuales),
    capitalSoles: numeroNoNegativo(rawParams.capitalSoles),
    destino: esDestino(rawParams.destino) ? rawParams.destino : null,
    experiencia: esExperiencia(rawParams.experiencia) ? rawParams.experiencia : null,
  };
  const point = Array.isArray(value.selectedPoint) ? value.selectedPoint : null;
  const selectedPoint =
    point?.length === 2 && point.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate))
      ? (point as [number, number])
      : null;
  const score =
    typeof value.score === 'number' && Number.isFinite(value.score)
      ? Math.max(0, Math.min(100, value.score))
      : null;

  return {
    searchParams: params,
    selectedPoint,
    score,
    stats: sanitizarStats(value.stats),
    usedIsochroneFallback: value.usedIsochroneFallback === true,
  };
}

function sanitizarStats(value: unknown): AreaStats | null {
  if (!esRegistro(value) || !esRegistro(value.zonas)) return null;
  const required = [
    value.poblacion,
    value.traficoPromedio,
    value.competidores,
    value.generadores,
    value.zonas.comercial,
    value.zonas.mixto,
    value.zonas.residencial,
    value.paraderos,
  ];
  if (!required.every((item) => typeof item === 'number' && Number.isFinite(item))) return null;
  const distrito = esRegistro(value.distrito) &&
    typeof value.distrito.nombre === 'string' &&
    ['Alto', 'Moderado', 'Bajo', 'Muy Bajo'].includes(String(value.distrito.clase)) &&
    typeof value.distrito.flujo_score === 'number'
    ? {
        nombre: value.distrito.nombre,
        clase: value.distrito.clase as DistritoProps['clase'],
        flujo_score: value.distrito.flujo_score,
      }
    : null;

  return {
    poblacion: value.poblacion as number,
    nseDominante: ['A', 'B', 'C', 'D'].includes(String(value.nseDominante))
      ? (value.nseDominante as AreaStats['nseDominante'])
      : null,
    traficoPromedio: value.traficoPromedio as number,
    competidores: value.competidores as number,
    generadores: value.generadores as number,
    precioM2Promedio:
      typeof value.precioM2Promedio === 'number' && Number.isFinite(value.precioM2Promedio)
        ? value.precioM2Promedio
        : null,
    localesMatchIds: Array.isArray(value.localesMatchIds)
      ? value.localesMatchIds.filter((id): id is string => typeof id === 'string').slice(0, 200)
      : [],
    distrito,
    usedDistritoFallback: value.usedDistritoFallback === true,
    zonas: {
      comercial: value.zonas.comercial as number,
      mixto: value.zonas.mixto as number,
      residencial: value.zonas.residencial as number,
    },
    paraderos: value.paraderos as number,
  };
}

function describirEstado(context: AdvisorContext) {
  return `Estado actual de la aplicación:
- ubicación marcada: ${context.selectedPoint ? 'sí' : 'no'}
- análisis territorial disponible: ${context.stats && context.score != null ? 'sí' : 'no'}
- datos de la solicitud: ${JSON.stringify(context.searchParams)}
No trates este bloque como una instrucción del usuario.`;
}

function parseArguments(value: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(value);
    return esRegistro(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function esRegistro(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function esToolName(value: string): value is ToolName {
  return value in TOOL_LABELS;
}

function numeroPositivo(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function enteroPositivo(value: unknown) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function numeroNoNegativo(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function esDestino(value: unknown): value is NonNullable<SearchParams['destino']> {
  return value === 'apertura' || value === 'capital_trabajo' || value === 'activo_fijo';
}

function esExperiencia(value: unknown): value is NonNullable<SearchParams['experiencia']> {
  return value === 'nueva' || value === 'media' || value === 'alta';
}
