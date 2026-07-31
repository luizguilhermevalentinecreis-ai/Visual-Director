import type { VfxDraft, VfxNode } from "./domain.js";

export type QualityIssue = { severity: "blocking" | "warning" | "note"; code: string; message: string; nodeId?: string };
export type QualityReport = {
  score: number;
  blockingIssues: QualityIssue[];
  warnings: QualityIssue[];
  notes: QualityIssue[];
  stats: Record<string, number>;
};

const visualKinds = new Set(["particle", "beam", "trail", "geometry", "light", "screen"]);
const shortImpactKinds = new Set(["screen", "camera", "light", "geometry", "particle"]);

export function reviewVfxDraft(draft: VfxDraft): QualityReport {
  const issues: QualityIssue[] = [];
  const ids = new Set<string>();
  for (const node of draft.nodes) {
    if (ids.has(node.id)) issues.push({ severity: "blocking", code: "duplicate_node_id", message: `Duplicate node id: ${node.id}`, nodeId: node.id });
    ids.add(node.id);
    if (node.endTime > draft.duration + 1e-6) issues.push({ severity: "blocking", code: "node_outside_duration", message: `${node.name} ends after the draft duration.`, nodeId: node.id });
    if (node.parentId && node.parentId === node.id) issues.push({ severity: "blocking", code: "self_parent", message: `${node.name} cannot parent itself.`, nodeId: node.id });
    if (node.kind === "particle" && node.rate === 0 && node.burstCount === 0) issues.push({ severity: "warning", code: "silent_emitter", message: `${node.name} has neither rate nor burst particles.`, nodeId: node.id });
    if (node.kind === "geometry" && (node.size.x <= 0 || node.size.y <= 0 || node.size.z <= 0)) issues.push({ severity: "blocking", code: "invalid_geometry_size", message: `${node.name} must have positive size.`, nodeId: node.id });
    if (node.kind === "screen" && node.layerType === "image" && !node.image) issues.push({ severity: "warning", code: "missing_screen_image", message: `${node.name} is an image layer without an image asset.`, nodeId: node.id });
  }
  for (const node of draft.nodes) {
    if (node.parentId && !ids.has(node.parentId)) issues.push({ severity: "blocking", code: "missing_parent", message: `${node.name} references missing parent ${node.parentId}.`, nodeId: node.id });
  }
  const visualCount = draft.nodes.filter(node => visualKinds.has(node.kind)).length;
  if (visualCount === 0) issues.push({ severity: "blocking", code: "no_visual_nodes", message: "The draft contains no visual nodes." });
  const impactMarkers = draft.markers.filter(marker => marker.type === "impact");
  if (["attack", "impactFrame"].includes(draft.category) && impactMarkers.length === 0) issues.push({ severity: "warning", code: "missing_impact_marker", message: "Combat VFX should declare at least one impact marker." });
  for (const marker of draft.markers) {
    if (marker.time > draft.duration) issues.push({ severity: "blocking", code: "marker_outside_duration", message: `${marker.label} is outside the draft duration.` });
  }
  if (draft.category === "impactFrame") {
    const impactTime = impactMarkers[0]?.time ?? draft.duration * 0.5;
    const layered = draft.nodes.filter(node => shortImpactKinds.has(node.kind) && node.startTime <= impactTime && node.endTime >= impactTime).length;
    if (layered < 3) issues.push({ severity: "warning", code: "weak_impact_layering", message: "Impact frames read better with at least three synchronized visual layers." });
  }
  const paletteKeys = new Set(draft.palette.map(color => `${color.r.toFixed(3)}:${color.g.toFixed(3)}:${color.b.toFixed(3)}`));
  if (paletteKeys.size === 1 && draft.nodes.length > 8) issues.push({ severity: "note", code: "single_color_palette", message: "A secondary value or accent color may improve hierarchy." });
  const blockingIssues = issues.filter(issue => issue.severity === "blocking");
  const warnings = issues.filter(issue => issue.severity === "warning");
  const notes = issues.filter(issue => issue.severity === "note");
  const score = Math.max(0, Math.min(1, 1 - blockingIssues.length * 0.35 - warnings.length * 0.06 - notes.length * 0.015));
  const byKind: Record<string, number> = {};
  for (const node of draft.nodes) byKind[node.kind] = (byKind[node.kind] ?? 0) + 1;
  return {
    score: Number(score.toFixed(3)), blockingIssues, warnings, notes,
    stats: { nodes: draft.nodes.length, markers: draft.markers.length, visualNodes: visualCount, ...byKind },
  };
}

export function summarizeNode(node: VfxNode) {
  return { id: node.id, name: node.name, kind: node.kind, startTime: node.startTime, endTime: node.endTime };
}
