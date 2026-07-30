import type {
  ConnectionEntity,
  ConnectionRegion,
  ConnectionRelation,
  ConnectionRegionRelation,
  ConnectionSchemaJson,
} from "@/lib/types";

export const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
  linear_path: "Линейная последовательность",
  branching_tree: "Дерево / классификация",
  hub_and_spoke: "Центр и лучи",
  converging_diverging_flow: "Схождение / расхождение",
  parallel_lanes: "Параллельные линии",
  cycle: "Цикл",
  algorithmic_flowchart: "Блок-схема алгоритма",
};

const DIRECTIONS = new Set(["one_way", "two_way", "none"]);

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function strOrArray(v: unknown): string | string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const arr = v.map((x) => String(x).trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  return str(v);
}

export function asAddendumLines(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.filter((s) => String(s).trim() !== "").map(String) : [String(v)];
}

function normalizeDirection(v: unknown): ConnectionRelation["direction"] {
  const s = String(v ?? "").trim();
  return (DIRECTIONS.has(s) ? s : "one_way") as ConnectionRelation["direction"];
}

/** Validate + normalize the "connection schema" analysis JSON returned by the model. */
export function validateConnectionSchemaJson(raw: unknown): ConnectionSchemaJson {
  if (!raw || typeof raw !== "object") throw new Error("Ответ модели не является объектом");
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.regions)) throw new Error("В ответе отсутствует поле regions");

  const warnings: string[] = Array.isArray(o.warnings) ? (o.warnings as string[]).map(String) : [];
  const seenEntityIds = new Set<string>();

  const regions: ConnectionRegion[] = (o.regions as Record<string, unknown>[]).map((r, ri) => {
    const rid = str(r.id) ?? `r${ri + 1}`;
    const entitiesRaw = Array.isArray(r.entities) ? (r.entities as Record<string, unknown>[]) : [];
    const entities: ConnectionEntity[] = entitiesRaw.map((e, ei) => {
      let id = str(e.id) ?? `${rid}-e${ei + 1}`;
      if (seenEntityIds.has(id)) {
        warnings.push(`Дублирующийся id сущности: ${id}`);
        id = `${id}-${ri + 1}${ei + 1}`;
      }
      seenEntityIds.add(id);
      return {
        id,
        title: str(e.title),
        text: str(e.text),
        addendum: strOrArray(e.addendum),
        depiction: str(e.depiction),
        generatedImage:
          typeof e.generatedImage === "string" && e.generatedImage.startsWith("data:image/")
            ? e.generatedImage
            : null,
      };
    });

    const ids = new Set(entities.map((e) => e.id));
    const relationsRaw = Array.isArray(r.relations) ? (r.relations as Record<string, unknown>[]) : [];
    const relations: ConnectionRelation[] = relationsRaw
      .map((rel) => ({
        from: str(rel.from) ?? "",
        to: str(rel.to) ?? "",
        direction: normalizeDirection(rel.direction),
        label: str(rel.label),
      }))
      .filter((rel) => {
        const ok = ids.has(rel.from) && ids.has(rel.to);
        if (!ok) warnings.push(`Связь ссылается на несуществующую сущность: ${rel.from} → ${rel.to}`);
        return ok;
      });

    let anchorEntityId = str(r.anchorEntityId);
    if (anchorEntityId && !ids.has(anchorEntityId)) {
      warnings.push(`Якорь ${anchorEntityId} не найден среди сущностей региона ${rid}`);
      anchorEntityId = null;
    }

    return {
      id: rid,
      number: str(r.number),
      title: str(r.title),
      organizationType: str(r.organizationType) ?? "linear_path",
      anchorEntityId,
      entities,
      relations,
    };
  });

  const regionIds = new Set(regions.map((r) => r.id));
  const regionRelations: ConnectionRegionRelation[] = (
    Array.isArray(o.regionRelations) ? (o.regionRelations as Record<string, unknown>[]) : []
  )
    .map((rel) => ({
      fromRegion: str(rel.fromRegion) ?? "",
      toRegion: str(rel.toRegion) ?? "",
      direction: normalizeDirection(rel.direction),
      label: str(rel.label),
    }))
    .filter((rel) => regionIds.has(rel.fromRegion) && regionIds.has(rel.toRegion));

  return {
    kind: "connection-schema",
    sourceMode: o.sourceMode === "topic" ? "topic" : "text",
    topic: str(o.topic) ?? "",
    subject: str(o.subject),
    grade: str(o.grade),
    focusQuestion: str(o.focusQuestion) ?? "",
    displaySubtitle: str(o.displaySubtitle),
    regions,
    regionRelations,
    warnings,
  };
}

