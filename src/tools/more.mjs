// MORE tools: the parts of the editor the first tools didn't reach (owner, 2026-11-23: the MCP must make videos with
// every detail she can make by hand). Samples' Presets, the Effects menu (moving elements and pieces placed by hand),
// the Adjust looks, Documentary worlds, and each sound's own settings. They run in the open Dinoctor window; each change
// is one undo step for the person.

import { z } from "zod";
import { page } from "../connect.mjs";
import { CHANGE, SET } from "./hints.mjs";
import { SHOT_ARGS, shotIdOf, withoutShot } from "./shot.mjs";

const NUM = (what) => z.number().optional().describe(what);
const COLOR = (what) => z.string().optional().describe(`${what}, "#RRGGBB".`);
const UNDO = "One undo step for the person.";
const onShot = (name, description, schema, annotations = CHANGE) => ({
  name,
  description,
  schema: { ...SHOT_ARGS, ...schema },
  annotations,
  run: async (a) => page(name, { ...withoutShot(a), shot: await shotIdOf(a) }),
});

export const MORE = [
  onShot(
    "shot_move",
    `Give a shot a whole camera story, built from what is in it, so the story happens INSIDE the shot instead of cutting. Use it on most shots, a different move each time: in a wide film on shots of 8 seconds or more (works from 4), in a tall film (reels) on EVERY shot from 2.5 seconds (under 6 seconds it makes the short version of the move: same idea, fewer beats; in a tall frame the word goes above the hero and labels below). The hero is a person or object in its cast; a shot with nobody in it (a world, a counter, a map, words) still gets a move: the camera drifts across the world and pushes in (reveal pulls back), turning a little. Other cast members become the things that come in; its words (not the captions) become the important word and the labels. Moves: spotlight (zoom into the face, pan the hero to one side with the word on the empty side, pull back wide while the others come in, push into the first of them), entrance (the hero enters from the side, the camera meets them, goes close, the word comes in beside them), reveal (tight on the face, pull back to the whole scene while the others pop in with their labels), orbit (the camera curves around the hero while going closer, the word rises behind), compare (hold on the hero, slide across to the second thing or a card, pull back to show both). It writes eased camera keys, entrances as keyframes and when each word shows; everything can be changed after. Put the hero, the other things and the words in first. ${UNDO}`,
    {
      move: z.enum(["spotlight", "entrance", "reveal", "orbit", "compare"]).describe("Which shot move."),
      hero: z.string().optional().describe("The cast member to frame (id or name). Default: the first person, else the first thing."),
      objects: z.array(z.string()).optional().describe("Cast members that come in, in order (ids or names). Default: everyone else in the cast."),
      word: z.string().optional().describe("The important word's text id (or its words). Default: the first text that is not a caption."),
      labels: z.array(z.string()).optional().describe("Other text ids for the things that come in. Default: the remaining texts."),
      side: z.enum(["left", "right"]).optional().describe("Which side the hero goes to when the camera pans (the word takes the other side)."),
    },
  ),
  onShot(
    "add_preset",
    `Add a ready-made preset from Samples, Presets to a shot (shot_id, or scene + shot; left out: the shot on screen): hooks, labels, cards, explainers, word animations ("Solid turning letters", "Bar swaps its word", "Words on the ground", "Year in the scene"...), and the person's own. Ids come from library category "presets" (current style only). It never makes the shot longer; the answer says if the preset needs more time. ${UNDO} Returns the new text id: change its words, place, colour, timing or animation with set_text, and fill its picture spots with fill_spot.`,
    {
      id: z.string().describe('A preset id (or exact name) from library category "presets".'),
      words: z.string().optional().describe("Its words, instead of the sample words."),
      x: NUM("Where its middle goes, % across the frame."),
      y: NUM("Where its middle goes, % down the frame."),
      options: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe('The preset\'s own choices, by key, like the Properties panel: for "Real map" (dc-ex-realmap) size full|card, look auto|dark|paper|newsprint|blueprint|oldmap|night, zoom close|medium|wide, start world|close, line dashed|solid, speed slow|normal|fast, traveler none|plane|ship|truck|person, labels on|off, borders on|off, name on|off, distance on|off.'),
      ground: z.enum(["none", "dim", "dark", "paper", "board"]).optional().describe('What is behind a card that has a Ground setting (charts, newspapers, explainers): "none" (Clear, the default) keeps the scene visible around it; dim, dark, paper or board cover the scene.'),
    },
  ),
  onShot(
    "set_element",
    `Add, change or remove an effect from the Effects menu in a shot (shot_id, or scene + shot; left out: the shot on screen). Two kinds, both listed in library category "elements": MOVING (type "moving": weather, smoke, fire, sparks, light leaks, old TV, film marks...) and PLACED pieces put by hand (type "placed": badges, stamps and seals, flying bills, arrows, call-outs, lights...). op add needs kind; change and remove need id (get_shot lists elements). Settings left out keep the piece's own defaults. Animate any of them with set_keyframes on track "element:<id>". ${UNDO} Returns the element.`,
    {
      op: z.enum(["add", "change", "remove"]).optional().describe("add if left out."),
      kind: z.string().optional().describe('add: an element id from library "elements".'),
      id: z.string().optional().describe("change / remove: the element's id."),
      // both
      x: NUM("% from the left of the frame."),
      y: NUM("% from the top of the frame."),
      size: NUM("Size in % (moving: 100 normal; placed: % of the frame's short side)."),
      depth: z.enum(["behind", "front"]).optional().describe("Behind the people or in front of them."),
      color: COLOR("Main colour"),
      color2: COLOR("Second colour (pieces that have two)"),
      speed: NUM("Speed in %, 100 normal."),
      picture: z.string().optional().describe("A picture url (from upload or put_picture) for elements made from a picture."),
      // moving
      amount: NUM("Moving: how much, 0 to 100."),
      blend: z.string().optional().describe('Moving: "light" (adds light) or "dark" (takes it away). Placed: "normal", "screen" or "multiply".'),
      where: z.enum(["all", "top", "bottom", "spot"]).optional().describe("Moving: where in the frame."),
      spread: NUM("Moving: how far a spot reaches."),
      opacity: NUM("Moving: 0 to 100."),
      // placed
      words: z.string().optional().describe('Placed: its words (a badge, the flying bills\' card like "$EXPENSIVE!", a call-out).'),
      words2: z.string().optional().describe("Placed: its second words, when it has them."),
      count: NUM("Placed: how many (bills, stars, dots...)."),
      icons: z.array(z.string()).optional().describe("Placed: icon ids for pieces that show icons."),
      rot: NUM("Placed: turn in degrees."),
      flip: z.boolean().optional().describe("Placed: mirror it."),
      pin: z.enum(["camera", "frame"]).optional().describe("Placed: camera = moves with the camera (in the world), frame = stays put on screen."),
      zoom: NUM("Placed with a picture: how close, %."),
      pan_x: NUM("Placed with a picture: where it looks across, 0 to 100."),
      pan_y: NUM("Placed with a picture: where it looks down, 0 to 100."),
      bend: NUM("Placed lines: how far it bows, -100 to 100."),
      thick: NUM("Placed lines: line weight %, 100 normal."),
      soft: NUM("Placed: blur %."),
      strength: NUM("Placed: 0 to 100."),
      enter: NUM("Placed: seconds into the shot it comes in."),
      leave: z.union([z.number(), z.null()]).optional().describe("Placed: seconds into the shot it leaves; null = stays to the end."),
      ease_in: NUM("Placed: seconds it takes to come in."),
      ease_out: NUM("Placed: seconds it takes to go."),
      way: z.enum(["own", "fade", "rise", "pop"]).optional().describe("Placed: how it comes in (own = the piece's own animation)."),
    },
  ),
  onShot(
    "set_look",
    `Set a shot's Adjust looks (shot_id, or scene + shot; left out: the shot on screen), or every shot in its scene with whole_scene. Groups: grain, noise, vignette, hold (choppy film), curve (brightness, contrast, shadows, mids, highlights), warp (wobble, boil), paper, duotone (pair from library "looks"). Give { group: { setting: value } } (that turns it on), true for the defaults, or false to turn it off. Defaults and setting names are in library category "looks". Animate a look with set_keyframes on track "adjust:<group>". ${UNDO}`,
    {
      adjust: z.record(z.string(), z.union([z.boolean(), z.record(z.string(), z.union([z.number(), z.string(), z.boolean()]))])).describe('Like { "grain": { "amount": 40 }, "vignette": { "amount": 70, "softness": 50 }, "noise": false }.'),
      whole_scene: z.boolean().optional().describe("true: the same looks on every shot of this scene."),
    },
    SET,
  ),
  onShot(
    "set_world",
    `Documentary only: give a shot a world, or set its black bars (letterbox) (shot_id, or scene + shot; left out: the shot on screen): its light, colour grade, ground, bars and look in one choice. Ids from library category "worlds". whole_scene puts it on every shot of the scene, and new shots then take it too. Words keep their own colours. ${UNDO}`,
    {
      id: z.string().optional().describe('A world id from library "worlds", like "dw-dark-cinema". Leave out to change only letterbox.'),
      letterbox: z.enum(["on", "off"]).optional().describe("The black bars at the top and bottom."),
      whole_scene: z.boolean().optional().describe("true: the whole scene takes this world."),
    },
    SET,
  ),
  {
    name: "sound_fx",
    description: `Change one sound's own settings, like the Properties panel in Sound and script: target "music", a placed sound clip id (get_project sound.clips) or a script line id (its voice). Volume (gain dB), left or right (pan), fades, trims, speed, a voice effect (library "sound_effects", group Effect), and an ending (library "sound_effects", group Ending): stop, fade, reverb or echo at a moment, ringing out for tail seconds. target "shot" (with shot_id) sets that shot's automatic sound effects: level (dB) or mute. The sound file is remade at once so it plays and exports changed. ${UNDO}`,
    schema: {
      target: z.string().describe('"music", a clip id, a script line id, or "shot".'),
      ...SHOT_ARGS,
      gain: NUM("Volume in dB, -30 to 12 (0 = as recorded)."),
      pan: NUM("-1 all left to 1 all right."),
      fade_in: NUM("Seconds."),
      fade_out: NUM("Seconds."),
      trim_in: NUM("Seconds cut off the start of the file."),
      trim_out: NUM("Seconds cut off the end of the file."),
      speed: NUM("0.5 to 2, keeps the pitch."),
      effect: z.union([z.string(), z.null()]).optional().describe('A voice effect id (echo, radio, phone, robot...), or null to remove.'),
      amount: NUM("The effect's strength, 0 to 1."),
      end: z
        .union([
          z.object({
            kind: z.enum(["stop", "fade", "reverb", "echo"]).optional(),
            at: NUM("Seconds into the sound's own file where it ends."),
            tail: NUM("Seconds it rings out (fade length for fade)."),
            amount: NUM("Tail loudness 0 to 1.5."),
            decay: NUM("Reverb: how fast it dies, 0.6 to 4."),
            delay: NUM("Echo: seconds between repeats."),
            feedback: NUM("Echo: repeats 0 to 0.85."),
          }),
          z.null(),
        ])
        .optional()
        .describe("An ending; null removes it (plays to its own end)."),
      level: NUM('target "shot": the shot\'s sound effects level in dB.'),
      mute: z.boolean().optional().describe('target "shot": true turns its sound effects off.'),
      events: z.record(z.string(), z.union([z.object({ gain: NUM("dB"), off: z.boolean().optional(), nudge: NUM("Frames earlier (-) or later (+).") }), z.null()])).optional().describe('target "shot": one automatic sound by its event id ("tr" = the transition\'s sound), like { "tr": { "gain": -15 } }; null resets it.'),
    },
    annotations: CHANGE,
    run: async (a) => {
      const { target } = a;
      if (target === "shot") return page("sound_fx", { ...withoutShot(a), shot: await shotIdOf(a) });
      return page("sound_fx", withoutShot(a));
    },
  },
];
