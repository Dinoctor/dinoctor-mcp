// SEE tools: the styles and their libraries, the project format explained, a picture of a shot, rendering, and project
// files. Most run inside the open Dinoctor window.

import { z } from "zod";
import { api, page } from "../connect.mjs";
import { LOCAL, READ, REPLACE } from "./hints.mjs";

// Keep it short: an AI reads it once before editing.
const HOW_TO = `# Dinoctor project format (for edit_project and the other edit tools)

Project { style, format: "horizontal" (16:9, 960x540 preview) | "vertical" (9:16), scenes: Scene[], sound?, script?, media? }
- style: one id from list_styles. Every id below (characters, places, lights, cameras...) must come from library for this style.
Scene { id, name, shots: Shot[], footage?: true (never plays, only used inside other shots), trying?: true (a sample on trial), markers? }
- Every scene needs at least one shot. The film = scenes without footage/trying, in order.

Shot (paths look like /scenes/0/shots/1/seconds; get_shot shows a real one, copy its shape):
- seconds: length in seconds (30 frames a second). Transitions and outros add frames on top (see below).
- place: { id, name, sky, horizon, floor (colours), dark, stars, clouds, orb: "none"|"sun"|"moon", walls, items: PlaceItem[], ground? (-3..3) }.
  Pick a place from library "places" and copy its id/name; the page fills the colours. items: { id, kind (an object id), x, z, size }.
- lighting: { preset (a light id from library "lights"), ambient (#hex), level (0..1 how much of the ambient), lights: [{ id, color, x (-14..14), y (0.2..12 height), z (-12..12), intensity, flicker }] }.
- cast: Member[] { id, name, source: "character"|"object", ref (an id from library characters/objects), x (-12..12 left/right; leave it out to auto-space), z (near/far: 0 is the front line, NEGATIVE is farther, about -25..5), y (height above ground, -3..10), size (1 normal, 0.3..4), spin (deg, like a wheel), turn (deg, like on a stage), facing: "left"|"right", tint?, glow?: {color, strength, pulse}, blend?: {opacity 0..100, mode} }.
- camera: a move id from library "cameras". strength: 0..100 (how big the move is). wiggle: handheld shake, 0 = locked off (1 is normal).
- cameraKeys?: CameraBeat[] { at (seconds), x, y, z (where it looks), distance (2..40), height (0.3..30), angle (deg around, -360..360), roll (-3.2..3.2), ease? } — directs the camera moment by moment and wins over camera.
- actions: SceneAction[] { id, type (an action id from library "actions"), actor (a cast member id), target? (another member id, for actions marked needsTarget), when: "start"|"middle"|"end", at? (% 0..100 through the shot, exact), speed?, amount? }.
- emotions: { id, member, emotion (an emotion id), at (% through the shot) }[]. talks: { id, member, from, to (%) }[]. looks?: { id, member, target, from, to (%) }[].
- texts: SceneText[] { id, words, preset (library "text_presets"), x, y (% of the frame, centre of the text: 50,50 is the middle), size (1 normal, 0.3..3), action (library "text_animations"), when: "start"|"middle"|"end", at?, until? (% through the shot it appears/leaves), font?, color?, lineWords?, sweep: {on, loop, when}, glow: {on, color, pulse} }.
- transition: how it changes into the NEXT shot: a transition id from library "transitions" ("cut" = none). transitionSeconds? overrides its length. transitionColor?, transitionWord?, transitionAt? [0..1, 0..1] for the ones that use them.
- outro: { camera?: outro camera id, effect?: outro effect id, character?: { move, ref, size } } — plays at the end of the shot, before the transition.
- adjust?: whole-picture looks, see library "looks": { grain|noise|vignette|hold|curve|warp|paper|duotone: { on: true, ...settings } }.
- elements?: moving elements (styles that have them): see library "elements".
- mask?, lens? { target: member id|"lead"|"manual", distance, blur, range, show }, paths? (members walk along points [x, z] over timing % ranges), notes?, voice?, sound?.
- thumb: a picture the page takes by itself. Never write it.

Timing units: shot.seconds and keyframe "at" are SECONDS; actions/emotions/talks/looks/texts at/from/to/until are PERCENT (0..100) of the shot.

Keyframes (shot.keys): { "<track>": [{ at (seconds into the shot), values: { name: number }, hold?: { name: string|boolean }, ease?: "smooth"|"even"|"fast-start"|"slow-start"|"punch"|"bounce"|"custom", bez? [x1,y1,x2,y2] }] }, keys sorted by at.
Tracks and what they can animate:
- "cast:<member id>": x, y, z, size, spin, turn
- "item:<place item id>": x, z, size
- "text:<text id>": x, y, size
- "light:<light id>": x, y, z, intensity (hold: color)
- "scene:light": level (hold: ambient)
- "mask:shot": x, y, w, h, turn, feather (hold: shape, invert)
- "element:<element id>": amount, size, x, y, rot
- "adjust:<group>": that look's number settings, like "adjust:grain": amount, size
A value with no key uses the thing's own setting. Each key's ease is how it travels on to the next key. Put a key at 0 with the start values when you animate something.

Ids: new things need unique ids (like "member-claude-1", "text-claude-2"). After any change, use look to see it.`;


