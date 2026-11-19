// Styles and samples: the person's own styles (Claude Code builds them inside Dinoctor), switching style, ready-made
// samples and recipes, templates, and drawings you send yourself.

import { setTimeout as wait } from "node:timers/promises";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { api, page } from "../connect.mjs";
import { CHANGE, LOCAL, READ, REPLACE, SET } from "./hints.mjs";
import { SHOT_ARGS, shotRef } from "./shot.mjs";

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
    ...(job.plan ? { plan: job.plan, next: "Show the person this plan. Building waits for their answer: style_job with action continue and confirm: true builds it, add change: '...' to rework the plan first." } : {}),
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

const where = SHOT_ARGS;
// The page side takes shotId, or scene + shot indexes (an old shotId still works).
const toPage = (a) => {
  const ref = shotRef(a, ["shotId"]);
  const rest = { ...a };
  delete rest.shot_id;
  delete rest.shotId;
  return ref.id ? { ...rest, scene: undefined, shot: undefined, shotId: ref.id } : rest;
};

const BUILD_COST =
  "Claude Code runs inside Dinoctor on this computer and builds the style in code: it plans the look, draws characters, objects and places, writes the style, runs the app's tests, checks a test shot and makes the pictures. Usually about 30 minutes (longer for a detailed 3D style), and it uses a lot of the person's own Claude usage (a smaller plan can hit its limit). Nothing is paid to Dinoctor. The person can keep working, and style_job with action cancel stops it at any time.";

const DRAW_FORMATS = `Formats in short: Pixel = {"name","rows":["..##..",...],"colors":{"#":"#535353"}} (up to 28x28, '.' empty; a character also has "eyes":[[col,row]],"mouth":[col,row], faces right and is at least 20 columns wide); Toon character = {"name","skin","shirt","pants","hair":"tuft|bob|ears|antennae|cap|horns|none","hairColor","snout","tail","wide","tall"}, Toon object = {"name","w","h","shapes":[{"type":"rect|ellipse|poly","x","y","w","h","color","points"}]} (y up is negative, stands on y 0); Voxel = {"name","boxes":[{"at":[x,y,z],"size":[w,h,d],"color"}]} (a character's boxes also have "part":"body|legL|legR|armL|armR", plus "eyes","mouth","faceZ"); other styles have their own format (action describe). Places in every style: {"name","sky","horizon","floor","dark","stars","clouds","orb","items":[{"kind","x","z","size"}]}.`;

const drawTool = {
  name: "draw",
  description: `Draw a new character, object or place yourself, free, in the current style's own format, and add it to the person's library: a character or object also joins the shot's cast, a place becomes the shot's place (add_to_shot: false only saves it). Use it for simple things the style doesn't have; for a photo-like picture use generate_picture (paid). No Claude usage or credits are spent: you send the drawing as plain data and Dinoctor checks it (bad fields are dropped; a drawing that fails is refused with the reason). action draw (default) sends the drawing; action describe (read-only) returns the exact format for that kind in the current style (or style), with the look the style wants and an example when it has one: read it before drawing. ${DRAW_FORMATS} Returns the new id. Then use look_at_shot to check it.`,
  schema: {
    action: z.enum(["draw", "describe"]).optional().describe("draw (default) sends a drawing; describe returns the format to use."),
    kind: z.enum(["character", "object", "place"]).describe("What you draw."),
    drawing: z.record(z.string(), z.any()).optional().describe("draw: ONE drawing object in the style's format (not an array)."),
    add_to_shot: z.boolean().optional().describe("draw: false only saves it to the library. Default true: a character or object joins the shot's cast, a place becomes the shot's place."),
    ...where,
    x: z.number().optional().describe("draw, character or object: left to right, about -6 to 6. Empty spaces it automatically."),
    size: z.number().optional().describe("draw, character or object: 1 is normal."),
    style: z.string().optional().describe("describe: a style id. Default: the project's style."),
  },
  annotations: CHANGE,
  run: (a) => {
    if (a.action === "describe") return page("describe_drawing", { kind: a.kind, style: a.style });
    if (!a.drawing || typeof a.drawing !== "object") throw new Error("Send the drawing: one object in the style's format (draw with action describe shows it).");
    const { kind, add_to_shot, x, size, ...rest } = toPage(a);
    delete rest.action;
    delete rest.style;
    return page(`draw_${kind}`, { ...rest, addToShot: add_to_shot ?? a.addToShot, ...(kind === "place" ? {} : { x, size }) });
  },
};

