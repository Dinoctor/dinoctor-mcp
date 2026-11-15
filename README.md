# Dinoctor MCP server

Let Claude, Cursor or any [MCP](https://modelcontextprotocol.io) app direct animated videos in [Dinoctor](https://dinoctor.com), a free desktop video app for Mac and Windows.

You ask in plain words ("make a 30 second video about a dino who loses his sunglasses"), and the AI builds it in the open Dinoctor window while you watch: script, scenes, shots, places, characters, actions, camera moves, lights, on-screen text, voice, music, and the final MP4.

This repo is the MCP server only (the remote control). The video app itself is a separate free download.

## What you need

1. **Dinoctor**, free: [dinoctor.com](https://dinoctor.com) or the [downloads page](https://github.com/Dinoctor/dinoctor-downloads).
2. **Node.js 18 or newer**, if you use `npx` below. (Or skip Node: the app has this same server built in, see [Without Node](#without-node).)

## Set it up

### Claude Desktop

Open Settings, Developer, Edit Config, and add:

```json
{
  "mcpServers": {
    "dinoctor": {
      "command": "npx",
      "args": ["-y", "dinoctor-mcp"]
    }
  }
}
```

Restart Claude Desktop.

### Claude Code (plugin: server plus a directing skill)

The plugin adds the server and a skill that teaches Claude how to direct a good video: plan a hook, pick ids from the style's library, act, move the camera, check every shot with `look`, and always ask before spending credits.

```
/plugin install dinoctor --marketplace Dinoctor/dinoctor-mcp
```

On older Claude Code: `/plugin marketplace add Dinoctor/dinoctor-mcp`, then `/plugin install dinoctor@dinoctor`.

Server only:

```bash
claude mcp add dinoctor --scope user -- npx -y dinoctor-mcp
```

### Cursor

[![Add to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=dinoctor&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyIteSIsImRpbm9jdG9yLW1jcCJdfQ==)

Or add to `~/.cursor/mcp.json` (or your project's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "dinoctor": {
      "command": "npx",
      "args": ["-y", "dinoctor-mcp"]
    }
  }
}
```

### Other MCP apps

Any app that runs stdio MCP servers works: the command is `npx -y dinoctor-mcp`.

### Without Node

The Dinoctor app is also the server: in Dinoctor open **Help, Connect to Claude or Cursor...** and click **Add to Claude Desktop**, or point your app at the app itself with the `--mcp` argument:

- Mac: `/Applications/Dinoctor.app/Contents/MacOS/Dinoctor --mcp`
- Windows: `%LOCALAPPDATA%\Programs\Dinoctor\Dinoctor.exe --mcp`

Use one way, not both, or your AI app will see every tool twice.

### The directing skill in other apps

The skill is a plain file: [skills/dinoctor-director/SKILL.md](skills/dinoctor-director/SKILL.md). In Claude Desktop or claude.ai, zip the `dinoctor-director` folder and upload it as a skill in Settings. In other apps, paste it into the project's rules or instructions.

## How it finds Dinoctor

The server talks to the Dinoctor app on your own computer only (127.0.0.1). It never sends anything to the internet by itself.

When the AI calls `open_dinoctor`, the server starts the app if it isn't open:

- Mac: `/Applications/Dinoctor.app` or `~/Applications/Dinoctor.app`
- Windows: `%LOCALAPPDATA%\Programs\Dinoctor\Dinoctor.exe` or `%ProgramFiles%\Dinoctor\Dinoctor.exe`
- Somewhere else (or the Microsoft Store version): set `DINOCTOR_APP` to the full path of the app.

| Setting | What it does |
| --- | --- |
| `DINOCTOR_APP` | Full path to the Dinoctor app, if it isn't in the usual place. |
| `DINOCTOR_PORT` | The port of a Dinoctor that is already open, if you changed it. Normally found by itself. |
| `DINOCTOR_HOME` | Dinoctor's data folder, if you moved it. |

Without the app, the server still starts and lists its tools; calls then answer that Dinoctor isn't open.

## What the AI can do

69 tools, in groups:

- **Start and read**: `open_dinoctor`, `status`, `get_project`, `get_shot`, `go_to`, `how_to`
- **Build the video**: `new_project`, `set_style`, `set_format`, `add_scene`, `add_shot`, `remove`, `move`, `duplicate`, `cut_shot`, `rename_scene`, `edit_project`
- **Direct a shot**: `cast`, `act`, `words`, `camera`, `light`, `place`, `keys`, `transition`
- **See it**: `list_styles`, `library`, `look` (a picture of any moment, so the AI checks its own work)
- **Script, voice and sound**: `write_script`, `get_script`, `assign_line`, `voices`, `speak`, `own_voice`, `music`, `sound_effects`
- **Pictures**: `generate_picture`, `generate_character`, `generate_place`, `picture_status`, `generated_pictures`, `put_picture`, `remove_background`, `relight`, `cutout`, `upload`, `generator_account`
- **Styles and starting points**: `my_styles`, `make_style`, `style_status`, `continue_style`, `fix_style`, `cancel_style`, `rate_style`, `delete_style`, `use_style`, `samples`, `fill_spot`, `templates`, `describe_drawing`, `draw_character`, `draw_object`, `draw_place`
- **Files and export**: `render`, `render_status`, `cancel_render`, `list_projects`, `open_project`, `save_project`

## Safe by design

- **Nothing paid happens without you.** Tools that would spend credits (AI pictures, ElevenLabs voices, Claude usage for building styles) first answer with the price. They only go ahead when called again with `confirm: true`, and the AI is told to ask you first.
- **Everything can be undone.** Each change the AI makes is one undo step in Dinoctor, with a note saying what it did.
- **Local only.** The server only talks to the Dinoctor app on your computer.

## Try it

Open your AI app and say:

> Open Dinoctor and make a 20 second pixel-style video: a dino walks into a desert, finds a cactus, and jumps for joy. Look at each shot and fix anything that looks off.

## Develop

```bash
npm install
npm test          # starts the server and lists its tools (works without the app)
node test/list-tools.mjs status get_project   # call tools against an open Dinoctor
```

## License

MIT. This license covers this MCP server only. The Dinoctor app is free to use but is not open source.
