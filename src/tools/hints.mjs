// MCP tool annotations: hints for the AI app about what a tool does to the world. They change no behavior.
// Every change Claude makes to the project is one undo step for the person, so edits are not "destructive";
// tools that remove things for good, or replace work, are.

const hint = (readOnlyHint, destructiveHint, idempotentHint, openWorldHint) => ({ readOnlyHint, destructiveHint, idempotentHint, openWorldHint });

export const READ = hint(true, false, true, false); // only reads the project or the app
export const CHANGE = hint(false, false, false, false); // changes the project, undoable
export const SET = hint(false, false, true, false); // sets a value, undoable; the same call twice gives the same result
export const REPLACE = hint(false, true, false, false); // replaces or deletes work (asks for confirm first)
export const PAID = hint(false, false, false, true); // reaches an outside paid service (asks for confirm first)
export const LOCAL = hint(false, false, false, false); // acts on the app or files on this computer