// What each style_job action does (the old make_style, fix_style, continue_style, cancel_style and style_status).
const STYLE_JOB = {
  build: async (a) => {
    if (!a.name?.trim()) throw new Error("Give the style a name first.");
    if (!a.words?.trim() && !a.files?.length && !a.useProjectFiles) throw new Error("Describe the style in words, or send some files that show it.");
    const uploads = (a.files ?? []).map((f) => readFile(f));
    const now = (await api("GET", "/api/my-styles")).job;
    if (now?.status === "running") throw new Error(`Claude is already ${now.kind === "fix" ? "fixing" : "building"} ${now.name}, so wait for it (style_job with action status) or cancel it first.`);
    if (a.confirm !== true)
      return { needsConfirm: true, name: a.name.trim(), files: uploads.map((u) => u.name), whatHappens: BUILD_COST, next: "Ask the person if they want to spend their Claude usage on this. If yes, call style_job (action build) again with the same arguments and confirm: true." };
    await page("style_action", { action: "build", name: a.name, words: a.words ?? "", uploads, useProjectFiles: a.useProjectFiles === true });
    return { started: true, job: shortJob((await api("GET", "/api/my-styles")).job), next: "Claude first looks at the files and writes a plan (a few minutes). Check style_job with action status; when its status is plan, show the person the plan and answer it with action continue. Then the build runs on its own." };
  },
  status: async (a) => {
    if (a.close) await page("style_action", { action: "dismiss" });
    const { job } = await api("GET", "/api/my-styles");
    return job ? shortJob(job) : { status: "none", note: "No style is being built or fixed." };
  },
  continue: async (a) => {
    const { job } = await api("GET", "/api/my-styles");
    // A new style first shows a plan, and only builds after the person says yes to it.
    if (job?.status === "plan") {
      if (a.confirm !== true) return { needsConfirm: true, style: job.name, plan: job.plan, whatHappens: a.change ? "Claude rewrites the plan with the change (a little Claude usage)." : "Claude builds the style from this plan (about 30 minutes of the person's Claude usage). Show the plan, ask, then call again with confirm: true." };
      await page("style_action", { action: "plan", ok: !a.change, words: a.change ?? "" });
      return shortJob((await api("GET", "/api/my-styles")).job);
    }
    if (!job?.canContinue) throw new Error("There's nothing to continue: no style job stopped part way. See style_job with action status.");
    if (a.confirm !== true) return { needsConfirm: true, style: job.name, whatHappens: `Claude picks up ${job.name} where it stopped (step ${job.step} of ${job.steps.length}) and finishes it. It uses more of the person's Claude usage. Ask, then call again with confirm: true.` };
    await page("style_action", { action: "continue" });
    return shortJob((await api("GET", "/api/my-styles")).job);
  },
  fix: async (a) => {
    const { styles, job } = await api("GET", "/api/my-styles");
    const s = styles.find((x) => x.id === a.id);
    if (!s) throw new Error(`The person has no style "${a.id}". Use my_styles to see theirs (built-in styles can't be fixed this way).`);
    if (!a.words?.trim()) throw new Error("Say what's wrong first.");
    if (job?.status === "running") throw new Error("Claude is already working on a style, so wait for it or cancel it first.");
    if (a.confirm !== true) return { needsConfirm: true, style: s.name, whatHappens: "Claude fixes it in about 10 minutes, using the person's Claude usage. Ask, then call again with confirm: true." };
    await page("style_action", { action: "fix", id: a.id, words: a.words });
    return shortJob((await api("GET", "/api/my-styles")).job);
  },
  cancel: async () => {
    const { job } = await api("GET", "/api/my-styles");
    if (job?.status !== "running") return { note: "No style job is running.", job: shortJob(job) };
    await page("style_action", { action: "cancel" });
    for (let i = 0; i < 10; i++) {
      const now = (await api("GET", "/api/my-styles")).job;
      if (now?.status !== "running") return { cancelled: true, job: shortJob(now) };
      await wait(500);
    }
    return { cancelling: true, note: "It's stopping. Check style_job with action status in a moment." };
  },
};

