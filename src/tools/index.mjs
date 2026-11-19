// Every Dinoctor MCP tool, plus the old names that still work for one version (hidden from the tool list).

import { z } from "zod";
import { CORE } from "./core.mjs";
import { EDIT } from "./edit.mjs";
import { SEE } from "./see.mjs";
import { MEDIA } from "./media.mjs";
import { STYLES } from "./styles.mjs";

export const TOOLS = [...CORE, ...EDIT, ...SEE, ...MEDIA, ...STYLES];

// Old tool name -> [new tool, how its arguments change]. Version 0.2 merged look-alike tools and gave short names a
// verb. Saved prompts and older skills still call the old names, so they keep working until the next version.
const same = (a) => a;
const set = (extra) => (a) => ({ ...a, ...extra });
export const ALIASES = {
  // Renamed
  cast: ["set_cast", same],
  act: ["direct_cast", same],
  words: ["set_text", same],
  place: ["set_place", same],
  light: ["set_light", same],
  camera: ["set_camera", same],
  keys: ["set_keyframes", same],
  transition: ["set_transition", same],
  look: ["look_at_shot", same],
  // Pictures
  generate_character: ["generate_picture", (a) => ({ ...a, action: "make", kind: "character", put: a.put ?? "shot" })],
  generate_place: ["generate_picture", (a) => ({ ...a, action: "make", kind: "background", put: a.put ?? "shot" })],
  picture_status: ["generate_picture", ({ stop, ...a }) => ({ ...a, action: stop ? "stop" : "status" })],
  // Drawing
  draw_character: ["draw", set({ action: "draw", kind: "character" })],
  draw_object: ["draw", set({ action: "draw", kind: "object" })],
  draw_place: ["draw", set({ action: "draw", kind: "place" })],
  describe_drawing: ["draw", set({ action: "describe" })],
  // Style jobs
  make_style: ["style_job", set({ action: "build" })],
  fix_style: ["style_job", set({ action: "fix" })],
  continue_style: ["style_job", set({ action: "continue" })],
  cancel_style: ["style_job", set({ action: "cancel" })],
  style_status: ["style_job", set({ action: "status" })],
  // Render
  render_status: ["render", set({ action: "status" })],
  cancel_render: ["render", set({ action: "cancel" })],
  // Script
  get_script: ["script", set({ action: "get" })],
  write_script: ["script", set({ action: "write" })],
  assign_line: ["script", set({ action: "assign" })],
};

const byName = new Map(TOOLS.map((t) => [t.name, t]));

// The arguments, checked against a tool's own schema (unknown fields are kept: older argument names still work).
export const checked = (tool, args) => {
  const parsed = z.looseObject(tool.schema).safeParse(args ?? {});
  if (!parsed.success) throw new Error(`Invalid arguments for ${tool.name}: ${parsed.error.issues.map((i) => `${i.path.join(".") || "(arguments)"}: ${i.message}`).join("; ")}`);
  return parsed.data;
};

// What an old name becomes: { tool, args } for the new tool, or null if the name isn't an old one.
export const resolveAlias = (name, args = {}) => {
  const alias = ALIASES[name];
  if (!alias) return null;
  const tool = byName.get(alias[0]);
  if (!tool) throw new Error(`The old tool ${name} points at ${alias[0]}, which doesn't exist.`);
  return { tool, args: alias[1]({ ...args }) };
};

// Tool-shaped entries for the old names, registered but hidden from the tool list.
export const ALIAS_TOOLS = Object.keys(ALIASES).map((name) => {
  const target = byName.get(ALIASES[name][0]);
  return {
    name,
    hidden: true,
    description: `Old name, kept for one version: use ${ALIASES[name][0]} instead.`,
    schema: {},
    annotations: target?.annotations,
    run: (args) => {
      const { tool, args: mapped } = resolveAlias(name, args);
      return tool.run(checked(tool, mapped));
    },
  };
});
