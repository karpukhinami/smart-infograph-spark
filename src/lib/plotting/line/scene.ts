/** Построение сцены числовой прямой: множества, точки, синхронизация границ. */
import { evaluateNumber, exactDisplay, makeMathValue } from "../math-expr";
import { parseIntervalMath, type ParsedInterval } from "./intervals";
import type {
  BuiltSet,
  LineSceneData,
  SceneLinePoint,
  SceneSet,
  SetMath,
} from "./types";
import { DEFAULT_LINE_TICKS, LINE_APPEARANCE_OVERRIDES } from "./types";
import { DEFAULT_APPEARANCE, nextId, PLOT_PALETTE } from "../scene";

export function createLineSceneData(): LineSceneData {
  return {
    axis: { name: "x", unit: "", min: "-5", max: "5", majorStep: "1" },
    ticks: { ...DEFAULT_LINE_TICKS },
    axisRowCount: 1,
    sets: [],
    points: [],
  };
}

export function createLineScene() {
  return {
    version: 1 as const,
    space: "line" as const,
    axisScaleMode: "independent" as const,
    plotAspectRatio: "4:3" as const,
    xAxis: { name: "x", unit: "", min: "", max: "", gridStep: "1", labelStep: "", labelFormat: "number" as const, markRule: "all" as const, selectedMarks: "" },
    yAxis: { name: "y", unit: "", min: "", max: "", gridStep: "1", labelStep: "", labelFormat: "number" as const, markRule: "all" as const, selectedMarks: "" },
    grid: { visible: false },
    appearance: {
      ...DEFAULT_APPEARANCE,
      ...LINE_APPEARANCE_OVERRIDES,
    },
    graphs: [],
    points: [],
    tangents: [],
    customColors: [],
    line: createLineSceneData(),
  };
}

export function createSet(index: number, axisRow: number): SceneSet {
  return {
    id: nextId("set"),
    index,
    axisRow,
    math: {
      kind: "interval",
      left: "",
      right: "",
      leftOp: "<",
      rightOp: "<=",
      rayOp: ">=",
      rayBoundary: "",
      freeformInput: "",
    },
    style: {
      color: PLOT_PALETTE[(index - 1) % PLOT_PALETTE.length],
      display: "hatchRight",
      position: "above",
      visible: true,
    },
    kindLocked: false,
    built: null,
    dirty: true,
    error: null,
  };
}

export function createLinePoint(index: number, axisRow: number): SceneLinePoint {
  return {
    id: nextId("lpoint"),
    index,
    axisRow,
    math: { coordinate: "", sourceSetId: null, boundaryKey: null },
    style: {
      color: "#29A2E5",
      colorManual: false,
      open: false,
      label: "",
      showLabel: true,
      showCoords: true,
      visible: true,
      labelSide: "above",
      labelColor: "point",
      coordSide: "below",
      coordColor: "axis",
      perpendicular: false,
    },
    built: null,
    dirty: true,
    error: null,
    locked: false,
  };
}

function boundariesFromParts(parts: ParsedInterval[]): BuiltSet["boundaries"] {
  const boundaries: BuiltSet["boundaries"] = [];
  parts.forEach((part, partIndex) => {
    if (Number.isFinite(part.left)) {
      boundaries.push({
        key: `${partIndex}-left`,
        x: part.left,
        open: !part.leftInclusive,
        display: exactDisplay(part.left),
      });
    }
    if (Number.isFinite(part.right)) {
      boundaries.push({
        key: `${partIndex}-right`,
        x: part.right,
        open: !part.rightInclusive,
        display: exactDisplay(part.right),
      });
    }
  });
  return boundaries;
}

function builtCoord(raw: string, x: number): { x: number; displayX: string; latex: string } {
  try {
    const mv = makeMathValue(raw);
    return { x: mv.value, displayX: mv.display, latex: mv.latex ?? mv.display };
  } catch {
    return { x, displayX: exactDisplay(x), latex: exactDisplay(x) };
  }
}

