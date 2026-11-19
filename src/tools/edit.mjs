// EDIT tools: build and change whole videos in the open Dinoctor window, step by step, without raw edit_project
// paths. They run inside the open Dinoctor window; each change is one undo step for the person.

import { z } from "zod";
import { page } from "../connect.mjs";
import { CHANGE, REPLACE, SET } from "./hints.mjs";
import { SHOT_ARGS, shotIdOf, shotRef, withoutShot } from "./shot.mjs";

const PCT = (what) => z.number().min(0).max(100).optional().describe(`${what}, in % through the shot (0 to 100)`);
const WHEN = z.enum(["start", "middle", "end"]).optional().describe("Rough timing in the shot. Use at for an exact %.");
const LIB = "Ids must come from the current style: call library to see them (a wrong id is refused with the valid list).";
const UNDO = "One undo step for the person.";
const OUT = "Returns { done } with the ids of what changed.";
const NUM = (what) => z.number().optional().describe(what);
const COLOR = (what) => z.string().optional().describe(`${what}, "#RRGGBB".`);

// `handler` is the page side's name for it (older tool names stay there). Tools that work on one shot (`onShot`) take
// shot_id or scene + shot, and send the page the shot's id as `shot`.
const tool = (name, description, schema, annotations = CHANGE, handler = name) => ({ name, description, schema, annotations, run: (a) => page(handler, a) });
const onShot = (name, handler, description, schema, annotations = CHANGE) => ({
  name,
  description,
  schema: { ...SHOT_ARGS, ...schema },
  annotations,
  run: async (a) => page(handler, { ...withoutShot(a), shot: await shotIdOf(a) }),
});
// A shot or a whole scene: shot_id, scene + shot (a shot), scene alone (that scene), or id (either kind).
const shotOrScene = async (a) => {
  const ref = shotRef(a);
  if (ref.id) return ref.id;
  if (typeof a.id === "string" && a.id) return a.id;
  if (typeof a.shot === "number") return shotIdOf(a);
  if (typeof a.scene === "number") {
    const sc = (await page("get_project")).scenes?.[a.scene];
    if (!sc) throw new Error(`There's no scene ${a.scene + 1}. Use get_project to see the scenes.`);
    return sc.id;
  }
  return undefined;
};
const SHOT_OR_SCENE = {
  shot_id: SHOT_ARGS.shot_id.describe("A shot's id from get_project."),
  scene: z.number().int().min(0).optional().describe("Scene index from 0. Alone: the whole scene; with shot: that shot."),
  shot: SHOT_ARGS.shot,
  id: z.string().optional().describe("Or: a shot id or a scene id from get_project."),
};

