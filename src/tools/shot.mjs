// One way to name a shot in every tool: shot_id, or scene + shot indexes. Left out: the shot on screen.
// Older names still work quietly: a shot id given as `shot` (a string), `id` or `shotId`.

import { z } from "zod";
import { page } from "../connect.mjs";

export const SHOT_ARGS = {
  shot_id: z.string().optional().describe("The shot's id from get_project. Or give scene and shot instead. Left out: the shot on screen."),
  scene: z.number().int().min(0).optional().describe("Scene index from 0 (with shot). Used when shot_id isn't given."),
  shot: z
    .union([z.number().int().min(0), z.string()])
    .optional()
    .describe("Shot index from 0 inside that scene (with scene; alone: in the scene on screen). A shot id works here too."),
};

// Which shot the arguments name: { id } or { scene, shot } indexes, or {} for the shot on screen.
// `legacy` lists older argument names that held a shot id in this tool (like "id" or "shotId").
export const shotRef = (a, legacy = []) => {
  for (const key of ["shot_id", ...legacy]) if (typeof a[key] === "string" && a[key]) return { id: a[key] };
  if (typeof a.shot === "string" && a.shot) return { id: a.shot };
  if (typeof a.shot === "number" || typeof a.scene === "number") return { scene: a.scene, shot: typeof a.shot === "number" ? a.shot : undefined };
  return {};
};

// The arguments without any of the ways to name a shot.
export const withoutShot = (a, legacy = []) => {
  const out = { ...a };
  for (const key of ["shot_id", "scene", "shot", ...legacy]) delete out[key];
  return out;
};

// The shot's id, or undefined for the shot on screen. Indexes are looked up in the open project.
export const shotIdOf = async (a, legacy = []) => {
  const ref = shotRef(a, legacy);
  if (ref.id) return ref.id;
  if (ref.scene === undefined && ref.shot === undefined) return undefined;
  const scene = ref.scene ?? (await page("status")).showing?.scene ?? 0;
  return (await page("get_shot", { scene, shot: ref.shot ?? 0 })).value.id;
};
