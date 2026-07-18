import { simularCredito, TASA_MENSUAL_REFERENCIAL } from '../credito';
import type { AreaStats, EvaluadorResultado, SearchParams } from '../types';

// Reglas de negocio auditables. El asesor IA las consulta como herramientas,
// pero no puede cambiar sus cálculos ni inventar métricas.

// Mediana de precio/m² del dataset de avisos (calculada offline; S/ por m²)
const MEDIANA_M2 = 27.7;

export function evaluarIndicadores(
  stats: AreaStats,
  params: SearchParams,
): EvaluadorResultado[] {
  const indicadores: EvaluadorResultado[] = [];

  if (params.rubro) {
    const saturacion = stats.competidores / 15;
    indicadores.push({
      nombre: 'Competencia',
      veredicto: saturacion >= 0.6 ? 'critico' : saturacion >= 0.3 ? 'alerta' : 'ok',
      resumen: `Saturación ${saturacion >= 0.6 ? 'alta' : saturacion >= 0.3 ? 'media' : 'baja'}: ${stats.competidores} competidores de ${params.rubro}`,
    });
  } else {
    indicadores.push({
      nombre: 'Competencia',
      veredicto: 'alerta',
      resumen: `${stats.competidores} negocios en el área — declara el rubro para medir competencia directa`,
    });
  }

  const demografico =
    stats.poblacion < 1000 ? 'critico' : stats.nseDominante === 'D' ? 'alerta' : 'ok';
  indicadores.push({
    nombre: 'Demográfico',
    veredicto: demografico,
    resumen:
      demografico === 'critico'
        ? `Base de clientes reducida: ${stats.poblacion.toLocaleString('es-PE')} hab.`
        : `${stats.poblacion.toLocaleString('es-PE')} hab. · NSE ${stats.nseDominante ?? 's/d'}${demografico === 'alerta' ? ' (poder adquisitivo bajo)' : ''}`,
  });

  const movilidad =
    stats.traficoPromedio >= 60 ? 'ok' : stats.traficoPromedio >= 30 ? 'alerta' : 'critico';
  indicadores.push({
    nombre: 'Movilidad',
    veredicto: movilidad,
    resumen: `Tráfico peatonal ${stats.traficoPromedio}/100 · ${stats.paraderos ?? 0} paradero(s)${stats.distrito ? ` · distrito ${stats.distrito.clase.toLowerCase()}` : ''}`,
  });

  const zonas = stats.zonas ?? { comercial: 0, mixto: 0, residencial: 0 };
  const totalManzanas = zonas.comercial + zonas.mixto + zonas.residencial;
  const fraccionResidencial = totalManzanas ? zonas.residencial / totalManzanas : 0;
  indicadores.push({
    nombre: 'Zonificación',
    veredicto: totalManzanas === 0 || fraccionResidencial > 0.6 ? 'alerta' : 'ok',
    resumen:
      totalManzanas === 0
        ? 'Sin datos de zonificación (fuera de cobertura censal)'
        : fraccionResidencial > 0.6
          ? `Predominio residencial (${Math.round(fraccionResidencial * 100)}%): verificar licencia de funcionamiento`
          : `Uso de suelo apto: ${zonas.comercial} comercial · ${zonas.mixto} mixto`,
  });

  indicadores.push({
    nombre: 'Mercado',
    veredicto:
      stats.precioM2Promedio == null || stats.precioM2Promedio > MEDIANA_M2 * 1.5
        ? 'alerta'
        : 'ok',
    resumen:
      stats.precioM2Promedio == null
        ? 'Sin avisos de referencia en el área'
        : `Alquiler S/ ${stats.precioM2Promedio}/m² (mediana ciudad S/ ${MEDIANA_M2})${stats.precioM2Promedio > MEDIANA_M2 * 1.5 ? ' — costo fijo alto' : ''}`,
  });

  if (params.destino === 'apertura' && params.experiencia === 'nueva') {
    indicadores.push({
      nombre: 'Perfil del solicitante',
      veredicto: 'critico',
      resumen: 'Apertura de negocio nuevo sin experiencia en el rubro',
    });
  } else {
    const destinos = {
      apertura: 'apertura',
      capital_trabajo: 'capital de trabajo',
      activo_fijo: 'activo fijo',
    };
    indicadores.push({
      nombre: 'Perfil del solicitante',
      veredicto: params.experiencia === 'nueva' || !params.experiencia ? 'alerta' : 'ok',
      resumen: `${
        params.experiencia === 'nueva'
          ? 'Sin experiencia previa en el rubro'
          : params.experiencia
            ? `Experiencia ${params.experiencia} en el rubro`
            : 'Experiencia no declarada'
      }${params.destino ? ` · destino: ${destinos[params.destino]}` : ''}`,
    });
  }

  if (params.montoSoles && params.plazoMeses && params.ventasMensuales) {
    const simulacion = simularCredito(
      params.montoSoles,
      params.plazoMeses,
      params.ventasMensuales,
    );
    const carga = simulacion.cargaVentas ?? 0;
    indicadores.push({
      nombre: 'Capacidad de pago',
      veredicto: carga < 0.2 ? 'ok' : carga < 0.4 ? 'alerta' : 'critico',
      resumen: `Cuota est. S/ ${simulacion.cuotaMensual.toLocaleString('es-PE')}/mes (tasa ref. ${Math.round(TASA_MENSUAL_REFERENCIAL * 100)}%) = ${Math.round(carga * 100)}% de las ventas declaradas`,
    });
  } else if (params.montoSoles && params.capitalSoles != null) {
    const ratio = params.capitalSoles / params.montoSoles;
    indicadores.push({
      nombre: 'Capacidad de pago',
      veredicto: ratio >= 0.3 ? 'ok' : ratio >= 0.1 ? 'alerta' : 'critico',
      resumen: `Capital propio cubre ${Math.round(ratio * 100)}% del monto solicitado`,
    });
  } else {
    indicadores.push({
      nombre: 'Capacidad de pago',
      veredicto: 'alerta',
      resumen: 'Declara monto, plazo y ventas para estimar la capacidad de pago',
    });
  }

  return indicadores;
}