function findPointAtCoordinate(
  points: SceneLinePoint[],
  axisRow: number,
  x: number,
): SceneLinePoint | undefined {
  return points.find(
    (point) =>
      point.axisRow === axisRow &&
      point.built &&
      Math.abs(point.built.x - x) < 1e-9,
  );
}

function syncBoundaryPoints(line: LineSceneData, set: SceneSet, built: BuiltSet): SceneLinePoint[] {
  let points = [...line.points];
  const wantedKeys = new Set(built.boundaries.map((b) => `${set.id}:${b.key}`));

  points = points.filter((point) => {
    if (point.math.sourceSetId !== set.id) return true;
    const key = `${set.id}:${point.math.boundaryKey}`;
    return wantedKeys.has(key);
  });

  for (const boundary of built.boundaries) {
    const existing = points.find(
      (p) => p.math.sourceSetId === set.id && p.math.boundaryKey === boundary.key,
    );
    if (existing) {
      points = points.map((p) =>
        p.id === existing.id
          ? {
              ...p,
              math: { ...p.math, coordinate: boundary.display },
              style: {
                ...p.style,
                open: boundary.open,
                color: p.style.colorManual ? p.style.color : set.style.color,
              },
              built: builtCoord(boundary.display, boundary.x),
              dirty: false,
              error: null,
            }
          : p,
      );
      continue;
    }

    const atCoord = findPointAtCoordinate(points, set.axisRow, boundary.x);
    if (atCoord) continue;

    const point = createLinePoint(points.length + 1, set.axisRow);
    point.math = {
      coordinate: boundary.display,
      sourceSetId: set.id,
      boundaryKey: boundary.key,
    };
    point.style = {
      ...point.style,
      color: set.style.color,
      open: boundary.open,
    };
    point.built = builtCoord(boundary.display, boundary.x);
    point.locked = true;
    point.dirty = false;
    points.push(point);
  }

  return points.map((p, i) => ({ ...p, index: i + 1 }));
}

export function buildSetMath(line: LineSceneData, set: SceneSet): { set: SceneSet; line: LineSceneData } {
  const parsed = parseIntervalMath(set.math);
  if (parsed.error) {
    return {
      set: { ...set, error: parsed.error, dirty: true },
      line,
    };
  }

  const built: BuiltSet = {
    parts: parsed.parts,
    displayText: parsed.displayText,
    latexText: parsed.latexText,
    boundaries: boundariesFromParts(parsed.parts),
  };

  const nextSet: SceneSet = {
    ...set,
    built,
    kindLocked: true,
    dirty: false,
    error: null,
  };

  const points = syncBoundaryPoints(line, nextSet, built);
  const axisRowCount = Math.max(
    line.axisRowCount,
    ...line.sets.map((s) => (s.id === set.id ? nextSet.axisRow : s.axisRow)),
    nextSet.axisRow + 1,
  );

  return {
    set: nextSet,
    line: { ...line, points, axisRowCount },
  };
}

export function buildLinePoint(
  line: LineSceneData,
  point: SceneLinePoint,
): { point: SceneLinePoint; line: LineSceneData } {
  if (point.locked) return { point, line };
  try {
    const mv = makeMathValue(point.math.coordinate);
    if (!Number.isFinite(mv.value)) throw new Error("Координата должна быть конечным числом.");
    return {
      point: {
        ...point,
        built: { x: mv.value, displayX: mv.display, latex: mv.latex ?? mv.display },
        dirty: false,
        error: null,
      },
      line,
    };
  } catch (error) {
    return {
      point: { ...point, error: (error as Error).message, dirty: true },
      line,
    };
  }
}

export interface LineBuildReport {
  line: LineSceneData;
  built: number;
  errors: string[];
}

