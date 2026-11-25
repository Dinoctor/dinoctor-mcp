// Core tools: open, status, read the project, move around, change anything.

import { z } from "zod";
import { engineUp, openApp, page } from "../connect.mjs";
import { CHANGE, LOCAL, READ } from "./hints.mjs";
import { SHOT_ARGS, shotIdOf } from "./shot.mjs";

// Loose output shapes for the read tools, so AI apps know what comes back. Every field is optional on purpose.
const ANY = z.any().optional();
const SHOWING = z.looseObject({ scene: z.number().optional(), shot: z.number().optional(), id: z.string().optional() }).optional();

export const CORE = [
  {
    name: "open_dinoctor",
    description:
      "Start the Dinoctor app on this computer if it isn't open, and wait (up to about 90 seconds) until its window is ready. Call this first. Returns { opened, ready }. Fails with a download hint if the app isn't installed. To only check whether it's open, use status.",
    schema: {},
    annotations: LOCAL,
    run: () => openApp(),
  },
  {
    name: "status",
    description:
      "Quick read-only check: is Dinoctor open, the project's style and format, how many scenes and shots, and which shot is on screen (id and indexes). Returns { open: false, note } when the app is closed. For every scene and shot, use get_project.",
    schema: {},
    output: { open: z.boolean().optional(), note: z.string().optional(), style: z.string().optional(), format: z.string().optional(), scenes: z.number().optional(), shots: z.number().optional(), showing: SHOWING },
    annotations: READ,
    run: async () => {
      const up = await engineUp();
      if (!up.page) return { open: false, note: up.engine ? "The engine runs but the window is closed." : "Dinoctor isn't open: call open_dinoctor." };
      return page("status");
    },
  },
  {
    name: "get_project",
    description:
      "Read-only: the whole project in short form. Style, format, and every scene and shot with id, index, length, camera, place, cast (member ids and refs), number of actions, texts and transition. Read it before editing to get the ids other tools need (shot_id, member ids). For every setting of one shot use get_shot; for a picture use look_at_shot.",
    schema: {},
    output: { style: z.string().optional(), format: z.string().optional(), scenes: z.array(z.looseObject({ index: z.number().optional(), id: z.string().optional(), name: z.string().optional(), shots: z.array(z.looseObject({ index: z.number().optional(), id: z.string().optional(), seconds: z.number().optional() })).optional() })).optional(), script: ANY, media: ANY },
    annotations: READ,
    run: () => page("get_project"),
  },
  {
    name: "get_shot",
    description:
      "Read-only: every setting of one shot as JSON (place, cast, actions, emotions, texts, camera and camera keys, lighting, transition, keyframes), with its scene and shot index. Name the shot with shot_id, or scene and shot indexes; left out, the shot on screen. Use it to see exact fields and ids before edit_project or set_keyframes. For a short view of all shots use get_project; to see the shot as a picture use look_at_shot.",
    schema: { ...SHOT_ARGS },
    output: { scene: z.number().optional(), shot: z.number().optional(), value: z.looseObject({ id: z.string().optional(), seconds: z.number().optional() }).optional() },
    annotations: READ,
    run: async (a) => {
      const id = (await shotIdOf(a, ["id"])) ?? (await page("status")).showing?.id;
      return page("get_shot", id ? { id } : {});
    },
  },
  {
    name: "go_to",
    description:
      "Show a shot in Dinoctor's editor so the person sees what you're working on. Name it with shot_id, or scene and shot indexes. Changes only what's on screen, not the project. Edit tools use the shot on screen when no shot is given, so this also sets their default. Returns { showing }. To get a picture of the shot, use look_at_shot.",
    schema: { ...SHOT_ARGS },
    annotations: LOCAL,
    run: async (a) => {
      const id = await shotIdOf(a, ["id"]);
      return page("go_to", id ? { id } : {});
    },
  },
  {
    name: "edit_project",
    description:
      'Low-level edit of any project setting by JSON Pointer path (read how_to once for the format, get_shot for a real shot). Each change: {"op":"replace"|"add"|"remove"|"merge","path":"/scenes/0/shots/1/seconds","value":4}. All changes in one call are one undo step; a bad path or value is refused and nothing changes. Returns { done: number of changes }. Prefer the specific tools (set_cast, direct_cast, set_text, set_camera, set_light, set_place, set_transition, set_keyframes, add_preset, set_element, set_look, set_world, sound_fx); use this only for fields they don\'t cover.',
    schema: {
      changes: z
        .array(
          z.object({
            op: z.enum(["replace", "add", "remove", "merge"]).describe("replace a value, add one (append to a list with path ending '-'), remove it, or merge fields into an object."),
            path: z.string().describe('JSON Pointer into the project, like "/scenes/0/shots/1/seconds".'),
            value: z.any().optional().describe("The new value. Not needed for remove."),
          }),
        )
        .describe("The changes, applied in order as one undo step."),
      label: z.string().optional().describe("What the person sees in the undo note, like 'Claude made shot 2 longer.'"),
    },
    annotations: CHANGE,
    run: (a) => page("edit_project", a),
  },
];
