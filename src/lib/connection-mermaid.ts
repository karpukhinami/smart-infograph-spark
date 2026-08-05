import type {
  ConnectionEntity,
  ConnectionRegion,
  ConnectionRelation,
  ConnectionSchemaJson,
} from "@/lib/types";
import { asAddendumLines, coreEntityIds, regionAnchorId } from "@/lib/connection-schema";


export interface MermaidBuildResult {
  code: string;
  warnings: string[];
  errors: string[];
}

/** Natural sort: e2 before e10. */
function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Mermaid-safe node id. */
function safeId(raw: string, fallback: string): string {
  const s = String(raw ?? "").replace(/[^A-Za-z0-9_]/g, "_");
  const id = s && /^[A-Za-z_]/.test(s) ? s : `n_${s || fallback}`;
  return id.toLowerCase() === "end" ? `${id}_` : id;
}

/** Escape text for an HTML label inside a quoted Mermaid node. */
function esc(raw: unknown): string {
  return String(raw ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\|/g, "&#124;")
    .replace(/\n+/g, "<br/>")
    .trim();
}

/** Escape text used as an edge label (no HTML tags). */
function escEdge(raw: unknown): string {
  return esc(raw).replace(/<br\/>/g, " ");
}

function nodeLabel(e: ConnectionEntity): string {
  const lines: string[] = [];
  const title = e.title?.trim();
  const text = e.text?.trim();
  if (title) lines.push(`<b>${esc(title)}</b>`);
  if (text) lines.push(esc(text));
  if (!lines.length) lines.push(esc(e.depiction) || esc(e.id));

  const add = asAddendumLines(e.addendum)
    .map((s) => esc(s))
    .filter(Boolean);
  if (add.length) lines.push(`<i>[${add.join("; ")}]</i>`);

  return lines.join("<br/>");
}

function subgraphTitle(r: ConnectionRegion): string {
  const num = r.number?.trim();
  const title = r.title?.trim();
  if (num && title) return `${num}. ${title}`;
  return title || num || r.id;
}

function anchorFor(r: ConnectionRegion, warnings: string[]): ConnectionEntity | null {
  if (!r.entities.length) return null;
  const anchorId = regionAnchorId(r);
  if (anchorId) {
    const found = r.entities.find((e) => e.id === anchorId);
    if (found) return found;
    warnings.push(`Регион ${r.id}: якорь «${anchorId}» не найден, взята первая сущность по ID`);
  }
  return [...r.entities].sort((a, b) => naturalCompare(a.id, b.id))[0];
}

/**
 * Relations implied by the region core (linear/cyclic route, hub) that the model
 * did not list explicitly. Keeps the diagram connected for the new schema.
 */
function implicitCoreRelations(r: ConnectionRegion, existing: ConnectionRelation[]): ConnectionRelation[] {
  const core = r.core;
  if (!core) return [];
  const has = new Set(existing.map((rel) => `${rel.from}|${rel.to}`));
  const hasEither = (a: string, b: string) => has.has(`${a}|${b}`) || has.has(`${b}|${a}`);
  const out: ConnectionRelation[] = [];
  const add = (from: string, to: string) => {
    if (from === to || hasEither(from, to)) return;
    has.add(`${from}|${to}`);
    out.push({ from, to, direction: "one_way", label: null });
  };

  for (const seq of core.entityIdSequences) {
    if (seq.length < 2) continue;
    if (core.type === "hub") {
      const [center, ...spokes] = seq;
      spokes.forEach((s) => add(center, s));
      continue;
    }
    for (let i = 0; i < seq.length - 1; i += 1) add(seq[i], seq[i + 1]);
    if (core.type === "cyclic_route") add(seq[seq.length - 1], seq[0]);
  }
  return out;
}

function arrow(direction: string, label: string | null): string {
  const l = label?.trim() ? `|"${escEdge(label)}"|` : "";
  if (direction === "two_way") return `<-->${l}`;
  if (direction === "none") return `---${l}`;
  return `-->${l}`;
}


/** Build a Mermaid flowchart for the connection-schema JSON. */
export function buildConnectionMermaid(
  schema: ConnectionSchemaJson,
  direction: "TD" | "LR" = "TD",
): MermaidBuildResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const lines: string[] = [`flowchart ${direction}`];

  // --- validation / id maps ---
  const seenRegion = new Set<string>();
  const nodeIdByEntity = new Map<string, string>(); // entity.id -> mermaid id
  const seenEntity = new Set<string>();
  const regions = schema.regions.filter((r) => {
    if (seenRegion.has(r.id)) {
      errors.push(`Дублирующийся id региона: ${r.id} — регион пропущен`);
      return false;
    }
    seenRegion.add(r.id);
    if (!r.entities.length) {
      warnings.push(`Регион ${r.id} не содержит сущностей`);
      return false;
    }
    return true;
  });

  regions.forEach((r, ri) => {
    r.entities.forEach((e, ei) => {
      if (seenEntity.has(e.id)) {
        errors.push(`Дублирующийся id сущности: ${e.id}`);
      }
      seenEntity.add(e.id);
      nodeIdByEntity.set(e.id, safeId(e.id, `${ri}_${ei}`));
    });
  });

  // --- subgraphs ---
  regions.forEach((r, ri) => {
    lines.push(`  subgraph ${safeId(`sg_${r.id}`, `sg${ri}`)}["${esc(subgraphTitle(r))}"]`);
    lines.push(`    direction ${direction}`);
    r.entities.forEach((e) => {
      lines.push(`    ${nodeIdByEntity.get(e.id)}["${nodeLabel(e)}"]`);
    });
    lines.push("  end");
  });

  // --- internal relations ---
  let edgeIndex = 0;
  regions.forEach((r) => {
    const ids = new Set(r.entities.map((e) => e.id));
    r.relations.forEach((rel) => {
      if (!ids.has(rel.from) || !ids.has(rel.to)) {
        errors.push(`Связь пропущена (нет сущности в регионе ${r.id}): ${rel.from} → ${rel.to}`);
        return;
      }
      lines.push(`  ${nodeIdByEntity.get(rel.from)} ${arrow(rel.direction, rel.label)} ${nodeIdByEntity.get(rel.to)}`);
      edgeIndex += 1;
    });
  });

  // --- cross-region relations ---
  const regionById = new Map(regions.map((r) => [r.id, r]));
  const crossIndices: number[] = [];
  schema.regionRelations.forEach((rel) => {
    const from = regionById.get(rel.fromRegion);
    const to = regionById.get(rel.toRegion);
    if (!from || !to) {
      errors.push(`Межрегиональная связь пропущена: ${rel.fromRegion} → ${rel.toRegion}`);
      return;
    }
    const a = anchorFor(from, warnings);
    const b = anchorFor(to, warnings);
    if (!a || !b) return;
    lines.push(`  ${nodeIdByEntity.get(a.id)} ${arrow(rel.direction, rel.label)} ${nodeIdByEntity.get(b.id)}`);
    crossIndices.push(edgeIndex);
    edgeIndex += 1;
  });

  if (crossIndices.length) {
    lines.push(
      `  linkStyle ${crossIndices.join(",")} stroke:#d946ef,stroke-width:3.5px,color:#a21caf,font-weight:bold`,
    );
  }

  return { code: lines.join("\n"), warnings, errors };
}
