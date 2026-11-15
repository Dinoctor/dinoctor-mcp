// Core tools: open, status, read the project, move around, change anything.

import { z } from "zod";
import { engineUp, openApp, page } from "../connect.mjs";

export const CORE = [
  {
    name: "open_dinoctor",
    description: "Open the Dinoctor app on this computer (if it isn't open) and wait until its window is ready. Call this first.",
    schema: {},
    run: () => openApp(),
  },
  {
    name: "status",
    description: "Is Dinoctor open, which style and format the project uses, how many scenes and shots, and which shot is on screen.",
    schema: {},
    run: async () => {
      const up = await engineUp();
      if (!up.page) return { open: false, note: up.engine ? "The engine runs but the window is closed." : "Dinoctor isn't open: call open_dinoctor." };
      return page("status");
    },
  },
  {
    name: "get_project",
    description: "A short view of the whole project: style, format, every scene and shot with ids, length, camera, place, cast, texts and transition. Read this before changing things.",
    schema: {},
    run: () => page("get_project"),
  },
  {
    name: "get_shot",
    description: "Every setting of one shot (by id, or by scene and shot index from 0). Use it to see exact fields before edit_project.",
    schema: { id: z.string().optional(), scene: z.number().int().optional(), shot: z.number().int().optional() },
    run: (a) => page("get_shot", a),
  },
  {
    name: "go_to",
    description: "Show a shot in Dinoctor's editor (by id, or scene and shot index from 0), so the person sees what you're working on.",
    schema: { id: z.string().optional(), scene: z.number().int().optional(), shot: z.number().int().optional() },
    run: (a) => page("go_to", a),
  },
  {
    name: "edit_project",
    description:
      'Change any setting of the project precisely, with JSON Pointer paths into the project (see get_project / get_shot for the shape). Each change: {"op":"replace"|"add"|"remove"|"merge","path":"/scenes/0/shots/1/seconds","value":4}. "add" with "-" appends to a list; "merge" mixes fields into an object. All changes in one call are one undo step for the person. Prefer the specific tools when one fits.',
    schema: {
      changes: z.array(z.object({ op: z.enum(["replace", "add", "remove", "merge"]), path: z.string(), value: z.any().optional() })),
      label: z.string().optional().describe("What the person sees in the undo note, like 'Claude made shot 2 longer.'"),
    },
    run: (a) => page("edit_project", a),
  },
];
