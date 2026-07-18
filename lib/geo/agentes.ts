import type { AgenteResultado, AreaStats, SearchParams } from '../types';

// Sistema multiagente de evaluación: cada agente es un módulo especializado
// determinista con entrada/salida tipada. El Web Worker actúa de orquestador
// territorial; estos veredictos se derivan de sus métricas + datos del formulario.

// Mediana de precio/m² del dataset de avisos (calculada offline; S/ por m²)
const MEDIANA_M2 = 27.7;

export function evaluarAgentes(stats: AreaStats, params: SearchParams): AgenteResultado[] {
  const agentes: AgenteResultado[] = [];

  // Agente Competencia — saturación comercial del rubro en el área
  if (params.rubro) {
    const satur = stats.competidores / 15;
    agentes.push({
      nombre: 'Competencia',
      veredicto: satur >= 0.6 ? 'critico' : satur >= 0.3 ? 'alerta' : 'ok',
      resumen: `Saturación ${satur >= 0.6 ? 'alta' : satur >= 0.3 ? 'media' : 'baja'}: ${stats.competidores} competidores de ${params.rubro}`,
    });
  } else {
    // sin rubro no hay competencia "directa" que medir, solo densidad comercial
    agentes.push({
      nombre: 'Competencia',
      veredicto: 'alerta',
      resumen: `${stats.competidores} negocios en el área — declara el rubro para medir competencia directa`,
    });
  }

  // Agente Demográfico — base de clientes y poder adquisitivo (censo INEI)
  const demografico =
    stats.poblacion < 1000 ? 'critico' : stats.nseDominante === 'D' ? 'alerta' : 'ok';
  agentes.push({
    nombre: 'Demográfico',
    veredicto: demografico,
    resumen:
      demografico === 'critico'
        ? `Base de clientes reducida: ${stats.poblacion.toLocaleString('es-PE')} hab.`
        : `${stats.poblacion.toLocaleString('es-PE')} hab. · NSE ${stats.nseDominante ?? 's/d'}${demografico === 'alerta' ? ' (poder adquisitivo bajo)' : ''}`,
  });

  // Agente Movilidad — accesibilidad peatonal y transporte
  const mov = stats.traficoPromedio >= 60 ? 'ok' : stats.traficoPromedio >= 30 ? 'alerta' : 'critico';
  agentes.push({
    nombre: 'Movilidad',
    veredicto: mov,
    resumen: `Tráfico peatonal ${stats.traficoPromedio}/100 · ${stats.paraderos ?? 0} paradero(s)${stats.distrito ? ` · distrito ${stats.distrito.clase.toLowerCase()}` : ''}`,
  });

  // Agente Zonificación — uso de suelo predominante (licencia municipal)
  // (?? por si llega un análisis rehidratado de un esquema anterior)
  const zonas = stats.zonas ?? { comercial: 0, mixto: 0, residencial: 0 };
  const totalMz = zonas.comercial + zonas.mixto + zonas.residencial;
  const fraccResidencial = totalMz ? zonas.residencial / totalMz : 0;
  agentes.push({
    nombre: 'Zonificación',
    veredicto: totalMz === 0 ? 'alerta' : fraccResidencial > 0.6 ? 'alerta' : 'ok',
    resumen:
      totalMz === 0
        ? 'Sin datos de zonificación (fuera de cobertura censal)'
        : fraccResidencial > 0.6
          ? `Predominio residencial (${Math.round(fraccResidencial * 100)}%): verificar licencia de funcionamiento`
          : `Uso de suelo apto: ${zonas.comercial} comercial · ${zonas.mixto} mixto`,
  });

  // Agente Mercado — costo inmobiliario de la zona vs. mediana de la ciudad
  agentes.push({
    nombre: 'Mercado',
    veredicto:
      stats.precioM2Promedio == null ? 'alerta' : stats.precioM2Promedio > MEDIANA_M2 * 1.5 ? 'alerta' : 'ok',
    resumen:
      stats.precioM2Promedio == null
        ? 'Sin avisos de referencia en el área'
        : `Alquiler S/ ${stats.precioM2Promedio}/m² (mediana ciudad S/ ${MEDIANA_M2})${stats.precioM2Promedio > MEDIANA_M2 * 1.5 ? ' — costo fijo alto' : ''}`,
  });

  // Agente Perfil del Solicitante — experiencia + destino del crédito
  if (params.destino === 'apertura' && params.experiencia === 'nueva') {
    agentes.push({
      nombre: 'Perfil del solicitante',
      veredicto: 'critico',
      resumen: 'Apertura de negocio nuevo sin experiencia en el rubro',
    });
  } else {
    const DESTINO = { apertura: 'apertura', capital_trabajo: 'capital de trabajo', activo_fijo: 'activo fijo' };
    agentes.push({
      nombre: 'Perfil del solicitante',
      veredicto: params.experiencia === 'nueva' || !params.experiencia ? 'alerta' : 'ok',
      resumen: `${
        params.experiencia === 'nueva'
          ? 'Sin experiencia previa en el rubro'
          : params.experiencia
            ? `Experiencia ${params.experiencia} en el rubro`
            : 'Experiencia no declarada'
      }${params.destino ? ` · destino: ${DESTINO[params.destino]}` : ''}`,
    });
  }

  // Agente Financiero — capacidad de pago: cuota estimada vs. ventas declaradas.
  // ponytail: tasa referencial de microcrédito 3%/mes; parametrizable si el cliente da la suya.
  const TASA_MENSUAL = 0.03;
  if (params.montoSoles && params.plazoMeses && params.ventasMensuales) {
    const i = TASA_MENSUAL;
    const n = params.plazoMeses;
    const cuota = Math.round((params.montoSoles * (i * (1 + i) ** n)) / ((1 + i) ** n - 1));
    const carga = cuota / params.ventasMensuales;
    agentes.push({
      nombre: 'Financiero',
      veredicto: carga < 0.2 ? 'ok' : carga < 0.4 ? 'alerta' : 'critico',
      resumen: `Cuota est. S/ ${cuota.toLocaleString('es-PE')}/mes (tasa ref. 3%) = ${Math.round(carga * 100)}% de las ventas declaradas`,
    });
  } else if (params.montoSoles && params.capitalSoles != null) {
    // sin ventas/plazo: cae al apalancamiento simple
    const ratio = params.capitalSoles / params.montoSoles;
    agentes.push({
      nombre: 'Financiero',
      veredicto: ratio >= 0.3 ? 'ok' : ratio >= 0.1 ? 'alerta' : 'critico',
      resumen: `Capital propio cubre ${Math.round(ratio * 100)}% del monto solicitado`,
    });
  } else {
    agentes.push({
      nombre: 'Financiero',
      veredicto: 'alerta',
      resumen: 'Declara monto, plazo y ventas para estimar la capacidad de pago',
    });
  }

  return agentes;
}
