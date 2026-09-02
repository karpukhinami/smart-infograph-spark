import { buildLineScene } from "../line/scene";
import { buildScene } from "../scene";
import type { PlotSceneType } from "./types";
import { mergeAiScene } from "./merge-scene";

export function validatePlotSceneJson(raw: unknown, expectedSceneType: PlotSceneType): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { valid: false, errors: ["Корень ответа должен быть JSON-объектом"] };
  }

  const root = raw as Record<string, unknown>;
  const sceneRaw = "scene" in root ? root.scene : root;

  if (!sceneRaw || typeof sceneRaw !== "object" || Array.isArray(sceneRaw)) {
    return { valid: false, errors: ["Отсутствует объект scene"] };
  }

  const space = (sceneRaw as { space?: string }).space;
  const expectedSpace = expectedSceneType === "line" ? "line" : "plane";
  if (space !== expectedSpace) {
    errors.push(`scene.space должно быть "${expectedSpace}", получено "${String(space)}"`);
  }

  let scene;
  try {
    scene = mergeAiScene(sceneRaw);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : "Не удалось разобрать сцену");
    return { valid: false, errors };
  }

  if (expectedSceneType === "line") {
    if (!scene.line) {
      errors.push("Для числовой прямой отсутствует scene.line");
      return { valid: false, errors };
    }
    const report = buildLineScene(scene.line);
    if (report.errors.length) {
      errors.push(...report.errors);
    }
    const hasContent = scene.line.sets.length > 0 || scene.line.points.length > 0;
    if (!hasContent) {
      errors.push("На числовой прямой нет множеств и точек");
    }
  } else {
    const report = buildScene(scene);
    if (report.errors.length) {
      errors.push(...report.errors);
    }
    const hasContent = scene.graphs.length > 0 || scene.points.length > 0;
    if (!hasContent) {
      errors.push("На координатной плоскости нет функций и точек");
    }
    for (const graph of scene.graphs) {
      const math = graph.math;
      if (math.kind === "explicit" && !math.expression.trim()) {
        errors.push(`График ${graph.index}: пустое выражение`);
      }
      if (math.kind === "implicit" && !math.equation.trim()) {
        errors.push(`График ${graph.index}: пустое уравнение`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function extractSceneFromGenerateResponse(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Ответ модели не является JSON-объектом");
  }
  const root = raw as Record<string, unknown>;
  if (!("scene" in root)) {
    throw new Error('В ответе отсутствует ключ "scene"');
  }
  return root.scene;
}

export function extractAnalogFromGenerateResponse(raw: unknown): { newTaskText: string; scene: unknown } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Ответ модели не является JSON-объектом");
  }
  const root = raw as Record<string, unknown>;
  if (typeof root.newTaskText !== "string") {
    throw new Error('В ответе отсутствует строка "newTaskText"');
  }
  if (!("scene" in root)) {
    throw new Error('В ответе отсутствует ключ "scene"');
  }
  return { newTaskText: root.newTaskText, scene: root.scene };
}
