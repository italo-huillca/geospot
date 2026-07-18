export const TASA_MENSUAL_REFERENCIAL = 0.03;

export interface SimulacionCredito {
  montoSoles: number;
  plazoMeses: number;
  tasaMensual: number;
  cuotaMensual: number;
  pagoTotal: number;
  interesesEstimados: number;
  cargaVentas: number | null;
  nivelCarga: 'manejable' | 'precaucion' | 'alta' | null;
}

export function simularCredito(
  montoSoles: number,
  plazoMeses: number,
  ventasMensuales: number | null = null,
  tasaMensual = TASA_MENSUAL_REFERENCIAL,
): SimulacionCredito {
  if (!Number.isFinite(montoSoles) || montoSoles <= 0)
    throw new RangeError('El monto debe ser mayor que cero.');
  if (!Number.isInteger(plazoMeses) || plazoMeses <= 0)
    throw new RangeError('El plazo debe ser un número entero mayor que cero.');
  if (!Number.isFinite(tasaMensual) || tasaMensual < 0)
    throw new RangeError('La tasa mensual no puede ser negativa.');

  const cuotaExacta =
    tasaMensual === 0
      ? montoSoles / plazoMeses
      : (montoSoles * (tasaMensual * (1 + tasaMensual) ** plazoMeses)) /
        ((1 + tasaMensual) ** plazoMeses - 1);
  const cuotaMensual = Math.round(cuotaExacta);
  const pagoTotal = cuotaMensual * plazoMeses;
  const cargaVentas =
    ventasMensuales != null && Number.isFinite(ventasMensuales) && ventasMensuales > 0
      ? cuotaMensual / ventasMensuales
      : null;

  return {
    montoSoles,
    plazoMeses,
    tasaMensual,
    cuotaMensual,
    pagoTotal,
    interesesEstimados: Math.max(0, pagoTotal - montoSoles),
    cargaVentas,
    nivelCarga:
      cargaVentas == null
        ? null
        : cargaVentas < 0.2
          ? 'manejable'
          : cargaVentas < 0.4
            ? 'precaucion'
            : 'alta',
  };
}

export function compararPlazos(
  montoSoles: number,
  ventasMensuales: number | null,
  plazos: number[] = [6, 12, 18, 24],
): SimulacionCredito[] {
  return [...new Set(plazos)]
    .filter((plazo) => Number.isInteger(plazo) && plazo > 0 && plazo <= 60)
    .sort((a, b) => a - b)
    .map((plazo) => simularCredito(montoSoles, plazo, ventasMensuales));
}
