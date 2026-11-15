// Styles and samples: the person's own styles (Claude Code builds them inside Dinoctor), switching style, ready-made
// samples and recipes, templates, and drawings you send yourself.

import { setTimeout as wait } from "node:timers/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { api, page } from "../connect.mjs";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".avif": "image/avif", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm", ".m4v": "video/x-m4v" };

// A file on this computer, ready to send to the window.
const readFile = (file, { pictureOnly = false, maxMb = 25 } = {}) => {
  if (!path.isAbsolute(file)) throw new Error(`Give the full path of the file, like /Users/you/Pictures/look.png. "${file}" isn't one.`);
  if (!existsSync(file)) throw new Error(`There's no file at ${file}.`);
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime || (pictureOnly && !mime.startsWith("image/"))) throw new Error(`${path.basename(file)} isn't a ${pictureOnly ? "picture" : "picture or video"} Dinoctor can use (png, jpg, webp${pictureOnly ? "" : ", mp4, mov, webm"}).`);
  if (statSync(file).size > maxMb * 1024 * 1024) throw new Error(`${path.basename(file)} is bigger than ${maxMb} MB, so use a smaller copy.`);
  return { name: path.basename(file), mime, data: readFileSync(file).toString("base64") };
};

const shortJob = (job) =>
  job && {
    kind: job.kind,
    id: job.id,
    name: job.name,
    status: job.status,
    step: `${job.step} of ${job.steps.length}: ${job.steps[job.step - 1] ?? ""}`,
    steps: job.steps,
    now: job.status === "running" ? job.line : undefined,
    minutes: Math.round(job.seconds / 6) / 10,
    minutesLeft: job.status === "running" ? job.left : undefined,
    tokens: job.tokens,
    error: job.error,
    problems: job.problems,
    note: job.note,
    canContinue: job.canContinue || undefined,
    recent: (job.log ?? []).slice(-5),
  };

const where = {
  shotId: z.string().optional().describe("The shot's id (from get_project)."),
  scene: z.number().int().optional().describe("Scene index from 0. With no shotId/scene, the shot on screen is used."),
  shot: z.number().int().optional().describe("Shot index from 0 in that scene."),
};

const BUILD_COST =
  "Claude Code runs inside Dinoctor on this computer and builds the style in code: it plans the look, draws characters, objects and places, writes the style, runs the app's tests, checks a test shot and makes the pictures. Usually about 30 minutes (longer for a detailed 3D style), and it uses a lot of the person's own Claude usage (a smaller plan can hit its limit). Nothing is paid to Dinoctor. The person can keep working, and cancel_style stops it at any time.";

const drawTool = (kind) => ({
  name: `draw_${kind}`,
  description: `Draw a new ${kind} yourself, in the current style's format, and add it to the person's library${kind === "place" ? " and set it as the shot's place" : " and into a shot"}. No Claude usage or credits are spent: you send the drawing as plain data and Dinoctor checks it (bad fields are dropped; a drawing that fails is refused with the reason). Call describe_drawing first to get the exact format for the current style. Formats in short: Pixel = {"name","rows":["..##..",...],"colors":{"#":"#535353"}${kind === "character" ? ',"eyes":[[col,row]],"mouth":[col,row]' : ""}} (up to 28x28, '.' empty${kind === "character" ? ", facing right, at least 20 columns wide" : ""}); Toon = ${kind === "character" ? '{"name","skin","shirt","pants","hair":"tuft|bob|ears|antennae|cap|horns|none","hairColor","snout","tail","wide","tall"}' : kind === "object" ? '{"name","w","h","shapes":[{"type":"rect|ellipse|poly","x","y","w","h","color","points"}]} (y up is negative, stands on y 0)' : "a place object"}; Voxel = {"name","boxes":[{"at":[x,y,z],"size":[w,h,d],"color"${kind === "character" ? ',"part":"body|legL|legR|armL|armR"' : ""}}]${kind === "character" ? ',"eyes","mouth","faceZ"' : ""}}; other styles have their own format (describe_drawing). Places in every style: {"name","sky","horizon","floor","dark","stars","clouds","orb","items":[{"kind","x","z","size"}]}. Then use look to check it.`,
  schema: {
    drawing: z.record(z.any()).describe("ONE drawing object in the style's format (not an array)."),
    addToShot: z.boolean().optional().describe(`false only saves it to the library. Default true: ${kind === "place" ? "it becomes the shot's place" : "it joins the shot's cast"}.`),
    ...where,
    ...(kind === "place" ? {} : { x: z.number().optional().describe("Left to right, about -6 to 6. Empty spaces it automatically."), size: z.number().optional().describe("1 is normal.") }),
  },
  run: (a) => page(`draw_${kind}`, a),
});