function arrow(direction: ConnectionRelation["direction"]): string {
  if (direction === "two_way") return "↔";
  if (direction === "none") return "—";
  return "→";
}

function entityLabel(e: ConnectionEntity | undefined, id: string): string {
  if (!e) return id;
  return e.title || e.text || e.depiction || id;
}

/** Human-readable Markdown rendering of the connection-schema JSON. */
export function renderConnectionSchemaJson(a: ConnectionSchemaJson): string {
  const parts: string[] = [];
  parts.push(`# ${a.topic || "Без темы"}`);
  const meta = [a.subject, a.grade].filter(Boolean).join(" · ");
  if (meta) parts.push(`*${meta}*`);
  if (a.displaySubtitle) parts.push(`> **Подзаголовок:** ${a.displaySubtitle}`);
  if (a.focusQuestion) parts.push(`> **Фокусный вопрос:** ${a.focusQuestion}`);

  a.regions.forEach((r, i) => {
    const num = r.number ? `${r.number}. ` : `${i + 1}. `;
    const orgLabel = ORGANIZATION_TYPE_LABELS[r.organizationType] ?? r.organizationType;
    parts.push(`\n---\n\n## 🗺 Регион ${num}${r.title ?? ""} _(${orgLabel})_`);

    r.entities.forEach((e) => {
      const isAnchor = r.anchorEntityId === e.id;
      const head = `#### ${isAnchor ? "⚓ " : ""}${e.title ?? e.id}`;
      const chunk: string[] = [head];
      if (e.text) chunk.push(e.text);
      const add = asAddendumLines(e.addendum);
      if (add.length) chunk.push(add.map((x) => `> 💬 ${x}`).join("\n"));
      if (e.depiction) chunk.push(`🖼 _Изображение:_ ${e.depiction}`);
      parts.push(chunk.join("\n\n"));
    });

    if (r.relations.length) {
      const byId = new Map(r.entities.map((e) => [e.id, e]));
      parts.push(
        ["**Связи:**", ...r.relations.map(
          (rel) =>
            `- ${entityLabel(byId.get(rel.from), rel.from)} ${arrow(rel.direction)} ${entityLabel(byId.get(rel.to), rel.to)}${rel.label ? ` — _${rel.label}_` : ""}`,
        )].join("\n"),
      );
    }
  });

  if (a.regionRelations.length) {
    const byId = new Map(a.regions.map((r) => [r.id, r]));
    parts.push(`\n---\n\n## 🔗 Связи между регионами`);
    parts.push(
      a.regionRelations
        .map(
          (rel) =>
            `- ${byId.get(rel.fromRegion)?.title ?? rel.fromRegion} ${arrow(rel.direction)} ${byId.get(rel.toRegion)?.title ?? rel.toRegion}${rel.label ? ` — _${rel.label}_` : ""}`,
        )
        .join("\n"),
    );
  }

  if (a.warnings.length) {
    parts.push(`\n---\n\n## ⚠ Предупреждения анализа`);
    parts.push(a.warnings.map((w) => `- ${w}`).join("\n"));
  }

  return parts.join("\n\n");
}
