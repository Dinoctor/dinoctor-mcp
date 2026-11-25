#!/usr/bin/env node
// Dinoctor's MCP server: lets an AI app on this computer (Claude Desktop, Claude Code, Cursor...) direct videos in
// the open Dinoctor app. It speaks MCP over stdio. Tools are in ./tools; most run inside the Dinoctor window.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ALIAS_TOOLS, TOOLS } from "./tools/index.mjs";

export { TOOLS };

const server = new McpServer(
  { name: "dinoctor", version: "0.2.0" },
  {
    instructions:
      "Dinoctor is a video app where you direct animated videos: a project has scenes, a scene has shots, and a shot has a place, a cast of characters and objects, actions, text, a camera move, lighting and a transition. Before making or changing a video, read directing_guide: it is how Dinoctor's editor directs, and Dinoctor videos follow it unless the person asks otherwise. Start with open_dinoctor, then get_project. Use library to see what each style offers before choosing ids. Name a shot with shot_id, or scene and shot indexes (left out: the shot on screen). After changes, use look_at_shot to see the shot and fix what's wrong. Tools that spend the person's credits return a price first and need confirm: true; always ask the person before confirming.",
  },
);

// Each tool has a name, description, zod input schema, annotations (hints, see tools/hints.mjs) and run, and the read
// tools a loose output shape. A tool returns either a ready MCP result ({ content: [...] }) or any value, sent as JSON
// text. Unknown arguments are kept (not dropped), so older argument names (like id or shotId for a shot) still work.
// Old tool names are registered too, but hidden from the list (tools/index.mjs).
for (const t of [...TOOLS, ...ALIAS_TOOLS]) {
  const config = { description: t.description, inputSchema: z.looseObject(t.schema), annotations: t.annotations, ...(t.output ? { outputSchema: z.looseObject(t.output) } : {}) };
  server.registerTool(t.name, config, async (args) => {
    try {
      const out = await t.run(args ?? {});
      if (out && Array.isArray(out.content)) return out;
      const text = { content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out ?? null, null, 1) }] };
      return t.output && out && typeof out === "object" && !Array.isArray(out) ? { ...text, structuredContent: out } : text;
    } catch (e) {
      return { isError: true, content: [{ type: "text", text: e instanceof Error ? e.message : String(e) }] };
    }
  });
}

// The old names answer tools/call but aren't listed. The SDK has no switch for that, so its list answer is filtered.
// If a future SDK keeps its handlers elsewhere, the old names simply show in the list too (they still work).
const hidden = new Set(ALIAS_TOOLS.map((t) => t.name));
const handlers = server.server._requestHandlers;
const list = handlers instanceof Map ? handlers.get("tools/list") : undefined;
if (list) {
  handlers.set("tools/list", async (request, extra) => {
    const answer = await list(request, extra);
    return { ...answer, tools: answer.tools.filter((t) => !hidden.has(t.name)) };
  });
}

await server.connect(new StdioServerTransport());
// The AI app closed its end: stop, so no server is left running (a tool may keep a timer going).
process.stdin.on("end", () => process.exit(0));