const OWN = "The person's own style id from my_styles (built-in styles can't be used here).";

export const STYLES = [
  {
    name: "my_styles",
    description:
      "Read-only: the person's own art styles (ones Claude built for them in Dinoctor) with id, name, a short about, tokens used and their star rating, plus the style job running now (building or fixing, with progress). Use an id with use_style, style_job (action fix), rate_style or delete_style. Built-in styles are listed by list_styles.",
    schema: {},
    annotations: READ,
    run: async () => {
      const [mine, rated] = await Promise.all([api("GET", "/api/my-styles"), api("GET", "/api/my-styles/ratings").catch(() => ({ ratings: [] }))]);
      return {
        styles: mine.styles.map((s) => ({ id: s.id, name: s.name, about: s.words?.slice(0, 160), tokens: s.tokens, stars: rated.ratings.filter((r) => r.styleId === s.id && r.stars).pop()?.stars })),
        job: shortJob(mine.job),
      };
    },
  },
  {
    name: "style_job",
    description: `Build, fix and follow the person's own art styles: Claude Code runs inside Dinoctor and does the work. Only one style job runs at a time. action build: start a brand-new style from words and/or example pictures (name, words, files), the same as "Build your own style". ${BUILD_COST} Claude first writes a plan; when status shows status plan, show it to the person and answer it with action continue. action fix: ask Claude to fix a problem (words) in one of the person's own finished styles (id), like Fix a problem (about 10 minutes of their Claude usage); the style stays as it was until the fix passes. action continue: answer a new style's plan (build it, or send change to rework it), or resume a build or fix that stopped part way (status says canContinue: true). build, fix and continue use the person's Claude usage, so the first call only says what will happen; ask, then call again with the same arguments and confirm: true. action status (read-only unless close: true, which clears a finished job from Dinoctor's screen): status (running, plan, done, failed, cancelled), step, what Claude does now, minutes so far and left, tokens, errors. action cancel: stops the running job; the person's styles stay as they were. When done, use_style switches to it and rate_style records how it went.`,
    schema: {
      action: z.enum(["build", "fix", "continue", "cancel", "status"]).describe("build a new style, fix one, continue a plan or a stopped job, cancel the running job, or get its status."),
      name: z.string().max(30).optional().describe("build: the style's name, up to 30 characters."),
      words: z.string().max(4000).optional().describe("build: the look (characters, world, mood, lettering), needed unless files are sent. fix: what's wrong, in plain words."),
      files: z.array(z.string()).max(20).optional().describe("build: full paths of pictures or short videos on this computer that show the look (up to 25 MB each). They show Claude far more than words."),
      use_project_files: z.boolean().optional().describe("build: also send the files already added in Dinoctor's Build your own box."),
      id: z.string().optional().describe(`fix: ${OWN}`),
      change: z.string().max(2000).optional().describe("continue, when status shows a plan: what the person wants changed. With it, Claude rewrites the plan instead of building."),
      close: z.boolean().optional().describe("status: clear a finished, failed or cancelled job from Dinoctor's screen."),
      confirm: z.boolean().optional().describe("build, fix, continue: true starts it (uses the person's Claude usage). Only after the person said yes."),
    },
    annotations: LOCAL,
    run: (a) => {
      const run = STYLE_JOB[a.action];
      if (!run) throw new Error('style_job needs an action: "build", "fix", "continue", "cancel" or "status".');
      return run({ ...a, useProjectFiles: a.use_project_files ?? a.useProjectFiles });
    },
  },
  {
    name: "rate_style",
    description:
      "Save the person's rating of one of their own styles (1 to 5 stars and a comment), as Dinoctor asks after a build or fix. Only rate with what the person told you; never make up a rating. It stays on this computer. Returns { rated, stars }.",
    schema: {
      id: z.string().describe(OWN),
      stars: z.number().int().min(1).max(5).describe("The person's stars, 1 to 5."),
      comment: z.string().max(2000).optional().describe("The person's own words about it."),
    },
    annotations: SET,
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
    description:
      "Delete one of the person's own styles for good. It can't be undone, and templates in that style stop opening. Without confirm: true it only says what will go; ask the person first. Dinoctor reloads afterwards. Built-in styles can't be deleted. To only stop using it, switch with use_style instead.",
    schema: { id: z.string().describe(OWN), confirm: z.boolean().optional().describe("true only after the person said to delete it.") },
    annotations: REPLACE,
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
    description:
      "Switch the project to another art style, a built-in id (list_styles) or one of the person's own (my_styles). Every shot is rebuilt in the new style: its characters, objects and places are replaced; words, cameras and timing stay. One undo step, and no confirm step, so ask the person first if the project has work. A style built since Dinoctor opened makes the window reload once. For built-in styles with a confirm step, set_style does the same.",
    schema: { id: z.string().describe("A style id from list_styles or my_styles.") },
    annotations: REPLACE,
    run: (a) => page("use_style", a),
  },
  {
    name: "samples",
    description:
      'Ready-made samples in the current style: whole films and shot runs (on shelves like "Whole films", "Film openings", "Hooks"), shot recipes (groups like "Big scenes", "Instagram hook"), and samples the person saved. action list (read-only; shelf or search narrows it), open (plays one in the preview without adding it; returns its shots and the pictures it needs), close, add (puts its shots in: how add = after the shot, shot = in place of the shot, scene = over the whole scene; returns new shot ids and picture spots to fill), needs (empty picture spots; fill them with fill_spot), save (saves a scene\'s shots as the person\'s own sample). Adding is one undo step. For single ids (a camera, an action) use library; for whole saved projects use templates.',
    schema: {
      action: z.enum(["list", "open", "close", "add", "needs", "save"]).describe("What to do (see the description)."),
      id: z.string().optional().describe("A sample id (or exact name) from list."),
      shelf: z.string().optional().describe("For list: only this shelf."),
      search: z.string().optional().describe("For list: words to look for."),
      how: z.enum(["add", "shot", "scene"]).optional().describe("For add: add = after the shot, shot = in place of the shot, scene = over the whole scene."),
      group: z.string().optional().describe("For needs: the group returned by add."),
      name: z.string().optional().describe("For save: the sample's name."),
      ...where,
    },
    annotations: CHANGE,
    run: (a) => page("samples", toPage(a)),
  },
  {
    name: "fill_spot",
    description:
      'Put a picture into an empty picture spot a sample is waiting for (a stand-in person, a photo, a screen or a card\'s picture). key comes from samples "needs" or "add". Send a picture file from this computer (full path), or the address of a picture Dinoctor already has (starting with /, as generate or upload tools return). One undo step. To put a picture into a shot\'s cast or background instead, use upload or put_picture.',
    schema: {
      key: z.string().describe('The spot\'s key from samples "needs" or "add".'),
      file: z.string().optional().describe("Full path of a png, jpg or webp."),
      url: z.string().optional().describe("Or: a Dinoctor picture address starting with /."),
    },
    annotations: CHANGE,
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
    description:
      'The person\'s templates (saved whole projects to start from), like Dinoctor\'s Templates page. action list (read-only), save (name: saves the project as it is now), open (id: replaces the open project with the template; one undo step brings it back), delete (id: for good, needs confirm: true after the person agrees). For .dino project files use open_project / save_project; for shot recipes use samples.',
    schema: {
      action: z.enum(["list", "save", "open", "delete"]).describe("What to do (see the description)."),
      id: z.string().optional().describe("A template id from list (open, delete)."),
      name: z.string().optional().describe("For save: the template's name."),
      confirm: z.boolean().optional().describe("For delete: true only after the person agreed."),
    },
    annotations: REPLACE,
    run: (a) => page("templates", a),
  },
  drawTool,
];
