// Core tools: open, status, read the project, move around, change anything.

import { z } from "zod";
import { engineUp, openApp, page } from "../connect.mjs";
import { CHANGE, LOCAL, READ } from "./hints.mjs";

const SHOT_ID = z.string().optional().describe("The shot's id from get_project. Give this, or scene and shot. Left out: the shot on screen.");
const SCENE_I = z.number().int().optional().describe("Scene index from 0 (used with shot).");
const SHOT_I = z.number().int().optional().describe("Shot index from 0 inside that scene (used with scene).");

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
      "Read-only: the whole project in short form. Style, format, and every scene and shot with id, index, length, camera, place, cast (member ids and refs), number of actions, texts and transition. Read it before editing to get the ids other tools need. For every setting of one shot use get_shot; for a picture use look.",
    schema: {},
    annotations: READ,
    run: () => page("get_project"),
  },
  {
    name: "get_shot",
    description:
      "Read-only: every setting of one shot as JSON (place, cast, actions, emotions, texts, camera and camera keys, lighting, transition, keyframes), with its scene and shot index. Use it to see exact fields and ids before edit_project or keys. For a short view of all shots use get_project; to see the shot as a picture use look.",
    schema: { id: SHOT_ID, scene: SCENE_I, shot: SHOT_I },
    annotations: READ,
    run: (a) => page("get_shot", a),
  },
  {
    name: "go_to",
    description:
      "Show a shot in Dinoctor's editor so the person sees what you're working on. Changes only what's on screen, not the project. Edit tools use the shot on screen when no shot is given, so this also sets their default. Returns { showing }. To get a picture of the shot, use look.",
    schema: { id: SHOT_ID, scene: SCENE_I, shot: SHOT_I },
    annotations: LOCAL,
    run: (a) => page("go_to", a),
  },
  {
    name: "edit_project",
    description:
      'Low-level edit of any project setting by JSON Pointer path (read how_to once for the format, get_shot for a real shot). Each change: {"op":"replace"|"add"|"remove"|"merge","path":"/scenes/0/shots/1/seconds","value":4}. All changes in one call are one undo step; a bad path or value is refused and nothing changes. Returns { done: number of changes }. Prefer the specific tools (cast, act, words, camera, light, place, transition, keys); use this only for fields they don\'t cover.',
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
