// Media tools: pictures (Higgsfield), files from this computer, the script, voices (ElevenLabs), music and sound
// effects. Paid steps (Higgsfield credits, ElevenLabs characters) first answer with the price and need confirm: true.
// Files are saved by the app first, then the open window puts them into the project.

/* global fetch, AbortSignal, Buffer, process, setTimeout */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { api, enginePort, page } from "../connect.mjs";
import { CHANGE, PAID, READ, SET } from "./hints.mjs";
import { SHOT_ARGS, shotIdOf, withoutShot } from "./shot.mjs";

const PICTURE = /\.(png|jpe?g|webp|gif|svg|avif)$/i;
const VIDEO = /\.(mp4|mov|m4v|webm|mkv)$/i;
const SOUND = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|aiff?|caf)$/i;
const SOUNDISH = /\.(mp3|wav|m4a|aac|ogg|oga|opus|flac|aiff?|caf|webm)$/i; // a file asked for as a sound
const PRICE = { "1k": 1.5, "2k": 2, "4k": 3 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A file the person named, checked before anything is sent.
const localFile = (p, kinds, what) => {
  const file = path.resolve(String(p ?? "").replace(/^~(?=$|\/)/, process.env.HOME ?? "~"));
  if (!p || !existsSync(file) || !statSync(file).isFile()) throw new Error(`There's no file at "${p}". Give the full path of a file on this computer.`);
  if (kinds && !kinds.test(file)) throw new Error(`"${path.basename(file)}" isn't ${what}.`);
  return file;
};

// Sends a file to the app's save routes (the same ones its own upload uses), on this computer only.
const sendFile = async (route, file) => {
  const origin = `http://localhost:${enginePort()}`;
  let r;
  try {
    r = await fetch(`http://127.0.0.1:${enginePort()}${route}`, { method: "POST", headers: { Origin: origin }, body: createReadStream(file), duplex: "half", signal: AbortSignal.timeout(30 * 60 * 1000) });
  } catch {
    throw new Error("Dinoctor isn't open. Call open_dinoctor first (or ask the person to open the Dinoctor app).");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Dinoctor couldn't save ${path.basename(file)}.`);
  return data;
};
const postJson = async (route, body) => {
  const r = await fetch(`http://127.0.0.1:${enginePort()}${route}`, { method: "POST", headers: { Origin: `http://localhost:${enginePort()}`, "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(10 * 60 * 1000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Dinoctor answered ${r.status}.`);
  return data;
};
const stamp = () => Date.now().toString(36);
const ext = (file) => (path.extname(file).slice(1).replace(/[^a-z0-9]/gi, "").slice(0, 4) || "bin").toLowerCase();
const baseName = (file) => path.basename(file).replace(/\.[^.]+$/, "");
const saveAsset = async (file) => (await sendFile(`/api/asset?path=${encodeURIComponent(`${stamp()}-${path.basename(file)}`)}`, file)).url;
const saveSound = async (file, prefix) => (await sendFile(`/api/voice?path=${encodeURIComponent(`${prefix}-${stamp()}.${ext(file)}`)}`, file)).url;
const dataUrl = (file) => `data:image/${ext(file) === "jpg" ? "jpeg" : ext(file)};base64,${readFileSync(file).toString("base64")}`;

// ---- Higgsfield ----

const account = async () => {
  const [acc, credits] = await Promise.all([api("GET", "/api/generate/account"), api("GET", "/api/generate/credits").catch(() => ({ credits: null }))]);
  return { installed: !!acc.installed, signedIn: !!acc.signedIn, credits: credits.credits };
};
const needSignedIn = (acc) => {
  if (!acc.installed) throw new Error("Higgsfield isn't set up in Dinoctor. The person can connect it in Settings, Connections.");
  if (!acc.signedIn) throw new Error("Higgsfield isn't signed in. Call generator_account with sign_in: true (it opens the person's browser), or ask them to sign in in Settings, Connections.");
};

// Where a finished picture goes once its job is done, by job id. Kept while this MCP runs.
const waiting = new Map();
const genUrl = (p) => `/api/generate/file?id=${encodeURIComponent(p.id)}&f=${encodeURIComponent(p.file)}`;
const putPicture = async (picture, where) => {
  if (!where || where.as === "none") return null;
  return page("media_put", { url: genUrl(picture), name: where.name || picture.asked?.slice(0, 24) || "Picture", as: where.as, shot: where.shot, replace: where.replace, trim: picture.kind !== "background" });
};
// Asks how the picture job is going for up to `seconds`, and puts the picture in when it's finished.
const follow = async (seconds) => {
  const until = Date.now() + seconds * 1000;
  for (;;) {
    const { job } = await api("GET", "/api/generate");
    if (!job) return { job: null, note: "No picture is being made." };
    if (job.error) {
      waiting.delete(job.id);
      throw new Error(`The picture couldn't be made: ${job.error}`);
    }
    if (job.stage === "Done" && job.picture) {
      const where = waiting.get(job.id);
      waiting.delete(job.id);
      const placed = await putPicture(job.picture, where);
      return { done: true, picture: { id: job.picture.id, kind: job.picture.kind, asked: job.picture.asked }, ...(job.warning ? { warning: job.warning } : {}), ...(placed ? { placed } : {}) };
    }
    if (Date.now() > until) return { done: false, job: job.id, stage: job.stage, next: "Still working. Call generate_picture with action status to wait for it; it puts the picture in when it's done." };
    await sleep(3000);
  }
};

const where = (a, as) => ({ as: a.put ?? as, shot: a.shot, replace: a.replace, name: a.name });
const generate = (kind, defaultPut) => async (a) => {
  const quality = a.quality ?? "2k";
  const acc = await account();
  const credits = PRICE[quality];
  const price = { credits, note: `About ${credits} Higgsfield credits${kind !== "background" ? ", plus a little more to take the background off" : ""}.`, creditsLeft: acc.credits, signedIn: acc.signedIn };
  if (!a.confirm) return { confirm_needed: true, ...price, next: "Ask the person if they want to spend this. If yes, call again with the same arguments and confirm: true." };
  needSignedIn(acc);
  const refs = (a.references ?? []).slice(0, 4).map((p) => dataUrl(localFile(p, /\.(png|jpe?g|webp)$/i, "a PNG, JPG or WebP picture")));
  const status = await page("status").catch(() => ({}));
  const started = await api("POST", "/api/generate", { prompt: a.prompt, kind, style: status.style, references: refs, generated: a.from_pictures ?? [], quality });
  waiting.set(started.job.id, where(a, defaultPut));
  return follow(50);
};
// Shot tools take shot_id or scene + shot; the page side wants the shot's id as `shot`.
const onShot = async (a) => ({ ...withoutShot(a), shot: await shotIdOf(a) });
const placeSchema = {
  put: z.enum(["shot", "media", "none"]).optional().describe("Where it goes: shot (into the shot), media (the project's Media bin), none (only the generated pictures list)."),
  ...SHOT_ARGS,
  replace: z.string().optional().describe("A cast member id in that shot whose picture this replaces."),
  name: z.string().optional().describe("A short name for it in the project."),
};
const asOf = (kind, put) => (put === "media" ? "media" : put === "none" ? "none" : kind === "background" ? "background" : kind);
const genSchema = {
  prompt: z.string().min(1).describe("What to draw, in plain words. @1, @2 point at the reference pictures in order."),
  quality: z.enum(["1k", "2k", "4k"]).optional().describe("Default 2k. About 1.5 / 2 / 3 Higgsfield credits."),
  references: z.array(z.string()).max(4).optional().describe("Paths of up to 4 pictures on this computer to keep the same person or thing."),
  from_pictures: z.array(z.string()).max(4).optional().describe("Ids of pictures made before (generated_pictures) to use as references."),
  confirm: z.boolean().optional().describe("true only after the person agreed to the price."),
  ...placeSchema,
};
const PAY = "Spends the person's Higgsfield credits: the first call (without confirm) only returns the price and credits left; ask the person, then call again with the same arguments and confirm: true.";
const WAIT = "Waits up to about 50 s; if it isn't done, call generate_picture with action status.";

// ---- Tools ----

export const MEDIA = [
  {
    name: "generator_account",
    description:
      "Read-only check of the paid services Dinoctor can use and what's left: Higgsfield (pictures: signed in, credits, any job running), ElevenLabs (voices: connected, plan, characters left) and whether Claude Code is here (for writing scripts). Call it before paid tools to see if they will work. sign_in: true opens the person's browser to sign in to Higgsfield themselves.",
    schema: { sign_in: z.boolean().optional().describe("true: open the person's browser at the Higgsfield sign-in page. Only when they asked to sign in.") },
    annotations: READ,
    run: async (a) => {
      if (a.sign_in) await api("POST", "/api/generate/login", {});
      const [hf, voice, hello, gen] = await Promise.all([
        account(),
        api("GET", "/api/speak/status").catch((e) => ({ connected: false, error: e.message })),
        api("GET", "/api/hello").catch(() => ({})),
        api("GET", "/api/generate").catch(() => ({})),
      ]);
      return {
        higgsfield: { ...hf, ...(a.sign_in ? { note: "The sign-in page opened in the person's browser. Call again once they've signed in." } : {}), job: gen.job ? { id: gen.job.id, stage: gen.job.stage, error: gen.job.error || undefined } : null },
        elevenlabs: { connected: !!voice.connected, plan: voice.plan, charactersLeft: voice.creditsLeft, ...(voice.connected ? {} : { note: "Not connected. The person adds their ElevenLabs key in Sound and script." }) },
        claude: !!hello.claude,
      };
    },
  },
  {
    name: "generate_picture",
    description: `Make a picture with Higgsfield (Nano Banana) from words, and follow or stop the job. action make (default): kind character or object (whole body, its background is taken off) or background (a place, no people); put says where it goes: shot (a character or object joins the shot's cast, or replaces a member's picture with replace; a background becomes the shot's place), media (the Media bin, the default) or none (only the generated pictures list). ${PAY} ${WAIT} action status: waits up to wait seconds for the picture being made (by make or relight) and, when it's done, puts it where that call said and returns its id; { done: false } with the stage while it works, { job: null } when nothing is being made. action stop: stops the picture being made. For a free drawing in the style itself use draw; to reuse a picture made before use put_picture (list them with generated_pictures).`,
    schema: {
      action: z.enum(["make", "status", "stop"]).optional().describe("make (default) a new picture, status of the one being made, or stop it."),
      kind: z.enum(["character", "object", "background"]).optional().describe("make: character or object (background taken off), or background (a place, no people). Needed for make."),
      ...genSchema,
      prompt: genSchema.prompt.optional(),
      wait: z.number().min(0).max(110).optional().describe("status: seconds to wait for it, 0 to 110. Default 50."),
    },
    annotations: PAID,
    run: async (a) => {
      const action = a.action ?? "make";
      if (action === "stop") {
        await api("POST", "/api/generate/stop", {});
        return { stopped: true };
      }
      if (action === "status") return follow(a.wait ?? 50);
      if (!a.kind) throw new Error("Say what to make with kind: character, object or background.");
      if (!a.prompt?.trim()) throw new Error("Say what to draw with prompt, in plain words.");
      const b = await onShot(a);
      return generate(b.kind, asOf(b.kind, b.put ?? "media"))({ ...b, put: undefined });
    },
  },
  {
    name: "generated_pictures",
    description:
      "Read-only list of pictures made with Higgsfield before (kept on this computer for every project), newest first: id, kind, what was asked, when, folder. Free to reuse: pass an id to put_picture, remove_background, relight, or as from_pictures in generate_picture. Pictures already in the project are in get_shot instead.",
    schema: {
      kind: z.enum(["character", "object", "background"]).optional().describe("Only pictures of this kind."),
      limit: z.number().int().min(1).max(100).optional().describe("Most pictures to list, 1 to 100. Default 30."),
    },
    annotations: READ,
    run: async (a) => {
      const { pictures } = await api("GET", "/api/generate/list");
      return pictures.filter((p) => !a.kind || p.kind === a.kind).slice(0, a.limit ?? 30).map((p) => ({ id: p.id, kind: p.kind, asked: p.asked?.slice(0, 120), made: new Date(p.made).toISOString().slice(0, 16), folder: p.folder, warning: p.warning }));
    },
  },
  {
    name: "put_picture",
    description:
      "Put a picture made before (an id from generated_pictures) into the project, free: as a character or object (joins a shot's cast, or replaces a member's picture), a background (the shot's place) or media (the Media bin). One undo step. Returns where it went. For a file on this computer use upload; for a new picture use generate_picture.",
    schema: {
      id: z.string().describe("A picture id from generated_pictures."),
      as: z.enum(["character", "object", "background", "media"]).describe("How it goes into the project."),
      ...SHOT_ARGS,
      replace: placeSchema.replace,
      name: placeSchema.name,
    },
    annotations: CHANGE,
    run: async (raw) => {
      const a = await onShot(raw);
      const { pictures } = await api("GET", "/api/generate/list");
      const pic = pictures.find((p) => p.id === a.id);
      if (!pic) throw new Error(`No generated picture has the id "${a.id}". Use generated_pictures.`);
      return putPicture(pic, { as: a.as, shot: a.shot, replace: a.replace, name: a.name });
    },
  },
  {
    name: "remove_background",
    description:
      "Take the background off a picture made before (generated_pictures id) with Higgsfield's remover; the saved picture is changed. Uses a little of the person's Higgsfield credits: the first call only says so; call again with confirm: true after they agree. Optionally puts the result into a shot or the Media bin (as). For free trimming, cropping or flipping of a picture already in a shot, use cutout.",
    schema: {
      id: z.string().describe("A picture id from generated_pictures."),
      confirm: z.boolean().optional().describe("true only after the person agreed to spend the credits."),
      as: z.enum(["character", "object", "media"]).optional().describe("Where to put the cut-out; leave out to only change the saved picture."),
      ...SHOT_ARGS,
      replace: placeSchema.replace,
    },
    annotations: PAID,
    run: async (raw) => {
      const a = await onShot(raw);
      const { pictures } = await api("GET", "/api/generate/list");
      const pic = pictures.find((p) => p.id === a.id);
      if (!pic) throw new Error(`No generated picture has the id "${a.id}". Use generated_pictures.`);
      const acc = await account();
      if (!a.confirm) return { confirm_needed: true, note: "Uses a little of the person's Higgsfield credits (the background remover).", creditsLeft: acc.credits, next: "Ask the person; if yes, call again with confirm: true." };
      needSignedIn(acc);
      const { picture } = await api("POST", "/api/generate/cutout", { id: a.id }, 6 * 60 * 1000);
      const placed = a.as ? await putPicture(picture, { as: a.as, shot: a.shot, replace: a.replace }) : null;
      return { picture: { id: picture.id, kind: picture.kind }, ...(placed ? { placed } : {}) };
    },
  },
  {
    name: "relight",
    description: `Higgsfield relights a picture photo-real: everything stays, only the light changes (like the Thumbnail studio's Make it real). Give a picture file path or a generated picture id, and the light in words. A new picture is made; the original stays. ${PAY} ${WAIT} The result goes to media, a shot's background, or nowhere. To light a shot in the app itself (free), use set_light.`,
    schema: {
      path: z.string().optional().describe("Full path of a PNG, JPG or WebP on this computer. Or give id."),
      id: z.string().optional().describe("A generated_pictures id instead of a path."),
      light: z.string().min(1).describe("The light, like 'warm low sun from the left, soft blue fill'."),
      tall: z.boolean().optional().describe("Make it 9:16 instead of 16:9."),
      quality: z.enum(["1k", "2k", "4k"]).optional().describe("Default 2k. About 1.5 / 2 / 3 credits."),
      confirm: z.boolean().optional().describe("true only after the person agreed to the price."),
      put: z.enum(["media", "background", "none"]).optional().describe("Default media."),
      ...SHOT_ARGS,
    },
    annotations: PAID,
    run: async (raw) => {
      const a = await onShot(raw);
      if (!a.path && !a.id) throw new Error("Give the picture: a path on this computer or a generated picture id.");
      const quality = a.quality ?? "2k";
      let image;
      if (a.path) image = dataUrl(localFile(a.path, /\.(png|jpe?g|webp)$/i, "a PNG, JPG or WebP picture"));
      else {
        const { pictures } = await api("GET", "/api/generate/list");
        const pic = pictures.find((p) => p.id === a.id);
        if (!pic) throw new Error(`No generated picture has the id "${a.id}". Use generated_pictures.`);
        const r = await fetch(`http://127.0.0.1:${enginePort()}${genUrl(pic)}`);
        image = `data:${r.headers.get("content-type") || "image/png"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
      }
      const acc = await account();
      if (!a.confirm) return { confirm_needed: true, credits: PRICE[quality], note: `About ${PRICE[quality]} Higgsfield credits.`, creditsLeft: acc.credits, signedIn: acc.signedIn, next: "Ask the person; if yes, call again with confirm: true." };
      needSignedIn(acc);
      const started = await api("POST", "/api/generate/relight", { image, light: a.light, tall: !!a.tall, quality });
      waiting.set(started.job.id, { as: a.put ?? "media", shot: a.shot, name: "Relit" });
      return follow(50);
    },
  },
  {
    name: "cutout",
    description:
      "Free picture fixes on this computer for a picture already in a shot: trim its empty see-through edges, crop a percent off each side, or flip it. Give member (a cast member id with a picture) or leave it out for the shot's background picture. One undo step. Returns the new size. To remove a background (paid), use remove_background.",
    schema: {
      ...SHOT_ARGS,
      member: z.string().optional().describe("A cast member id with a picture. Left out: the shot's background picture."),
      trim: z.boolean().optional().describe("true: cut empty see-through edges."),
      flip: z.boolean().optional().describe("true: mirror it left to right."),
      crop: z
        .object({ top: z.number().optional().describe("Percent off the top."), left: z.number().optional().describe("Percent off the left."), right: z.number().optional().describe("Percent off the right."), bottom: z.number().optional().describe("Percent off the bottom.") })
        .optional()
        .describe("Percent (0-45) off each side."),
    },
    annotations: CHANGE,
    run: async (a) => page("media_cutout", await onShot(a)),
  },
  {
    name: "upload",
    description:
      "Bring a file from this computer into the project, like the app's upload. Pictures (PNG/JPG/WebP/GIF/SVG): as media, character or object (joins a shot's cast or replaces a member's picture), or background. Videos (MP4/MOV/WebM): as media, video-background or video-front in a shot. Sounds (MP3/WAV/M4A...): as sound (sound Media, and on the timeline at `at` if given), music, or voice. Default: media for pictures and videos, sound for sounds. The file is copied into Dinoctor; the original isn't changed. One undo step. For pictures made before with Higgsfield, use put_picture.",
    schema: {
      path: z.string().describe("Full path of the file on this computer."),
      as: z.enum(["media", "character", "object", "background", "video-background", "video-front", "sound", "music", "voice"]).optional().describe("How it goes into the project (see the description)."),
      ...SHOT_ARGS,
      replace: placeSchema.replace,
      name: placeSchema.name,
      sound_kind: z.enum(["sfx", "music", "voice"]).optional().describe("For as: sound, what it is (guessed from the name and length otherwise)."),
      at: z.number().min(0).optional().describe("For as: sound, seconds into the film to place it on a free sound line."),
      trim: z.boolean().optional().describe("For a character/object picture: cut its empty see-through edges (default true)."),
    },
    annotations: CHANGE,
    run: async (raw) => {
      const a = await onShot(raw);
      const file = localFile(a.path, null);
      const soundAsked = ["sound", "music", "voice"].includes(a.as);
      // A WebM can be either: a sound when it's asked for as one.
      const isSound = SOUND.test(file) || (/\.webm$/i.test(file) && soundAsked);
      const isVideo = VIDEO.test(file) && !isSound;
      const isPicture = PICTURE.test(file);
      if (!isSound && !isVideo && !isPicture) throw new Error(`Dinoctor takes pictures (PNG, JPG, WebP), videos (MP4, MOV) and sounds (MP3, WAV, M4A). "${path.basename(file)}" is none of those.`);
      const as = a.as ?? (isSound ? "sound" : "media");
      const name = a.name || baseName(file);
      if (["sound", "music", "voice"].includes(as) && !isSound) throw new Error(`"${path.basename(file)}" isn't a sound file, so it can't go in as ${as}.`);
      if (as === "music") return MEDIA.find((t) => t.name === "music").run({ path: file, name });
      if (as === "voice") return MEDIA.find((t) => t.name === "own_voice").run({ path: file, shot: a.shot });
      if (as === "sound") {
        const url = await saveSound(file, "snd");
        return page("media_sound", { url, name, kind: a.sound_kind, at: a.at });
      }
      if (isSound) throw new Error(`A sound goes in as sound, music or voice, not ${as}.`);
      const url = await saveAsset(file);
      return page("media_put", { url, name, as, shot: a.shot, replace: a.replace, kind: isVideo ? "video" : "image", trim: a.trim });
    },
  },
  {
    name: "script",
    description:
      "The film's script, the way Sound and script does it. action get (read-only): title, the chosen voice, every line (id, text, feeling, whether it has a voice and how long) and which shots speak it; use the line ids with assign, speak or own_voice. action write: put a script in: your own lines (short, 5-15 words, one shot each), or text (a whole script, cut into lines at sentences), or only a topic (Dinoctor's Claude writes it; uses the person's own Claude Code and can take a few minutes, so say so first). Unless put_in_film is false, lines go into a scene: shots there without a voice take lines in order, and each line left over becomes a new shot sized to it. Captions show a line's words until it has a voice. replace: false adds to the script. action assign: give one shot (shot_id, or scene + shot; default the shot on screen) one line: the shot speaks that line's voice (or shows its words as a caption until it has one), replacing its own voice; fit: true makes the shot as long as the line. write and assign are one undo step each. To make the voices, call speak next.",
    schema: {
      action: z.enum(["get", "write", "assign"]).describe("get the script, write lines into it, or assign one line to one shot."),
      lines: z
        .array(z.union([z.string(), z.object({ text: z.string().describe("The line."), feeling: z.enum(["neutral", "calm", "warm", "serious", "excited", "playful", "sad", "tense"]).optional().describe("How it's said.") })]))
        .optional()
        .describe("write: your own lines, in order: plain strings or { text, feeling }."),
      text: z.string().optional().describe("write: a whole script to cut into lines at sentences."),
      topic: z.string().optional().describe("write: only a topic: Dinoctor's Claude writes the script."),
      seconds: z.number().min(30).max(600).optional().describe("For a topic: how long the film is (default 60)."),
      tone: z.string().optional().describe("For a topic: the tone, like 'funny' or 'calm documentary'."),
      title: z.string().optional().describe("The script's title."),
      replace: z.boolean().optional().describe("false: add to the script instead of replacing it. Default true."),
      put_in_film: z.boolean().optional().describe("false: only keep the lines in the script, don't touch shots. Default true."),
      scene: z.number().int().min(0).optional().describe("write: the scene to put the lines in, index from 0 (default: the scene on screen). assign: with shot, the shot's scene."),
      new_shots: z.boolean().optional().describe("false: leftover lines wait instead of becoming new shots."),
      fit: z.boolean().optional().describe("Shots that take a line get the line's length (write: default true; assign: default false)."),
      captions: z.boolean().optional().describe("Show captions of the lines (default true)."),
      line: z.string().optional().describe("assign: a line id from action get."),
      shot_id: SHOT_ARGS.shot_id.describe("assign: the shot's id from get_project. Or give scene and shot."),
      shot: SHOT_ARGS.shot,
    },
    annotations: CHANGE,
    run: async (a) => {
      if (a.action === "get") return page("media_script_view");
      if (a.action === "assign") {
        if (!a.line) throw new Error("Say which line with line (an id from script with action get).");
        const shot = (await shotIdOf(a)) ?? (await page("status")).showing?.id;
        return page("media_assign_line", { line: a.line, shot, fit: a.fit });
      }
      if (a.action !== "write") throw new Error('script needs an action: "get", "write" or "assign".');
      let lines;
      let title = a.title;
      if (a.lines?.length) lines = a.lines.map((l) => (typeof l === "string" ? { text: l } : l));
      else if (a.text?.trim()) lines = (await api("POST", "/api/script/split", { text: a.text })).lines.map((l) => ({ text: l.text }));
      else if (a.topic?.trim()) {
        const samples = await page("media_script_samples");
        const out = await api("POST", "/api/script/write", { topic: a.topic, seconds: a.seconds ?? 60, tone: a.tone, samples }, 11 * 60 * 1000);
        lines = out.lines;
        title = title || out.title;
      } else throw new Error("Give lines, a text to cut into lines, or a topic for Claude to write about.");
      return page("media_script", { lines, title, topic: a.topic, replace: a.replace, put_in_film: a.put_in_film, scene: a.scene, new_shots: a.new_shots, fit: a.fit, captions: a.captions });
    },
  },
  {
    name: "voices",
    description:
      "List the ElevenLabs voices in the person's own account (id, name, what it sounds like), read-only. With pick: a voice id becomes the film's voice for speak (one undo step). Needs ElevenLabs connected (see generator_account). Making voices costs characters: that's speak.",
    schema: { pick: z.string().optional().describe("A voice id from the list to make it the film's voice.") },
    annotations: SET,
    run: async (a) => {
      const list = await api("GET", "/api/speak/voices");
      const voices = Array.isArray(list) ? list : list.voices ?? [];
      if (a.pick) {
        const v = voices.find((x) => x.id === a.pick);
        if (!v) throw new Error(`"${a.pick}" isn't one of the person's ElevenLabs voices. Pick an id from the list.`);
        return page("media_pick_voice", { id: v.id, name: v.name });
      }
      return voices;
    },
  },
  {
    name: "speak",
    description:
      "Make the voice for script lines with ElevenLabs, with the time of every word, and give it to the shots that speak each line (captions follow the words; shots fit the voice unless fit is false). Spends the person's ElevenLabs characters: the first call (without confirm) returns the cost and what's left; ask, then call again with confirm: true. Default: every line without a voice, in the film's voice. Returns what was made and characters left. For the person's own recording (free), use own_voice.",
    schema: {
      lines: z.array(z.string()).optional().describe("Line ids from script with action get. Default: every line without a voice."),
      voice: z.string().optional().describe("An ElevenLabs voice id (voices). Default: the film's voice."),
      model: z.enum(["eleven_multilingual_v2", "eleven_v3", "eleven_flash_v2_5", "eleven_turbo_v2_5"]).optional().describe("Default eleven_multilingual_v2. Flash and turbo cost half."),
      again: z.boolean().optional().describe("Make the voice again even for lines that have one."),
      fit: z.boolean().optional().describe("Shots get the voice's length (default true)."),
      confirm: z.boolean().optional().describe("true only after the person agreed to the cost."),
    },
    annotations: PAID,
    run: async (a) => {
      const s = await page("media_script_view");
      const voiceId = a.voice ?? s.voice?.id;
      const chosen = a.lines?.length ? a.lines.map((id) => s.lines.find((l) => l.id === id) ?? (() => { throw new Error(`No script line has the id "${id}". Use script with action get.`); })()) : s.lines.filter((l) => !l.voice || a.again);
      const todo = chosen.filter((l) => l.text.trim() && (a.again || !l.voice || a.lines?.length));
      if (!s.lines.length) throw new Error("The script has no lines yet. Put some in with script, action write, first.");
      if (!todo.length) return { nothing: true, note: "Every line has a voice already. Use again: true to make them again." };
      const status = await api("GET", "/api/speak/status");
      if (!status.connected) throw new Error("ElevenLabs isn't connected. The person adds their key in Sound and script.");
      if (!voiceId) throw new Error("Pick a voice first: call voices, then voices with pick, or pass voice.");
      const cost = await api("POST", "/api/speak/cost", { text: todo.map((l) => l.text).join(" "), model: a.model });
      if (!a.confirm) return { confirm_needed: true, lines: todo.length, characters: cost.characters, credits: cost.credits, charactersLeft: status.creditsLeft, voice: voiceId, next: "Ask the person if they want to spend this. If yes, call again with confirm: true." };
      if (a.voice && a.voice !== s.voice?.id) await page("media_pick_voice", { id: a.voice });
      const done = [];
      const all = s.lines;
      for (const l of todo) {
        const i = all.findIndex((x) => x.id === l.id);
        const v = await api("POST", "/api/speak/line", { text: l.text, voiceId, feeling: l.feeling, id: l.id, model: a.model, previous: all[i - 1]?.text, next: all[i + 1]?.text }, 3 * 60 * 1000);
        done.push(await page("media_line_voice", { line: l.id, voice: { url: v.url, seconds: v.seconds, words: v.words }, fit: a.fit }));
      }
      const after = await api("GET", "/api/speak/status").catch(() => ({}));
      return { made: done, charactersLeft: after.creditsLeft };
    },
  },
  {
    name: "own_voice",
    description:
      "Use the person's own recording (a sound file on this computer) as a voice, free: for a script line (line), for a shot (it becomes that shot's line), or as a new line. Its words are heard on this computer when voice text is set up, so captions can follow them. cut_pauses takes out long pauses. One undo step. For an AI voice (paid) use speak; for music use music.",
    schema: {
      path: z.string().describe("Full path of the sound file (MP3, WAV, M4A...)."),
      line: z.string().optional().describe("A line id (script with action get) that this recording speaks."),
      shot_id: SHOT_ARGS.shot_id.describe("Or: a shot's id; the recording becomes that shot's line. Or give scene and shot."),
      scene: SHOT_ARGS.scene,
      shot: SHOT_ARGS.shot,
      text: z.string().optional().describe("What it says, if known."),
      cut_pauses: z.boolean().optional().describe("true: take out long pauses."),
      fit: z.boolean().optional().describe("true: the shot gets the recording's length."),
    },
    annotations: CHANGE,
    run: async (raw) => {
      const a = await onShot(raw);
      const file = localFile(a.path, SOUNDISH, "a sound file (MP3, WAV, M4A...)");
      // A wrong shot or line is refused before anything is saved or listened to.
      if (a.shot) await page("get_shot", { id: a.shot });
      if (a.line && !(await page("media_script_view")).lines.some((l) => l.id === a.line)) throw new Error(`No script line has the id "${a.line}". Use script with action get.`);
      let url = await saveSound(file, `rec-${stamp()}`);
      const heard = await postJson("/api/transcribe", { url }).catch((e) => ({ words: [], why: e.message }));
      let words = heard.words ?? [];
      let cut;
      if (a.cut_pauses) {
        const out = await api("POST", "/api/speak/cut", { url, words });
        url = out.url;
        words = out.words;
        cut = out.removed;
      }
      const res = await page("media_own_voice", { url, words, line: a.line, shot: a.shot, text: a.text, cut, fit: a.fit });
      return { ...res, ...(heard.why ? { note: `The words weren't heard (${heard.why}), so captions can't follow them.` } : {}) };
    },
  },
  {
    name: "music",
    description:
      "The film's background music: add the person's music file (it's levelled so it sits under the voice; the levelled copy replaces it by itself a minute or two later), set its volume and how far it drops under the voice, or remove it. One undo step. Returns the music settings. For short sounds at a moment, use upload as sound or sound_effects.",
    schema: {
      path: z.string().optional().describe("Full path of a music file on this computer."),
      name: z.string().optional().describe("A name for it. Default: the file name."),
      gain: z.number().optional().describe("Volume in dB, -24 to 6."),
      duck: z.number().optional().describe("How far it drops under the voice, dB 0 to 24. Default 12."),
      remove: z.boolean().optional().describe("true: remove the music."),
    },
    annotations: SET,
    run: async (a) => {
      let url;
      if (a.path) {
        const file = localFile(a.path, SOUNDISH, "a sound file (MP3, WAV, M4A...)");
        url = await saveSound(file, "music");
      }
      const out = await page("media_music", { url, name: a.name || (a.path ? baseName(a.path) : undefined), gain: a.gain, duck: a.duck, remove: a.remove });
      // Levelling a long song takes a while, so the music goes in at once and its levelled copy takes its place when
      // it's ready (only if the music is still the same file then).
      if (url) {
        void api("POST", "/api/speak/level", { url }, 10 * 60 * 1000)
          .then((level) => level?.url && page("media_music", { url: level.url, seconds: level.seconds, only_if: url }))
          .catch(() => {});
        out.note = "The music is in. A levelled copy (so it sits under the voice) replaces it by itself in a minute or two.";
      }
      return out;
    },
  },
  {
    name: "sound_effects",
    description:
      "Dinoctor's automatic sound effects (from the style's sound pack, worked out from what happens in each shot). Film-wide: on, volume, room tone. One shot: shot_on, shot_volume, and one sound by its event key: event_on, pick another sound, own_path (the person's own file), gain, nudge, reset. Call with just the shot (shot_id, or scene + shot) to list that shot's sounds and their event keys (no change). One undo step per change. For music use music; for any other sound file use upload as sound.",
    schema: {
      on: z.boolean().optional().describe("Film-wide: sound effects on or off."),
      volume: z.number().optional().describe("Film-wide volume in dB, -18 to 6."),
      room: z.boolean().optional().describe("Film-wide: quiet room tone under everything."),
      shot_id: SHOT_ARGS.shot_id.describe("A shot's id (or give scene and shot). With only this, lists the shot's sounds."),
      scene: SHOT_ARGS.scene,
      shot: SHOT_ARGS.shot,
      shot_on: z.boolean().optional().describe("This shot's sound effects on or off."),
      shot_volume: z.number().optional().describe("This shot's volume in dB."),
      event: z.string().optional().describe("One sound's event key, from the list."),
      event_on: z.boolean().optional().describe("That sound on or off."),
      pick: z.string().optional().describe("Another sound from that event's choices."),
      own_path: z.string().optional().describe("Full path of the person's own sound file to use for that event."),
      gain: z.number().optional().describe("That sound's volume in dB."),
      nudge: z.number().optional().describe("Frames earlier (-) or later (+)."),
      reset: z.boolean().optional().describe("true: that sound back to automatic."),
    },
    annotations: SET,
    run: async (raw) => {
      const a = await onShot(raw);
      const { own_path, ...rest } = a;
      if (own_path) {
        if (!a.event) throw new Error("Say which sound (event) the file replaces. Call sound_effects with the shot to list them.");
        const file = localFile(own_path, SOUNDISH, "a sound file (MP3, WAV, M4A...)");
        rest.own = { url: await saveSound(file, "sound"), name: path.basename(file).slice(0, 40) };
      }
      return page("media_effects", rest);
    },
  },
];