const where = {
  id: z.string().optional().describe("A shot id (from get_project). Give this, or scene and shot. Left out: the shot on screen."),
  scene: z.number().int().optional().describe("Scene index from 0."),
  shot: z.number().int().optional().describe("Shot index in that scene, from 0."),
};

export const SEE = [
  {
    name: "list_styles",
    description:
      "Read-only: every built-in Dinoctor style with its id, name, what it's for and its depth (2D, 2.5D or real 3D), with the project's current style marked. Use an id with library (what it offers), new_project or set_style. The person's own styles are listed by my_styles.",
    schema: {},
    annotations: READ,
    run: () => page("list_styles"),
  },
  {
    name: "library",
    description:
      "Read-only: the ids a style offers, by category (characters, objects, places, cameras, actions, emotions, text_presets, text_animations, transitions and outro moves, lights, looks, elements, samples), with names and short notes. With no category and no search it returns counts only; pass category and/or search to keep answers small. Every id you pass to cast, act, words, camera, light, place or transition must come from here. For ready-made shot recipes to add, use samples.",
    schema: {
      style: z.string().optional().describe("A style id from list_styles. Default: the project's style."),
      category: z.string().optional().describe("One of: characters, objects, places, cameras, actions, emotions, text_presets, text_animations, transitions, lights, looks, elements, samples."),
      search: z.string().optional().describe("Words to look for in id, name, group and note, like 'zoom' or 'sad'."),
      limit: z.number().int().optional().describe("Most items per category (default 150)."),
    },
    annotations: READ,
    run: (a) => page("library", a),
  },
  {
    name: "how_to",
    description:
      "Read-only reference text: the project format (Project > Scene > Shot fields), units (seconds vs percent), x/z ranges and keyframe tracks. Read it once before using edit_project. It doesn't need the app open. For the drawing format of draw_* tools, use describe_drawing.",
    schema: {},
    annotations: READ,
    run: () => HOW_TO,
  },
  {
    name: "look",
    description:
      "See a shot: returns a picture (about 960 px wide) of a shot at a moment, plus its info, so you can check what you made and fix it. Give a shot (id, or scene and shot index; default the shot on screen) and seconds into it, or film: true with seconds into the whole film. It shows that shot in the editor and pauses it; the project isn't changed. Doesn't work while a render runs. For the shot's settings as data use get_shot; for a video file use render.",
    schema: {
      ...where,
      seconds: z.number().optional().describe("Seconds into the shot (or the film with film: true). Default 0."),
      film: z.boolean().optional().describe("true: seconds counts from the start of the whole film."),
      width: z.number().int().optional().describe("Picture width in pixels, 240 to 1920. Default 960."),
      format: z.enum(["jpeg", "png"]).optional().describe("jpeg (default, smaller) or png."),
    },
    annotations: READ,
    run: async (a) => {
      const out = await page("look", a);
      return { content: [{ type: "image", data: out.image, mimeType: out.mimeType }, { type: "text", text: JSON.stringify(out.info) }] };
    },
  },
  {
    name: "render",
    description:
      "Start making a video file (MP4) of the film, one scene or one shot, the same way Export does. It returns at once; then call render_status until done (it gives the file path). Only one render runs at a time, and look doesn't work while it runs. quality draft is 540p and quick (for checking timing); final is full size and much slower. make wav or mp3 exports only the sound. Without save_to it goes to Dinoctor's renders folder. To stop it, use cancel_render.",
    schema: {
      what: z.enum(["film", "scene", "shot"]).optional().describe("What to render. Default film."),
      ...{ id: z.string().optional().describe("A scene id (what: scene) or shot id (what: shot)."), scene: where.scene, shot: where.shot },
      quality: z.enum(["draft", "final"]).optional().describe("Default draft."),
      size: z.enum(["1080", "2k", "4k"]).optional().describe("Final only: picture size. Default 1080."),
      fps: z.number().int().optional().describe("24, 30 or 60 (final only)."),
      blur: z.boolean().optional().describe("Motion blur for final (about 4 times slower). Default on where possible."),
      make: z.enum(["video", "wav", "mp3"]).optional().describe("Default video."),
      save_to: z.string().optional().describe("Full path of the file to make, ending in .mp4 (or .wav/.mp3). Ask the person where if they care."),
      replace: z.boolean().optional().describe("Write over save_to if it's already there."),
    },
    annotations: LOCAL,
    run: (a) => page("render", a),
  },
  {
    name: "render_status",
    description:
      "Read-only: how the render started by render is going: stage, progress (0 to 1), frames and seconds so far; when done, the file path; or the error. Call every 10 to 30 seconds while running. Returns running: false when no render has run.",
    schema: {},
    annotations: READ,
    run: async () => {
      const s = await api("GET", "/api/render");
      if (!s || !s.stage) return { running: false, note: "No render has run since Dinoctor started (or its file was deleted)." };
      return { running: !!s.running, done: !!s.done && !s.cancelled && !s.error, stage: s.stage, progress: Math.round((s.progress ?? 0) * 100) / 100, frame: s.frame, total: s.total, seconds: s.seconds, file: s.done && !s.error && !s.cancelled ? s.file : undefined, error: s.error || undefined, cancelled: s.cancelled || undefined, note: s.note || undefined };
    },
  },
  {
    name: "cancel_render",
    description: "Stop the render that's running (started by render). No video file is made; the project isn't changed. Safe to call when nothing runs. To stop a picture or style job, use picture_status with stop or cancel_style.",
    schema: {},
    annotations: LOCAL,
    run: () => page("cancel_render"),
  },
  {
    name: "list_projects",
    description:
      "Read-only: the person's recent project files (path, name, style, when opened, whether the file still exists), and which file is open now and whether it has unsaved changes. Use a path with open_project.",
    schema: {},
    annotations: READ,
    run: async () => {
      const [{ recent }, open] = await Promise.all([api("GET", "/api/projects/recent"), page("project_file").catch(() => null)]);
      return { open, recent: (recent ?? []).map((r) => ({ path: r.path, name: r.name, style: r.style, opened: r.opened ? new Date(r.opened).toISOString() : undefined, exists: r.exists })) };
    },
  },
  {
    name: "open_project",
    description:
      "Open a project file (.dino) in Dinoctor, the same as File > Open, in place of the open project. Refuses if the open project has unsaved changes, unless discard: true (ask the person first, or save_project before). Returns the opened project's summary. For a new empty project use new_project; for a template use templates.",
    schema: { path: z.string().describe("The project file's full path (see list_projects)."), discard: z.boolean().optional().describe("true: drop unsaved changes in the open project. Only after the person agreed.") },
    annotations: REPLACE,
    run: (a) => page("open_project", a),
  },
  {
    name: "save_project",
    description:
      "Save the open project to a .dino file, the same as File > Save. With path: Save As to that file. With name: a new file with that name in the person's projects folder. A project never saved before gets a file in the projects folder. Returns the file path. To save it as a reusable starting point, use templates with save.",
    schema: { path: z.string().optional().describe("Full path ending in .dino."), name: z.string().optional().describe("A name for a new file in the projects folder.") },
    annotations: LOCAL,
    run: (a) => page("save_project", a),
  },
];
