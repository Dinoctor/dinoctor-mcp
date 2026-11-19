// How the MCP finds and talks to Dinoctor's engine on this computer.

import { spawn } from "node:child_process";
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

// The app keeps its port in its data folder, so projects (stored by the page, per port) stay where they are.
const dataFolder = () =>
  process.env.DINOCTOR_HOME ||
  (process.platform === "win32" ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Dinoctor") : process.platform === "darwin" ? path.join(os.homedir(), "Library", "Application Support", "Dinoctor") : path.join(os.homedir(), ".config", "Dinoctor"));

export const enginePort = () => {
  if (process.env.DINOCTOR_PORT) return Number(process.env.DINOCTOR_PORT);
  try {
    const kept = Number(readFileSync(path.join(dataFolder(), "port"), "utf8"));
    if (kept) return kept;
  } catch {
    // the app hasn't run yet
  }
  return 3007;
};

const base = () => `http://127.0.0.1:${enginePort()}`;

export const engineUp = async () => {
  try {
    const r = await fetch(`${base()}/api/agent/hello`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return { engine: false, page: false };
    const j = await r.json();
    return { engine: true, page: !!j.page };
  } catch {
    return { engine: false, page: false };
  }
};

const NOT_OPEN = "Dinoctor isn't open. Call open_dinoctor first (or ask the person to open the Dinoctor app).";

// Calls the engine's own API (render, pictures, voices...). Plain node:http, not fetch: fetch gives up on an answer
// after 5 minutes, and a look or a render on a busy computer can take longer. It says it comes from Dinoctor's own
// page address, since the engine only takes some requests from there. A dropped connection is tried once more.
const once = (method, route, body, timeoutMs) =>
  new Promise((resolve, reject) => {
    const port = enginePort();
    const data = body ? Buffer.from(JSON.stringify(body)) : null;
    const req = http.request(
      { host: "127.0.0.1", port, path: route, method, headers: { Host: `localhost:${port}`, Origin: `http://localhost:${port}`, ...(data ? { "Content-Type": "application/json", "Content-Length": data.length } : {}) } },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString() }));
        res.on("error", reject);
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });

export const api = async (method, route, body, timeoutMs = 120000) => {
  let r;
  try {
    r = await once(method, route, body, timeoutMs);
  } catch (e) {
    if (e.message === "timeout") throw new Error("Dinoctor took too long to answer, so check its window isn't busy and try again.");
    try {
      await new Promise((ok) => setTimeout(ok, 800));
      r = await once(method, route, body, timeoutMs);
    } catch {
      throw new Error(NOT_OPEN);
    }
  }
  let data;
  try {
    data = r.text ? JSON.parse(r.text) : {};
  } catch {
    data = { text: r.text };
  }
  if (r.status < 200 || r.status >= 300) throw new Error(data.error || `Dinoctor answered ${r.status}.`);
  return data;
};

// Runs a tool inside the open Dinoctor window (src/picker/agent/).
export const page = async (tool, args = {}) => {
  const res = await api("POST", "/api/agent/call", { tool, args }, 11 * 60 * 1000).catch((e) => {
    throw e;
  });
  return res.value;
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Starts the app and waits for its window.
export const openApp = async () => {
  const now = await engineUp();
  if (now.page) return { opened: false, ready: true };
  // Started by the app itself (Dinoctor --mcp): open that same app, wherever it is installed (the Store's folder too).
  // The app's own Node setting is left out, or it would start as Node instead of opening its window.
  const own = process.env.DINOCTOR_APP;
  if (own && existsSync(own)) {
    const bundle = process.platform === "darwin" ? own.match(/^(.*?\.app)\//)?.[1] : null;
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(ELECTRON_RUN_AS_NODE|DINOCTOR_APP|DINOCTOR_APP_ARGS|DINOCTOR_HOME)$/.test(key)));
    const args = (() => {
      try {
        return JSON.parse(process.env.DINOCTOR_APP_ARGS || "[]");
      } catch {
        return [];
      }
    })();
    if (bundle && !args.length) spawn("open", [bundle], { detached: true, stdio: "ignore", env }).unref();
    else spawn(own, args, { detached: true, stdio: "ignore", env, windowsHide: false }).unref();
  } else if (process.platform === "darwin") {
    const app = ["/Applications/Dinoctor.app", path.join(os.homedir(), "Applications", "Dinoctor.app")].find(existsSync);
    if (!app) throw new Error("Dinoctor isn't installed in Applications. Download it from dinoctor.com.");
    spawn("open", [app], { detached: true, stdio: "ignore" }).unref();
  } else if (process.platform === "win32") {
    const exe = [path.join(process.env.LOCALAPPDATA || "", "Programs", "Dinoctor", "Dinoctor.exe"), path.join(process.env.ProgramFiles || "", "Dinoctor", "Dinoctor.exe")].find(existsSync);
    if (!exe) throw new Error("Dinoctor isn't installed. Download it from dinoctor.com or the Microsoft Store, then open it.");
    spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
  } else throw new Error("Open Dinoctor yourself, then try again.");
  for (let i = 0; i < 90; i++) {
    await sleep(1000);
    if ((await engineUp()).page) return { opened: true, ready: true };
  }
  throw new Error("Dinoctor is starting but its window isn't ready yet. Wait a little and call status.");
};