export const STYLES = [
  {
    name: "my_styles",
    description: "The person's own art styles (ones Claude built for them in Dinoctor), with their ratings, plus the style job running now (building or fixing, its progress). Use the id with use_style, fix_style, rate_style or delete_style. Built-in styles are listed by list_styles.",
    schema: {},
    run: async () => {
      const [mine, rated] = await Promise.all([api("GET", "/api/my-styles"), api("GET", "/api/my-styles/ratings").catch(() => ({ ratings: [] }))]);
      return {
        styles: mine.styles.map((s) => ({ id: s.id, name: s.name, about: s.words?.slice(0, 160), tokens: s.tokens, stars: rated.ratings.filter((r) => r.styleId === s.id && r.stars).pop()?.stars })),
        job: shortJob(mine.job),
      };
    },
  },
  {
    name: "make_style",
    description: `Start building a brand-new art style for the person, the same as Dinoctor's "Build your own style". ${BUILD_COST} Without confirm: true it only tells you what will happen; ask the person, then call again with confirm: true. Only one style job runs at a time. Then follow it with style_status.`,
    schema: {
      name: z.string().max(30).describe("The style's name, up to 30 characters."),
      words: z.string().max(4000).optional().describe("The look: characters, world, mood, lettering. Needed unless files are sent."),
      files: z.array(z.string()).max(20).optional().describe("Full paths of pictures or short videos on this computer that show the look (up to 25 MB each). They show Claude far more than words."),
      useProjectFiles: z.boolean().optional().describe("Also send the files already added in Dinoctor's Build your own box."),
      confirm: z.boolean().optional().describe("true starts it (uses the person's Claude usage). Only after the person said yes."),
    },
    run: async (a) => {
      if (!a.name?.trim()) throw new Error("Give the style a name first.");
      if (!a.words?.trim() && !a.files?.length && !a.useProjectFiles) throw new Error("Describe the style in words, or send some files that show it.");
      const uploads = (a.files ?? []).map((f) => readFile(f));
      const now = (await api("GET", "/api/my-styles")).job;
      if (now?.status === "running") throw new Error(`Claude is already ${now.kind === "fix" ? "fixing" : "building"} ${now.name}, so wait for it (style_status) or cancel it first.`);
      if (a.confirm !== true)
        return { needsConfirm: true, name: a.name.trim(), files: uploads.map((u) => u.name), whatHappens: BUILD_COST, next: "Ask the person if they want to spend their Claude usage on this. If yes, call make_style again with the same arguments and confirm: true." };
      await page("style_action", { action: "build", name: a.name, words: a.words ?? "", uploads, useProjectFiles: a.useProjectFiles === true });
      return { started: true, job: shortJob((await api("GET", "/api/my-styles")).job), next: "Check progress with style_status every few minutes. It keeps going if you do other things." };
    },
  },
  {
    name: "style_status",
    description: "How the style build or fix is going: status (running, done, failed, cancelled), step and its name, what Claude does right now, minutes so far and left (a rough guess), tokens used, errors and problems. When it's done, use_style switches to it and rate_style asks how it went. When it failed and canContinue is true, continue_style picks up where it stopped. close: true clears a finished job from the screen.",
    schema: { close: z.boolean().optional().describe("Clear a finished, failed or cancelled job from Dinoctor's screen.") },
    run: async (a) => {
      if (a.close) await page("style_action", { action: "dismiss" });
      const { job } = await api("GET", "/api/my-styles");
      return job ? shortJob(job) : { status: "none", note: "No style is being built or fixed." };
    },
  },
  {
    name: "continue_style",
    description: "A style build or fix that stopped with canContinue: true (see style_status) carries on from where it stopped, in the same Claude session. It uses more of the person's Claude usage, so it needs confirm: true after the person agrees.",
    schema: { confirm: z.boolean().optional() },
    run: async (a) => {
      const { job } = await api("GET", "/api/my-styles");
      if (!job?.canContinue) throw new Error("There's nothing to continue: no style job stopped part way. See style_status.");
      if (a.confirm !== true) return { needsConfirm: true, style: job.name, whatHappens: `Claude picks up ${job.name} where it stopped (step ${job.step} of ${job.steps.length}) and finishes it. It uses more of the person's Claude usage. Ask, then call again with confirm: true.` };
      await page("style_action", { action: "continue" });
      return shortJob((await api("GET", "/api/my-styles")).job);
    },
  },
  {
    name: "fix_style",
    description: "Ask Claude to fix a problem in one of the person's own styles (ids from my_styles), like Dinoctor's Fix a problem. Claude reads the note, fixes the code, runs the tests, checks a test shot and redraws the pictures: usually about 10 minutes, using the person's Claude usage. The style stays as it was until the fix passes. Needs confirm: true after the person agrees.",
    schema: { id: z.string(), words: z.string().max(4000).describe("What's wrong, in plain words."), confirm: z.boolean().optional() },
    run: async (a) => {
      const { styles, job } = await api("GET", "/api/my-styles");
      const s = styles.find((x) => x.id === a.id);
      if (!s) throw new Error(`The person has no style "${a.id}". Use my_styles to see theirs (built-in styles can't be fixed this way).`);
      if (!a.words?.trim()) throw new Error("Say what's wrong first.");
      if (job?.status === "running") throw new Error("Claude is already working on a style, so wait for it or cancel it first.");
      if (a.confirm !== true) return { needsConfirm: true, style: s.name, whatHappens: "Claude fixes it in about 10 minutes, using the person's Claude usage. Ask, then call again with confirm: true." };
      await page("style_action", { action: "fix", id: a.id, words: a.words });
      return shortJob((await api("GET", "/api/my-styles")).job);
    },
  },
  {
    name: "cancel_style",
    description: "Stop the style build or fix that's running. Nothing is changed: the person's styles stay as they were.",
    schema: {},
    run: async () => {
      const { job } = await api("GET", "/api/my-styles");
      if (job?.status !== "running") return { note: "No style job is running.", job: shortJob(job) };
      await page("style_action", { action: "cancel" });
      for (let i = 0; i < 10; i++) {
        const now = (await api("GET", "/api/my-styles")).job;
        if (now?.status !== "running") return { cancelled: true, job: shortJob(now) };
        await wait(500);
      }
      return { cancelling: true, note: "It's stopping. Check style_status in a moment." };
    },
  },
  {
    name: "rate_style",
    description: "Save the person's rating of one of their own styles (1 to 5 stars and a comment), as Dinoctor asks after a build or fix. Only rate with what the person told you. It stays on this computer.",
    schema: { id: z.string(), stars: z.number().int().min(1).max(5), comment: z.string().max(2000).optional() },
    run: async (a) => {
      const { styles, job } = await api("GET", "/api/my-styles");
      const s = styles.find((x) => x.id === a.id);
      if (!s) throw new Error(`The person has no style "${a.id}". Use my_styles to see theirs.`);
      const finished = job?.status === "done" && job.id === a.id;
      await page("style_action", { action: "rate", id: a.id, name: s.name, kind: finished ? job.kind : "build", job: finished ? `${job.kind}-${job.id}-${job.seconds}` : `later-${a.id}`, stars: a.stars, comment: a.comment ?? "" });
      return { rated: s.name, stars: a.stars };
    },
  },
  {
    name: "delete_style",
    description: "Delete one of the person's own styles for good (ids from my_styles). It can't be undone; templates in it stop opening. Without confirm: true it only says what will go. Dinoctor reloads afterwards.",
    schema: { id: z.string(), confirm: z.boolean().optional() },
    run: async (a) => {
      const { styles } = await api("GET", "/api/my-styles");
      const s = styles.find((x) => x.id === a.id);
      if (!s) throw new Error(`The person has no style "${a.id}". Use my_styles to see theirs (built-in styles can't be deleted).`);
      if (a.confirm !== true) return { needsConfirm: true, style: s.name, note: `This deletes ${s.name} for good and can't be undone. Ask the person, then call again with confirm: true.` };
      return page("style_action", { action: "delete", id: a.id });
    },
  },
  {
    name: "use_style",
    description: "Switch the project to another art style (a built-in id from list_styles, or one of the person's own from my_styles). Every shot is rebuilt in the new style: its characters, objects and places are replaced; words, cameras and timing stay. It's one undo step. A style built since Dinoctor opened makes the window reload once.",
    schema: { id: z.string() },
    run: (a) => page("use_style", a),
  },
  {
    name: "samples",
    description:
      'Ready-made samples in the current style: whole films and shot runs (Documentary\'s long samples, on shelves like "Whole films", "Film openings", "Hooks"), shot recipes in the other styles (groups like "Big scenes", "Instagram hook"), and samples the person saved. Actions: "list" (shelf or search to narrow; with neither and many samples it lists the shelves), "open" (id: plays it in the preview without adding anything, returns its shots and the pictures it needs), "close", "add" (id, how: "add" puts its shots after the shot, "shot" in place of the shot, "scene" over the whole scene; which shot by shotId or scene/shot, else the one on screen; returns the new shot ids and the picture spots to fill), "needs" (the empty picture spots in the project, or in one scene / one added group; fill them with fill_spot), "save" (name: saves a scene\'s shots as the person\'s own sample).',
    schema: {
      action: z.enum(["list", "open", "close", "add", "needs", "save"]),
      id: z.string().optional().describe("A sample id (or exact name) from list."),
      shelf: z.string().optional(),
      search: z.string().optional(),
      how: z.enum(["add", "shot", "scene"]).optional(),
      group: z.string().optional().describe("For needs: the group returned by add."),
      name: z.string().optional().describe("For save."),
      ...where,
    },
    run: (a) => page("samples", a),
  },
  {
    name: "fill_spot",
    description: 'Put a picture into an empty picture spot a sample is waiting for (a stand-in person, a photo, a screen or a card\'s picture). key comes from samples "needs" or "add". Send a picture file from this computer (full path), or the address of a picture Dinoctor already has (starting with /, as generate or upload tools return).',
    schema: { key: z.string(), file: z.string().optional().describe("Full path of a png, jpg or webp."), url: z.string().optional() },
    run: (a) => {
      if (a.file) {
        const f = readFile(a.file, { pictureOnly: true });
        return page("fill_spot", { key: a.key, data: f.data, mime: f.mime, name: f.name });
      }
      if (!a.url) throw new Error("Send file (a full path) or url (a Dinoctor picture address).");
      return page("fill_spot", { key: a.key, url: a.url });
    },
  },
  {
    name: "templates",
    description: 'The person\'s templates (saved whole projects to start from), like Dinoctor\'s Templates page. Actions: "list", "save" (name: saves the project as it is now), "open" (id: replaces the open project with the template; one undo step brings it back), "delete" (id, needs confirm: true after the person agrees).',
    schema: { action: z.enum(["list", "save", "open", "delete"]), id: z.string().optional(), name: z.string().optional(), confirm: z.boolean().optional() },
    run: (a) => page("templates", a),
  },
  {
    name: "describe_drawing",
    description: "The exact drawing format for draw_character, draw_object or draw_place in the current style (or the style given), with the look the style wants and an example when the style has one. Read it before drawing.",
    schema: { kind: z.enum(["character", "object", "place"]), style: z.string().optional() },
    run: (a) => page("describe_drawing", a),
  },
  drawTool("character"),
  drawTool("object"),
  drawTool("place"),
];
