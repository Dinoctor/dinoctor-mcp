# Next tool changes (for the next app update)

Version 0.1.1 only improved descriptions, input descriptions and annotations. Glama's tool-quality score (TDQS)
also marks us down for **too many tools (69)** and **look-alike names**. Fixing that changes the tool API, so it
has to ship together with a Dinoctor app update (the app has the same server built in) and a minor npm version.

## Proposal

1. **Merge look-alike tools** (69 → about 45):
   - `generate_picture` + `generate_character` + `generate_place` → `generate_picture` (kind, put).
   - `draw_character` + `draw_object` + `draw_place` → `draw` (kind).
   - `make_style` + `fix_style` + `continue_style` + `cancel_style` + `style_status` → `style_job`
     (action: build, fix, continue, cancel, status). Keep `my_styles`, `use_style`, `rate_style`, `delete_style`.
   - `render` + `render_status` + `cancel_render` → `render` (action: start, status, cancel).
   - `picture_status` folds into `generate_picture` (action: status, stop).
   - `voices` + `speak` + `own_voice` + `get_script` + `assign_line` stay, but `get_script` could become
     `script` (action: get, write, assign) with `write_script`.
2. **Consistent names**: verb_noun everywhere (`get_project`, `get_shot`, `set_format`, `set_style`...). Rename the
   short ones: `cast` → `set_cast`, `act` → `direct_cast`, `words` → `set_text`, `place` → `set_place`,
   `light` → `set_light`, `camera` → `set_camera`, `keys` → `set_keyframes`, `look` → `look_at_shot`.
3. **One way to address a shot**: today some tools take `shot` (an id), others `id`, `shotId`, or `scene` + `shot`
   indexes. Use `shot_id` (or `scene` + `shot`) in every tool.
4. **Output schemas** for the read tools (`get_project`, `get_shot`, `status`, `library`), so AI apps know the shape.

## How to ship it

- Change the page handlers (`src/picker/agent/*.ts`) and the MCP tools together in the app repo; keep the old names
  working for one version as hidden aliases if possible, so saved prompts and the directing skill don't break.
- Update `skills/dinoctor-director/SKILL.md`, the README tool list and the website's /claude page.
- Publish npm 0.2.0, update `server.json`, run `mcp-publisher publish`, and rebuild on Glama.
