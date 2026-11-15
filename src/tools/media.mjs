// Media tools: pictures (Higgsfield), files from this computer, the script, voices (ElevenLabs), music and sound
// effects. Paid steps (Higgsfield credits, ElevenLabs characters) first answer with the price and need confirm: true.
// Files are saved by the app first, then the open window puts them into the project.

/* global fetch, AbortSignal, Buffer, process, setTimeout */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { api, enginePort, page } from "../connect.mjs";

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
    if (Date.now() > until) return { done: false, job: job.id, stage: job.stage, next: "Still working. Call picture_status to wait for it; it puts the picture in when it's done." };
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
const placeSchema = {
  put: z.enum(["shot", "media", "none"]).optional(),
  shot: z.string().optional().describe("Shot id (from get_project). Default: the shot on screen."),
  replace: z.string().optional().describe("A cast member id in that shot whose picture this replaces."),
  name: z.string().optional().describe("A short name for it in the project."),
};
const asOf = (kind, put) => (put === "media" ? "media" : put === "none" ? "none" : kind === "background" ? "background" : kind);
const genSchema = {
  prompt: z.string().min(1).describe("What to draw, in plain words. @1, @2 point at the reference pictures in order."),
  quality: z.enum(["1k", "2k", "4k"]).optional().describe("Default 2k."),
  references: z.array(z.string()).max(4).optional().describe("Paths of up to 4 pictures on this computer to keep the same person or thing."),
  from_pictures: z.array(z.string()).max(4).optional().describe("Ids of pictures made before (generated_pictures) to use as references."),
  confirm: z.boolean().optional().describe("true only after the person agreed to the price."),
  ...placeSchema,
};

// ---- Tools ----

