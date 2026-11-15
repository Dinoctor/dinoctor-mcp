# Runs the Dinoctor MCP server over stdio. Inside a container the Dinoctor app isn't there, so tools/list works
# and tool calls answer that Dinoctor isn't open. For real use, run it on the computer where Dinoctor is installed.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
ENTRYPOINT ["node", "src/server.mjs"]
