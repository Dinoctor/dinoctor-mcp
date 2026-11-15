// SEE tools: the styles and their libraries, the project format explained, a picture of a shot, rendering, and project
// files. Most run inside the open Dinoctor window.

import { z } from "zod";
import { api, page } from "../connect.mjs";

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
  id: z.string().optional().describe("A shot id (from get_project)."),
  scene: z.number().int().optional().describe("Scene index from 0."),
  shot: z.number().int().optional().describe("Shot index in that scene, from 0."),
};

export const SEE = [
  {
    name: "list_styles",
    description: "Every Dinoctor style with its id, name, what it's for and its depth (2D, 2.5D or real 3D), with the project's current style marked. Use the id with library to see what a style offers.",
    schema: {},
    run: () => page("list_styles"),
  },
  {
    name: "library",
    description:
      "What a style offers, by category: characters, objects, places, cameras (moves), actions, emotions, text_presets, text_animations, transitions (and outro moves), lights (moods), looks (adjustments, duotone pairs, blend modes), elements, samples (recipes). Gives ids, names and short notes. With no category and no search it gives counts only; pass category and/or search (words matched in id, name, group, note) to keep answers small. Use these ids in edits: anything not listed for the project's style is refused or swapped.",
    schema: {
      style: z.string().optional().describe("A style id from list_styles. Default: the project's style."),
      category: z.string().optional().describe("One of: characters, objects, places, cameras, actions, emotions, text_presets, text_animations, transitions, lights, looks, elements, samples."),
      search: z.string().optional().describe("Words to look for, like 'zoom' or 'sad'."),
      limit: z.number().int().optional().describe("Most items per category (default 150)."),
    },
    run: (a) => page("library", a),
  },
  {
    name: "how_to",
    description: "Explains the project format for an AI: Project > Scene > Shot fields, units (seconds vs percent), x/z ranges, keyframe tracks. Read it once before using edit_project.",
    schema: {},
    run: () => HOW_TO,
  },
  {
    name: "look",
    description:
      "A picture of a shot at a moment, so you can see what you made and fix it. Give a shot (id, or scene and shot index; default: the shot on screen) and seconds into it, or film: true with seconds into the whole film. Shows that shot in the editor, pauses it and returns the frame once it's fully drawn (about 960 px wide). Doesn't work while a render runs.",
    schema: {
      ...where,
      seconds: z.number().optional().describe("Seconds into the shot (or the film with film: true). Default 0."),
      film: z.boolean().optional().describe("seconds counts from the start of the whole film."),
      width: z.number().int().optional().describe("Picture width in pixels, 240 to 1920. Default 960."),
      format: z.enum(["jpeg", "png"]).optional().describe("jpeg (default, smaller) or png."),
    },
    run: async (a) => {
      const out = await page("look", a);
      return { content: [{ type: "image", data: out.image, mimeType: out.mimeType }, { type: "text", text: JSON.stringify(out.info) }] };
    },
  },
  {
    name: "render",
    description:
      "Makes a video file (MP4) of the film, one scene or one shot, the same way Export does, and returns at once: then call render_status until done. Only one render runs at a time. quality draft is 540p and quick (good for checking timing); final is full size and much slower (size 1080/2k/4k, fps 24/30/60, motion blur on unless blur: false). make wav or mp3 exports only the sound. Without save_to it goes to Dinoctor's renders folder; render_status gives the path.",
    schema: {
      what: z.enum(["film", "scene", "shot"]).optional().describe("Default film."),
      ...{ id: z.string().optional().describe("A scene id (what: scene) or shot id (what: shot)."), scene: where.scene, shot: where.shot },
      quality: z.enum(["draft", "final"]).optional().describe("Default draft."),
      size: z.enum(["1080", "2k", "4k"]).optional(),
      fps: z.number().int().optional().describe("24, 30 or 60 (final only)."),
      blur: z.boolean().optional().describe("Motion blur for final (about 4 times slower). Default on where possible."),
      make: z.enum(["video", "wav", "mp3"]).optional().describe("Default video."),
      save_to: z.string().optional().describe("Full path of the file to make, ending in .mp4 (or .wav/.mp3). Ask the person where if they care."),
      replace: z.boolean().optional().describe("Write over save_to if it's already there."),
    },
    run: (a) => page("render", a),
  },
  {
    name: "render_status",
    description: "How the render is going: stage, progress (0 to 1), frames, seconds so far; when done, the file path; or the error. Call every 10 to 30 seconds while running.",
    schema: {},
    run: async () => {
      const s = await api("GET", "/api/render");
      if (!s || !s.stage) return { running: false, note: "No render has run since Dinoctor started (or its file was deleted)." };
      return { running: !!s.running, done: !!s.done && !s.cancelled && !s.error, stage: s.stage, progress: Math.round((s.progress ?? 0) * 100) / 100, frame: s.frame, total: s.total, seconds: s.seconds, file: s.done && !s.error && !s.cancelled ? s.file : undefined, error: s.error || undefined, cancelled: s.cancelled || undefined, note: s.note || undefined };
    },
  },
  {
    name: "cancel_render",
    description: "Stops the render that's running. Nothing is saved.",
    schema: {},
    run: () => page("cancel_render"),
  },
  {
    name: "list_projects",
    description: "The person's recent project files (path, name, style, when opened, whether the file is still there), and which file is open now and whether it has unsaved changes.",
    schema: {},
    run: async () => {
      const [{ recent }, open] = await Promise.all([api("GET", "/api/projects/recent"), page("project_file").catch(() => null)]);
      return { open, recent: (recent ?? []).map((r) => ({ path: r.path, name: r.name, style: r.style, opened: r.opened ? new Date(r.opened).toISOString() : undefined, exists: r.exists })) };
    },
  },
  {
    name: "open_project",
    description: "Opens a project file (.dino) in Dinoctor, the same as File > Open. Refuses if the open project has unsaved changes, unless discard: true (ask the person first; or save_project before). Returns the opened project's summary.",
    schema: { path: z.string().describe("The project file's full path (see list_projects)."), discard: z.boolean().optional() },
    run: (a) => page("open_project", a),
  },
  {
    name: "save_project",
    description: "Saves the open project, the same as File > Save. With path: saves to that file (Save As). With name: a new file with that name in the person's projects folder. A project never saved before gets a file in the projects folder.",
    schema: { path: z.string().optional().describe("Full path ending in .dino."), name: z.string().optional().describe("A name for a new file in the projects folder.") },
    run: (a) => page("save_project", a),
  },
];