export const EDIT = [
  tool(
    "new_project",
    "Replace the open project with a new, empty one (one scene, one shot with the style's start place, light and lead character). The first call only says what will happen; ask the person, then call again with confirm: true. The person can Undo it right after. To keep the project and only change its look, use set_style; to open a saved file, use open_project. Returns the new scene and shot ids.",
    {
      style: z.string().optional().describe("Style id from list_styles, like pixel, toon, voxel, docu. Left out: the current style."),
      format: z.enum(["horizontal", "vertical"]).optional().describe("horizontal 16:9 or vertical 9:16. Left out: the current format."),
      confirm: z.boolean().optional().describe("true only after the person said yes."),
    },
    REPLACE,
  ),
  tool(
    "set_style",
    `Switch the whole project to another built-in art style. Every shot is rebuilt from the new style's own place, light and lead character: actions, cast, scenery and keyframes go; texts and lengths stay. If the project already has work, the first call returns needsConfirm; ask, then call with confirm: true. ${UNDO} For one of the person's own styles use use_style; to start fresh use new_project.`,
    { style: z.string().describe("Style id from list_styles."), confirm: z.boolean().optional().describe("true only after the person agreed to rebuild the shots.") },
    REPLACE,
  ),
  tool(
    "set_format",
    `Make the whole video horizontal (16:9, YouTube) or vertical (9:16, Reels / Shorts / TikTok). Shots stay as they are, framed for the new shape. ${UNDO} ${OUT}`,
    { format: z.enum(["horizontal", "vertical"]).describe("horizontal 16:9 or vertical 9:16.") },
    SET,
  ),
  tool(
    "add_scene",
    `Add a scene (a group of shots, usually a new place or moment) with one shot in it, and show it. The shot starts like the app's + Scene: the last shot's place, light and cast (or the style's plain place), a still medium camera, 3 seconds. Returns the new scene id, shot id and cast ids. ${UNDO} To add a shot to an existing scene, use add_shot.`,
    {
      name: z.string().optional().describe("Like 'The chase'. Left out: Scene N."),
      after: z.union([z.string(), z.number().int()]).optional().describe("Scene id or index to put it after. Left out: after the last scene."),
      seconds: NUM("Length of its first shot in seconds (3 if left out)."),
      place: z.string().optional().describe(`Place preset id. ${LIB}`),
      camera: z.string().optional().describe("Camera move id (library cameras)."),
      light: z.string().optional().describe("Lighting preset id (library lights)."),
      empty: z.boolean().optional().describe("true: start with nobody in the shot."),
    },
  ),
  tool(
    "add_shot",
    `Add one empty shot (no cast, no scenery items; place, light and look carry on from the shot before, like the app's + Shot). By default it goes right after the shot on screen. Returns the new shot id. Then fill it with set_cast, direct_cast, set_text, set_camera, set_light, set_place and set_transition. ${UNDO} For a new place or moment use add_scene; to copy a shot use duplicate.`,
    {
      after: z.string().optional().describe("Put it right after this shot id."),
      scene: z.union([z.string(), z.number().int()]).optional().describe("Or: add it at the end of this scene (id or index)."),
      first: z.boolean().optional().describe("With scene: put it first in the scene instead."),
      seconds: NUM("Length in seconds (3 if left out)."),
      place: z.string().optional().describe(`Place preset id, with its scenery. ${LIB}`),
      camera: z.string().optional().describe("Camera move id (library cameras)."),
      light: z.string().optional().describe("Lighting preset id (library lights)."),
    },
  ),
  {
    name: "remove",
    description: `Remove a shot (shot_id, or scene + shot) or a whole scene (scene alone, or its id). A scene's only shot can't be removed alone (remove the scene), and the last scene can't go. ${UNDO} Returns { done }. To take a person or object out of a shot, use set_cast with op remove.`,
    schema: SHOT_OR_SCENE,
    annotations: CHANGE,
    run: async (a) => page("remove", { id: await shotOrScene(a) }),
  },
  {
    name: "move",
    description: `Move a shot (shot_id) to another position, in its own scene or into another scene (scene is where it goes). The shot keeps all its settings. ${UNDO} Returns { done, shot }. To copy instead of move, use duplicate.`,
    annotations: CHANGE,
    run: (a) => {
      const { shot_id, ...rest } = a;
      return page("move", { ...rest, id: shot_id ?? a.id });
    },
    schema: {
      shot_id: z.string().optional().describe("The shot to move (its id from get_project)."),
      scene: z.union([z.string(), z.number().int()]).optional().describe("Target scene id or index. Left out: its own scene."),
      before: z.string().optional().describe("Put it before this shot id."),
      index: z.number().int().optional().describe("Or: its new position in the scene, from 0. Left out (and no before): the end."),
    },
  },
  {
    name: "duplicate",
    description: `Copy a shot (shot_id, or scene + shot; the copy goes right after it) or a whole scene (scene alone, or its id; the copy goes after it). Copies are separate: changing one never changes the other. Returns the new ids. ${UNDO} For a new empty shot use add_shot.`,
    schema: SHOT_OR_SCENE,
    annotations: CHANGE,
    run: async (a) => page("duplicate", { id: await shotOrScene(a) }),
  },
  {
    name: "cut_shot",
    description: `Cut a shot (shot_id, or scene + shot; left out: the shot on screen) in two at a time, like a clip in an editor: both parts together play exactly what the shot played; the second keeps the transition and the voice stays in the first. Times round to 0.1 s and must be at least 0.2 s from either edge. Returns { first, second } shot ids. ${UNDO} To change only the length, use edit_project on seconds.`,
    schema: { ...SHOT_ARGS, at: z.number().describe("Seconds into the shot where it's cut.") },
    annotations: CHANGE,
    run: async (a) => page("cut_shot", { id: await shotIdOf(a, ["id"]), at: a.at }),
  },
  tool(
    "rename_scene",
    `Rename a scene (the name the person sees in the scene list and the timeline). Names don't have to be unique and change nothing else in the film. ${UNDO} Fails if the scene isn't found or the name is empty. Returns { done }. Shots have no names; scenes are listed by get_project.`,
    {
      id: z.union([z.string(), z.number().int()]).describe("Scene id or index from 0 (get_project)."),
      name: z.string().describe("The new name, like 'The chase'. Short is best; it can't be empty."),
    },
    SET,
  ),
  onShot(
    "set_cast",
    "cast",
    `Add, change or remove a character or object in a shot (shot_id, or scene + shot; left out: the shot on screen). op add needs ref (a character or object id of the style); change and remove need member (its id from get_shot, or its name). ${LIB} A character added without x is spaced out automatically. Returns the shot and member ids. ${UNDO} To make the cast move or feel something, use direct_cast; for animation over time, use set_keyframes.`,
    {
      op: z.enum(["add", "change", "remove"]).optional().describe("add if left out."),
      ref: z.string().optional().describe("Character or object id (add), or a new one of the same kind (change swaps it)."),
      member: z.string().optional().describe("Member id or name (change, remove)."),
      name: z.string().optional().describe("A name for this member, like 'Mia'. Used by direct_cast and in undo notes."),
      x: NUM("Left (-) to right (+); about -8 to 8 is in frame."),
      z: NUM("Near (+) to far (-); 0 is the front line."),
      y: NUM("Height above the ground; 0 stands on it."),
      size: NUM("1 is normal size."),
      facing: z.enum(["left", "right"]).optional().describe("Which way it looks."),
      turn: NUM("Degrees, turning round like on a stage."),
      spin: NUM("Degrees, turning in the picture like a wheel."),
      tint: z.string().optional().describe('Colour "#RRGGBB", or "" to remove.'),
      accessory: z.string().optional().describe('hat, crown, party, bow (only characters that can dress), or "".'),
      pose: z.string().optional().describe("A pose id the character offers."),
      auto_x: z.boolean().optional().describe("change: true lets the scene space it out again."),
    },
  ),
  onShot(
    "direct_cast",
    "act",
    `Direct the cast of a shot (shot_id, or scene + shot; left out: the shot on screen): actions, faces, talking and looking. kind action: a move (type from library actions) by actor, some need a target; timed by when or exact at %. kind emotion: a face feeling on member at %. kind talk: member's mouth moves from % to %. kind look: member looks at target from % to %. op add (default), change (id), remove (id), clear (all of that kind). ${LIB} Returns the item id. ${UNDO} To place or remove people use set_cast; for exact paths over time use set_keyframes.`,
    {
      kind: z.enum(["action", "emotion", "talk", "look"]).optional().describe("action if left out."),
      op: z.enum(["add", "change", "remove", "clear"]).optional().describe("add if left out. clear removes every item of this kind in the shot."),
      id: z.string().optional().describe("The action/emotion/talk/look id, for change and remove."),
      type: z.string().optional().describe("Action id (library actions)."),
      actor: z.string().optional().describe("Member id or name doing the action (first cast member if left out)."),
      target: z.string().optional().describe("Member id or name it's done to / looked at."),
      member: z.string().optional().describe("For emotion, talk, look: whose face."),
      emotion: z.string().optional().describe("Emotion id (library emotions)."),
      when: WHEN,
      at: PCT("When it happens"),
      from: PCT("Start"),
      to: PCT("End"),
      speed: NUM("Action speed, 1 is normal."),
      side: z.enum(["left", "right"]).optional().describe("For sided moves."),
    },
  ),
  onShot(
    "set_text",
    "words",
    `Add, change or remove on-screen text in a shot (shot_id, or scene + shot; left out: the shot on screen). preset is one of the style's text presets (its look and font); action is its animation (pop, slam, type, fade, slide, drop...). ${LIB} Returns the shot and text ids. ${UNDO} For a script line that is spoken, use script with action write or assign (its captions come from the voice).`,
    {
      op: z.enum(["add", "change", "remove"]).optional().describe("add if left out."),
      id: z.string().optional().describe("Text id, for change and remove."),
      words: z.string().optional().describe("The text. Short reads best: 2 to 5 words."),
      preset: z.string().optional().describe("Text preset id (library text_presets)."),
      action: z.string().optional().describe("Animation id (library text_animations)."),
      when: WHEN,
      x: NUM("Centre across, in % of the frame (50 is the middle)."),
      y: NUM("Centre down, in % of the frame (18 is near the top; captions sit near 84)."),
      size: NUM("1 is normal."),
      at: PCT("When it appears"),
      until: PCT("When it leaves"),
      line_words: z.number().int().optional().describe("Words per line (2 if left out)."),
      color: z.string().optional().describe('"#RRGGBB", or "" for the preset\'s own.'),
      font: z.string().optional().describe('A font family the style offers, or "".'),
    },
  ),
  onShot(
    "set_camera",
    "camera",
    `Set a shot's camera (shot_id, or scene + shot; left out: the shot on screen): a preset move with strength and wiggle, or direct it with camera keys (keys win over the move). Each key: at (seconds) and any of x, y, z, distance, height, angle, roll, ease; what a key leaves out is taken from where the camera is at that moment. ${LIB} Returns the camera settings. ${UNDO} For the end-of-shot camera move into the next shot, use set_transition (outro_camera).`,
    {
      move: z.string().optional().describe("Camera move id (library cameras). Clears camera keys."),
      strength: NUM("How far the move goes, 0 to 100."),
      wiggle: NUM("Handheld feel: 0 locked off, 1 normal, up to 3."),
      keys: z
        .array(
          z.object({
            at: z.number().describe("Seconds into the shot."),
            x: NUM("Point it looks at: across."),
            y: NUM("Point it looks at: height."),
            z: NUM("Point it looks at: near (+) / far (-)."),
            distance: NUM("Distance from that point, about 2 to 40."),
            height: NUM("Camera height, about 0.3 to 30."),
            angle: NUM("Degrees around the point."),
            roll: NUM("Tilt of the picture, about -3.2 to 3.2."),
            ease: z.string().optional().describe("smooth, even, fast-start, slow-start, punch, bounce"),
            still: z.boolean().optional().describe("true on a single key: a locked camera that doesn't move."),
          }),
        )
        .optional()
        .describe("Camera keys in time order."),
      replace_keys: z.boolean().optional().describe("false: add these keys to the ones there. Default replaces them."),
      clear_keys: z.boolean().optional().describe("true: drop camera keys, back to the move."),
    },
    SET,
  ),
  onShot(
    "set_light",
    "light",
    `Light a shot (shot_id, or scene + shot; left out: the shot on screen): a lighting preset (the style's moods), and/or the ambient colour and level, and single lights. Any hand change makes it a custom look. ${LIB} Returns the lighting. ${UNDO} To change the light over time, use set_keyframes (scene:light or light:<id>).`,
    {
      preset: z.string().optional().describe("Lighting preset id (library lights)."),
      ambient: COLOR("Ambient colour"),
      level: NUM("Ambient level, 0 to 1.2."),
      add_light: z
        .object({ color: COLOR("Light colour"), x: NUM("-14 to 14 across."), y: NUM("0 to 12 height."), z: NUM("-8 to 10, near (+) / far (-)."), intensity: NUM("0 to 4."), flicker: z.boolean().optional().describe("true: flickers like fire.") })
        .optional()
        .describe("Add one light."),
      change_light: z
        .object({ id: z.string().describe("Light id from get_shot."), color: COLOR("Light colour"), x: NUM("-14 to 14 across."), y: NUM("0 to 12 height."), z: NUM("-8 to 10."), intensity: NUM("0 to 4."), flicker: z.boolean().optional().describe("true: flickers like fire.") })
        .optional()
        .describe("Change one light."),
      remove_light: z.string().optional().describe("Light id to remove."),
    },
    SET,
  ),
  onShot(
    "set_place",
    "place",
    `Set where a shot happens (shot_id, or scene + shot; left out: the shot on screen): a place preset (with its scenery), and/or its colours and sky, and scenery items. ${LIB} Returns the place and its item ids. ${UNDO} For a generated photo background use generate_picture with kind background; for your own picture use upload with as background.`,
    {
      preset: z.string().optional().describe("Place preset id (library places)."),
      name: z.string().optional().describe("A name for the place."),
      sky: COLOR("Sky colour"),
      horizon: COLOR("Horizon colour"),
      floor: COLOR("Floor colour"),
      dark: z.boolean().optional().describe("true: a dark place (night, inside)."),
      stars: z.boolean().optional().describe("Show stars."),
      clouds: z.boolean().optional().describe("Show clouds."),
      walls: z.boolean().optional().describe("Show walls (an inside place)."),
      orb: z.enum(["none", "sun", "moon"]).optional().describe("Sun, moon or none."),
      add_items: z
        .array(z.object({ kind: z.string().describe("An object or place id of the style."), x: NUM("Left (-) / right (+)."), z: NUM("Near (+) / far (-), about -3 to -30."), size: NUM("1 is normal.") }))
        .optional()
        .describe("Scenery items to add."),
      change_items: z
        .array(z.object({ id: z.string().describe("Item id from get_shot."), kind: z.string().optional().describe("Swap to another object id."), x: NUM("Left / right."), z: NUM("Near / far."), size: NUM("1 is normal.") }))
        .optional()
        .describe("Scenery items to change."),
      remove_items: z.array(z.string()).optional().describe("Item ids to remove."),
      clear_items: z.boolean().optional().describe("true: remove every scenery item."),
    },
    SET,
  ),
  onShot(
    "set_keyframes",
    "keys",
    `Animate anything in a shot (shot_id, or scene + shot; left out: the shot on screen) by hand with keyframes on a track. Tracks: "cast:<member id>" (x, y, z, size, spin, turn), "item:<item id>" (x, z, size), "text:<text id>" (x, y, size), "light:<light id>" (x, y, z, intensity, color), "scene:light" (level, ambient), "mask:shot", "adjust:<group>", "element:<id>". op set puts values at a time (a first key after 0 also keys the resting value at 0), remove deletes the key at that time, clear drops the track. ${UNDO} For ready-made moves use direct_cast; for the camera use set_camera keys.`,
    {
      track: z.string().describe('Which thing, like "cast:member-1" or "scene:light" (ids from get_shot).'),
      op: z.enum(["set", "remove", "clear"]).optional().describe("set if left out."),
      at: z.number().optional().describe("Seconds into the shot."),
      values: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional().describe('Like {"x": 3, "size": 1.4}.'),
      ease: z.string().optional().describe("How it travels on to the next key: smooth, even, fast-start, slow-start, punch, bounce."),
    },
  ),
  onShot(
    "set_transition",
    "transition",
    `Set how a shot (shot_id, or scene + shot; left out: the shot on screen) changes into the next one: a transition id (cut, fade, whip-left, match-zoom-in, ink-splat... see library transitions), its length, and its options. Also the end-of-shot moves before it (outro camera, effect, character), or a ready combo of both. Empty string removes an outro part. ${LIB} Returns the transition. ${UNDO}`,
    {
      id: z.string().optional().describe("Transition id (library transitions)."),
      combo: z.string().optional().describe("A ready-made combo id (outro + transition)."),
      seconds: NUM("Transition length in seconds."),
      color: z.string().optional().describe('For transitions that use a colour: "#RRGGBB".'),
      word: z.string().optional().describe("For transitions that show a word."),
      point: z.array(z.number()).optional().describe("For transitions that start at a point: [across, down], 0 to 1."),
      outro_camera: z.string().optional().describe('Outro camera move id, or "" to remove.'),
      outro_effect: z.string().optional().describe('Outro effect id, or "" to remove.'),
      outro_character: z.string().optional().describe('Outro character move id, or "" to remove.'),
      outro_ref: z.string().optional().describe("Which character id does the outro move."),
      outro_size: NUM("Size of that character, 1 is normal."),
    },
    SET,
  ),
];
