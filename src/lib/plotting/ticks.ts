/** Автоматический выбор «красивой» цены деления и генерация засечек. */

/** Шаги вида 1, 2, 5 × 10ⁿ; цель — 5–10 интервалов по оси. */
export function niceStep(min: number, max: number): number {
  const span = Math.abs(max - min);
  if (!Number.isFinite(span) || span <= 0) return 1;
  if (span <= 12 && Number.isInteger(min) && Number.isInteger(max) && span >= 3) return 1;
  const raw = span / 8;
  const exponent = Math.floor(Math.log10(raw));
  const base = Math.pow(10, exponent);
  const fraction = raw / base;
  const multiplier = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  const step = multiplier * base;
  return Number(step.toPrecision(12));
}

/** Все основные деления оси внутри диапазона. */
export function tickValues(min: number, max: number, step: number): number[] {
  if (!Number.isFinite(step) || step <= 0) return [];
  const values: number[] = [];
  const start = Math.ceil(min / step - 1e-9);
  const end = Math.floor(max / step + 1e-9);
  const count = end - start;
  if (count > 2000) return [];
  for (let i = start; i <= end; i++) {
    const value = i * step;
    values.push(Math.abs(value) < step * 1e-9 ? 0 : Number(value.toPrecision(12)));
  }
  return values;
}

/** Первое деление после нуля (или первое деление диапазона, если нуля нет). */
export function firstStepValue(min: number, max: number, step: number): number | null {
  const values = tickValues(min, max, step);
  const positive = values.find((value) => value > 1e-12);
  if (positive !== undefined) return positive;
  return values.length ? values[values.length - 1] : null;
}

/** Есть ли ноль внутри диапазона. */
export function containsZero(min: number, max: number): boolean {
  return min <= 0 && max >= 0;
}
