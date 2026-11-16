#!/usr/bin/env node
// Dinoctor's MCP server: lets an AI app on this computer (Claude Desktop, Claude Code, Cursor...) direct videos in
// the open Dinoctor app. It speaks MCP over stdio. Tools are in ./tools; most run inside the Dinoctor window.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CORE } from "./tools/core.mjs";
import { EDIT } from "./tools/edit.mjs";
import { SEE } from "./tools/see.mjs";
import { MEDIA } from "./tools/media.mjs";
import { STYLES } from "./tools/styles.mjs";

export const TOOLS = [...CORE, ...EDIT, ...SEE, ...MEDIA, ...STYLES];

const server = new McpServer(
  { name: "dinoctor", version: "0.1.1" },
  {
    instructions:
      "Dinoctor is a video app where you direct animated videos: a project has scenes, a scene has shots, and a shot has a place, a cast of characters and objects, actions, text, a camera move, lighting and a transition. Start with open_dinoctor, then get_project. Use library to see what each style offers before choosing ids. After changes, use look to see the shot and fix what's wrong. Tools that spend the person's credits return a price first and need confirm: true; always ask the person before confirming.",
  },
);

// Each tool has a name, description, zod input schema, annotations (hints, see tools/hints.mjs) and run.
// A tool returns either a ready MCP result ({ content: [...] }) or any value, sent as JSON text.
for (const t of TOOLS) {
  server.registerTool(t.name, { description: t.description, inputSchema: t.schema, annotations: t.annotations }, async (args) => {
    try {
      const out = await t.run(args ?? {});
      if (out && Array.isArray(out.content)) return out;
      return { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out ?? null, null, 1) }] };
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] };
    }
  });
}

await server.connect(new StdioServerTransport());
// The AI app closed its end: stop, so no server is left running (a tool may keep a timer going).
process.stdin.on("end", () => process.exit(0));
