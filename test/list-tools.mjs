// Starts the server and lists its tools. Works without the Dinoctor app: then calls answer that it isn't open.
// Usage: node test/list-tools.mjs ['tool::{"arg":1}' ...]
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";

const server = fileURLToPath(new URL("../src/server.mjs", import.meta.url));
const client = new Client({ name: "dinoctor-mcp-test", version: "1" });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [server], env: process.env }));
const { tools } = await client.listTools();
console.log(`${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);
if (tools.length < 45) throw new Error("Expected about 55 tools.");
for (const call of process.argv.slice(2)) {
  const [name, json] = call.split("::");
  const r = await client.callTool({ name, arguments: json ? JSON.parse(json) : {} });
  console.log(`== ${name}${r.isError ? " (error)" : ""}:`, r.content.map((c) => (c.type === "text" ? c.text.slice(0, 600) : `[${c.type}]`)).join("\n"));
}
await client.close();