export function buildLineScene(line: LineSceneData): LineBuildReport {
  let current = { ...line, sets: [...line.sets], points: [...line.points] };
  const errors: string[] = [];
  let built = 0;

  current.sets = current.sets.map((set) => {
    if (!set.dirty && set.built?.parts?.length) return set;
    const result = buildSetMath(current, set);
    current = { ...current, points: result.line.points, axisRowCount: result.line.axisRowCount };
    if (result.set.error) errors.push(`Множество ${set.index}: ${result.set.error}`);
    else built += 1;
    return result.set;
  });

  current.points = current.points.map((point) => {
    if (!point.dirty && point.built) return point;
    const result = buildLinePoint(current, point);
    if (result.point.error) errors.push(`Точка ${point.index}: ${result.point.error}`);
    else if (!point.locked) built += 1;
    return result.point;
  });

  return { line: current, built, errors };
}

/** Обновить открытость граничной точки → синхронизировать множество. */
export function syncSetFromBoundaryPoint(
  line: LineSceneData,
  point: SceneLinePoint,
  open: boolean,
): LineSceneData {
  if (!point.math.sourceSetId || !point.math.boundaryKey || !point.built) return line;

  const sets = line.sets.map((set) => {
    if (set.id !== point.math.sourceSetId || !set.built) return set;

    const partIndex = Number(point.math.boundaryKey!.split("-")[0]);
    const side = point.math.boundaryKey!.endsWith("-left") ? "left" : "right";
    const parts = set.built.parts.map((part, idx) => {
      if (idx !== partIndex) return part;
      if (side === "left") return { ...part, leftInclusive: !open };
      return { ...part, rightInclusive: !open };
    });

    const math = applyPartsToMath(set.math, parts);
    const parsed = parseIntervalMath(math);
    if (parsed.error) return set;

    const built: BuiltSet = {
      parts: parsed.parts,
      displayText: parsed.displayText,
      latexText: parsed.latexText,
      boundaries: boundariesFromParts(parsed.parts),
    };

    return { ...set, math, built, dirty: false };
  });

  return { ...line, sets };
}

function applyPartsToMath(math: SetMath, parts: ParsedInterval[]): SetMath {
  if (math.kind === "freeform") {
    const text = parts
      .map((part) => {
        const lb = part.leftInclusive ? "[" : "(";
        const rb = part.rightInclusive ? "]" : ")";
        const left = part.left === -Infinity ? "-inf" : exactDisplay(part.left);
        const right = part.right === Infinity ? "+inf" : exactDisplay(part.right);
        return `${lb}${left}; ${right}${rb}`;
      })
      .join("; ");
    return { ...math, freeformInput: text };
  }

  if (math.kind === "interval" && parts.length === 1) {
    const part = parts[0];
    return {
      ...math,
      left: part.left === -Infinity ? "-inf" : exactDisplay(part.left),
      right: part.right === Infinity ? "+inf" : exactDisplay(part.right),
      leftOp: part.leftInclusive ? "<=" : "<",
      rightOp: part.rightInclusive ? "<=" : "<",
    };
  }

  if (math.kind === "ray" && parts.length === 1) {
    const part = parts[0];
    if (part.left === -Infinity) {
      return {
        ...math,
        rayOp: part.rightInclusive ? "<=" : "<",
        rayBoundary: exactDisplay(part.right),
      };
    }
    return {
      ...math,
      rayOp: part.leftInclusive ? ">=" : ">",
      rayBoundary: exactDisplay(part.left),
    };
  }

  return math;
}

export function removeSetFromLine(line: LineSceneData, setId: string): LineSceneData {
  const points = line.points.filter((p) => p.math.sourceSetId !== setId);
  const sets = line.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, index: i + 1 }));
  return {
    ...line,
    sets,
    points: points.map((p, i) => ({ ...p, index: i + 1 })),
    axisRowCount: Math.max(1, ...sets.map((s) => s.axisRow + 1), 1),
  };
}