export const MEDIA = [
  {
    name: "generator_account",
    description: "Which paid generators Dinoctor can use and what's left: Higgsfield (pictures: signed in, credits), ElevenLabs (voices: connected, characters left) and whether Claude Code is here (for writing scripts). sign_in: true opens the person's browser to sign in to Higgsfield themselves.",
    schema: { sign_in: z.boolean().optional() },
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
    description: "Make a picture with Higgsfield (Nano Banana) from words: a character or object (its background is taken off) or a background. Spends the person's Higgsfield credits: call first without confirm to get the price, ask the person, then call again with confirm: true. Waits up to ~50 s; if it's not done yet, call picture_status. put: 'media' (default) keeps it in the project's Media, 'shot' puts it in a shot (character/object joins the cast, background becomes the place), 'none' only keeps it in the generated list.",
    schema: { kind: z.enum(["character", "object", "background"]), ...genSchema },
    run: (a) => generate(a.kind, asOf(a.kind, a.put ?? "media"))({ ...a, put: undefined }),
  },
  {
    name: "generate_character",
    description: "Make a character picture with Higgsfield (whole body, background taken off) and add it to a shot's cast (or replace a member's picture with replace). Costs credits: first call returns the price; call again with confirm: true after the person agrees. put: 'media' or 'none' to keep it out of the shot.",
    schema: genSchema,
    run: (a) => generate("character", asOf("character", a.put))({ ...a, put: undefined }),
  },
  {
    name: "generate_place",
    description: "Make a background (a place, no people) with Higgsfield and make it the shot's background. Costs credits: first call returns the price; call again with confirm: true after the person agrees.",
    schema: genSchema,
    run: (a) => generate("background", asOf("background", a.put))({ ...a, put: undefined }),
  },
  {
    name: "picture_status",
    description: "How the Higgsfield picture being made is going. Waits up to `wait` seconds (default 50) and, when it's done, puts it where generate_* / relight said. stop: true stops it.",
    schema: { wait: z.number().min(0).max(110).optional(), stop: z.boolean().optional() },
    run: async (a) => {
      if (a.stop) {
        await api("POST", "/api/generate/stop", {});
        return { stopped: true };
      }
      return follow(a.wait ?? 50);
    },
  },
  {
    name: "generated_pictures",
    description: "Pictures made with Higgsfield before (kept on this computer for every project): id, kind, what was asked. Use an id with put_picture (free), remove_background, relight, or as from_pictures.",
    schema: { kind: z.enum(["character", "object", "background"]).optional(), limit: z.number().int().min(1).max(100).optional() },
    run: async (a) => {
      const { pictures } = await api("GET", "/api/generate/list");
      return pictures.filter((p) => !a.kind || p.kind === a.kind).slice(0, a.limit ?? 30).map((p) => ({ id: p.id, kind: p.kind, asked: p.asked?.slice(0, 120), made: new Date(p.made).toISOString().slice(0, 16), folder: p.folder, warning: p.warning }));
    },
  },
  {
    name: "put_picture",
    description: "Put a picture made before (generated_pictures id) into the project. Free. as: character / object (join a shot's cast, or replace a member's picture), background (the shot's place), media (the Media bin).",
    schema: { id: z.string(), as: z.enum(["character", "object", "background", "media"]), shot: placeSchema.shot, replace: placeSchema.replace, name: placeSchema.name },
    run: async (a) => {
      const { pictures } = await api("GET", "/api/generate/list");
      const pic = pictures.find((p) => p.id === a.id);
      if (!pic) throw new Error(`No generated picture has the id "${a.id}". Use generated_pictures.`);
      return putPicture(pic, { as: a.as, shot: a.shot, replace: a.replace, name: a.name });
    },
  },
  {
    name: "remove_background",
    description: "Take the background off a picture made before (generated_pictures id) with Higgsfield's remover. Uses a little of the person's Higgsfield credits: the first call says so; call again with confirm: true after they agree. Optionally put the result in (put: shot/media, shot, replace).",
    schema: { id: z.string(), confirm: z.boolean().optional(), as: z.enum(["character", "object", "media"]).optional().describe("Where to put the cut-out; leave out to only change the saved picture."), shot: placeSchema.shot, replace: placeSchema.replace },
    run: async (a) => {
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
    description: "Higgsfield relights a picture photo-real (everything stays, only the light changes), like the Thumbnail studio's Make it real. Give a picture file path or a generated picture id, and the light in words. Costs about the same as a picture (1.5 / 2 / 3 credits for 1k / 2k / 4k): first call returns the price, call again with confirm: true. The result can go to media or a shot's background.",
    schema: {
      path: z.string().optional(),
      id: z.string().optional().describe("A generated_pictures id instead of a path."),
      light: z.string().min(1).describe("The light, like 'warm low sun from the left, soft blue fill'."),
      tall: z.boolean().optional().describe("Make it 9:16 instead of 16:9."),
      quality: z.enum(["1k", "2k", "4k"]).optional(),
      confirm: z.boolean().optional(),
      put: z.enum(["media", "background", "none"]).optional().describe("Default media."),
      shot: placeSchema.shot,
    },
    run: async (a) => {
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
    description: "Free picture fixes on this computer for a picture already in a shot: trim its empty see-through edges, crop percent off each side, or flip it. Give member (a cast member id with a picture) or leave it out for the shot's background picture.",
    schema: {
      shot: placeSchema.shot,
      member: z.string().optional(),
      trim: z.boolean().optional(),
      flip: z.boolean().optional(),
      crop: z.object({ top: z.number().optional(), left: z.number().optional(), right: z.number().optional(), bottom: z.number().optional() }).optional().describe("Percent (0-45) off each side."),
    },
    run: (a) => page("media_cutout", a),
  },
  {
    name: "upload",
    description:
      "Bring a file from this computer into the project, like the page's upload. Pictures (PNG/JPG/WebP/GIF/SVG): as media (the Media bin), character or object (join a shot's cast, or replace a member's picture), background (the shot's place). Videos (MP4/MOV/WebM): as media, video-background or video-front in a shot. Sounds (MP3/WAV/M4A...): as sound (sound Media, and on the film's timeline at `at` seconds if given), music (the film's music, levelled), voice (a voice-over line, see own_voice). Default: media for pictures and videos, sound for sounds.",
    schema: {
      path: z.string().describe("Full path of the file on this computer."),
      as: z.enum(["media", "character", "object", "background", "video-background", "video-front", "sound", "music", "voice"]).optional(),
      shot: placeSchema.shot,
      replace: placeSchema.replace,
      name: placeSchema.name,
      sound_kind: z.enum(["sfx", "music", "voice"]).optional().describe("For as: sound, what it is (guessed from the name and length otherwise)."),
      at: z.number().min(0).optional().describe("For as: sound, seconds into the film to place it on a free sound line."),
      trim: z.boolean().optional().describe("For a character/object picture: cut its empty see-through edges (default true)."),
    },
    run: async (a) => {
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
    name: "get_script",
    description: "The film's script in Sound and script: title, the chosen voice, every line (id, text, feeling, whether it has a voice) and which shots speak it.",
    schema: {},
    run: () => page("media_script_view"),
  },
  {
    name: "write_script",
    description:
      "Put a script in the film, the way Sound and script does. Give your own `lines` (each one short, 5-15 words, one shot each), or `text` (a whole script, cut into lines at sentences), or only a `topic` (Dinoctor's Claude writes it, matched to the style's sample shots; this uses the person's Claude Code and can take a few minutes). Lines go to the script and, unless put_in_film is false, into a scene: shots there without a voice take lines in order, and each line left over becomes a new shot (a copy of the scene's last shot), sized to the line. Captions show the line's words until it has a voice. replace: false adds to the script instead of replacing it.",
    schema: {
      lines: z.array(z.union([z.string(), z.object({ text: z.string(), feeling: z.enum(["neutral", "calm", "warm", "serious", "excited", "playful", "sad", "tense"]).optional() })])).optional(),
      text: z.string().optional(),
      topic: z.string().optional(),
      seconds: z.number().min(30).max(600).optional().describe("For a topic: how long the film is (default 60)."),
      tone: z.string().optional(),
      title: z.string().optional(),
      replace: z.boolean().optional(),
      put_in_film: z.boolean().optional(),
      scene: z.number().int().min(0).optional().describe("Scene index from 0. Default: the scene on screen."),
      new_shots: z.boolean().optional().describe("false: leftover lines wait instead of becoming new shots."),
      fit: z.boolean().optional().describe("Existing shots that take a line get the line's length (default true)."),
      captions: z.boolean().optional(),
    },
    run: async (a) => {
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
    name: "assign_line",
    description: "Give a shot a script line: the shot speaks its voice (or shows its words as a caption until it has one). Replaces the shot's own voice. fit: true also makes the shot as long as the line.",
    schema: { line: z.string(), shot: z.string(), fit: z.boolean().optional() },
    run: (a) => page("media_assign_line", a),
  },
  {
    name: "voices",
    description: "The ElevenLabs voices in the person's account (id, name, what it sounds like). pick: a voice id makes it the film's voice for speak.",
    schema: { pick: z.string().optional() },
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
      "Make the voice for script lines with ElevenLabs, with the time of every word, and give it to the shots that speak each line (captions follow the words). Spends the person's ElevenLabs characters: call without confirm to get the cost and what's left, ask the person, then call again with confirm: true. lines: line ids (get_script); default every line without a voice. voice: an ElevenLabs voice id (voices), default the film's voice.",
    schema: {
      lines: z.array(z.string()).optional(),
      voice: z.string().optional(),
      model: z.enum(["eleven_multilingual_v2", "eleven_v3", "eleven_flash_v2_5", "eleven_turbo_v2_5"]).optional().describe("Default eleven_multilingual_v2. Flash and turbo cost half."),
      again: z.boolean().optional().describe("Make the voice again even for lines that have one."),
      fit: z.boolean().optional().describe("Shots get the voice's length (default true)."),
      confirm: z.boolean().optional(),
    },
    run: async (a) => {
      const s = await page("media_script_view");
      const voiceId = a.voice ?? s.voice?.id;
      const chosen = a.lines?.length ? a.lines.map((id) => s.lines.find((l) => l.id === id) ?? (() => { throw new Error(`No script line has the id "${id}". Use get_script.`); })()) : s.lines.filter((l) => !l.voice || a.again);
      const todo = chosen.filter((l) => l.text.trim() && (a.again || !l.voice || a.lines?.length));
      if (!s.lines.length) throw new Error("The script has no lines yet. Put some in with write_script first.");
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
    description: "Use the person's own recording (a sound file on this computer) as a voice: for a script line (line), for a shot (shot: it becomes that shot's line), or as a new line. Its words are heard on this computer when voice text is set up, so captions can follow them. cut_pauses: true takes out long pauses. Free.",
    schema: { path: z.string(), line: z.string().optional(), shot: z.string().optional(), text: z.string().optional().describe("What it says, if known."), cut_pauses: z.boolean().optional(), fit: z.boolean().optional() },
    run: async (a) => {
      const file = localFile(a.path, SOUNDISH, "a sound file (MP3, WAV, M4A...)");
      // A wrong shot or line is refused before anything is saved or listened to.
      if (a.shot) await page("get_shot", { id: a.shot });
      if (a.line && !(await page("media_script_view")).lines.some((l) => l.id === a.line)) throw new Error(`No script line has the id "${a.line}". Use get_script.`);
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
    description: "The film's music: add the person's music file (path; it's levelled so it sits under the voice), set its volume (gain, dB -24 to 6), how far it drops under the voice (duck, dB 0 to 24, default 12), or remove it.",
    schema: { path: z.string().optional(), name: z.string().optional(), gain: z.number().optional(), duck: z.number().optional(), remove: z.boolean().optional() },
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
      "Dinoctor's automatic sound effects (from the style's sound pack, worked out from what happens in each shot). Film-wide: on, volume (dB -18 to 6), room (room tone). One shot (shot id; default the shot on screen when any shot setting is given): shot_on, shot_volume, and one sound by its event key (listed in the answer): event_on, pick (another sound from its choices), own_path (the person's own sound file), gain (dB), nudge (frames earlier/later), reset. Call with just shot to list that shot's sounds.",
    schema: {
      on: z.boolean().optional(),
      volume: z.number().optional(),
      room: z.boolean().optional(),
      shot: z.string().optional(),
      shot_on: z.boolean().optional(),
      shot_volume: z.number().optional(),
      event: z.string().optional(),
      event_on: z.boolean().optional(),
      pick: z.string().optional(),
      own_path: z.string().optional(),
      gain: z.number().optional(),
      nudge: z.number().optional(),
      reset: z.boolean().optional(),
    },
    run: async (a) => {
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
