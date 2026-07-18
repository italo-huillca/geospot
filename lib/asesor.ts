import { evaluarIndicadores } from './geo/evaluadores';
import type { AdvisorContext } from './types';

export function crearRespuestaLocal(contexto: AdvisorContext): string {
  const { searchParams, selectedPoint, score, stats } = contexto;
  const faltanBase = [
    !searchParams.rubro && 'el rubro',
    !searchParams.montoSoles && 'el monto solicitado',
  ].filter(Boolean);

  if (faltanBase.length) {
    return `Para comenzar necesito ${unirLista(faltanBase as string[])}. Puedes escribírmelo en una sola frase.`;
  }

  if (!selectedPoint) {
    return `Tengo registrada la solicitud de ${searchParams.rubro?.replace('_', ' ')} por S/ ${searchParams.montoSoles?.toLocaleString('es-PE')}. Marca la ubicación del negocio en el mapa para revisar su riesgo territorial.`;
  }

  if (!stats || score == null) {
    return 'Ya tengo los datos básicos. Estoy esperando que termine el análisis territorial para darte una recomendación sustentada.';
  }

  const irg = 100 - score;
  const nivel = irg >= 65 ? 'alto' : irg >= 35 ? 'medio' : 'bajo';
  const indicadores = evaluarIndicadores(stats, searchParams);
  const principal =
    indicadores.find((indicador) => indicador.veredicto === 'critico') ??
    indicadores.find((indicador) => indicador.veredicto === 'alerta');
  const fortaleza = indicadores.find((indicador) => indicador.veredicto === 'ok');
  const faltanFinancieros = [
    !searchParams.ventasMensuales && 'ventas mensuales',
    !searchParams.plazoMeses && 'plazo',
  ].filter(Boolean);

  const partes = [
    `El IRG es ${irg}%: riesgo territorial ${nivel}.`,
    principal ? `El principal punto de atención es ${principal.nombre.toLowerCase()}: ${principal.resumen}.` : null,
    fortaleza ? `A favor, ${fortaleza.nombre.toLowerCase()}: ${fortaleza.resumen}.` : null,
    faltanFinancieros.length
      ? `Para completar la capacidad de pago necesito ${unirLista(faltanFinancieros as string[])}.`
      : indicadores.find((indicador) => indicador.nombre === 'Capacidad de pago')?.resumen,
  ].filter(Boolean);

  return partes.join(' ');
}

function unirLista(elementos: string[]) {
  if (elementos.length < 2) return elementos[0] ?? '';
  return `${elementos.slice(0, -1).join(', ')} y ${elementos.at(-1)}`;
}
