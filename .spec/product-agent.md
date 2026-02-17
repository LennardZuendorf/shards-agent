---
type: branch
parent: product.md
scope: product-agent
covers: agent context, system prompt, workspace as notes folder, auto-attached local source, skills discovery, MCP auto-detection, @ mentions, file references, agent role in note-taking workflow
updated: 2026-02-12
---

# Agent UX Specs

How the agent works within Shards — workspace context, skills/MCP discovery, file referencing, and the agent's role in the note-taking workflow.

**Parent:** [product.md](product.md)

**Tech implementation:** For agent SDK integration and file sync, see [tech-agents.md](tech-agents.md).

**Existing infrastructure:** Craft Agents already provides workspace creation, skills system, MCP/sources system, local sources, chat input with mentions, and Claude Agent SDK integration. This spec covers what Shards adds or changes.

---

## What Craft Agents Already Provides

Before speccing what's new, here's what we inherit and don't re-implement:

| Feature | Status | Details |
|---------|--------|---------|
| Workspace creation (default location or open folder) | Exists | WorkspaceCreationScreen, two paths |
| Working directory per workspace (`config.defaults.workingDirectory`) | Exists | Set in workspace config, passed to agent |
| Local source type (attach folder for agent context) | Exists | Source type `local`, gives agent browse/read tools |
| Skills discovery (global `~/.claude/skills`, `~/.agents/skills`) | Exists | `scanGlobalSkills()` |
| Skills discovery (local working directory) | Exists | `scanLocalSkills()` scans cwd |
| Workspace skills (per-workspace, symlinked imports) | Exists | Stored in workspace rootPath |
| MCP/API sources (per-workspace config) | Exists | Config stored in workspace sources dir |
| Chat mention syntax (`[skill:slug]`, `[source:slug]`, `[file:path]`, `[folder:path]`) | Exists | Parsed by lib/mentions.ts |
| Inline mention badges in chat input | Exists | RichTextInput with avatar badges |
| Permission modes (safe/ask/allow-all) | Exists | ModeManager |
| Claude Agent SDK streaming | Exists | ClaudeAgent wraps SDK `query()` |

---

## Workspace = Notes Folder

Shards uses Craft Agents' existing workspace creation flow — no separate "notes folder" setting.

### How Workspaces Map to Notes

**"Choose a location"** (open existing folder):
- User picks an existing folder (e.g., `~/Notes`, `~/Projects/my-blog`)
- That folder becomes the workspace root
- If it already has `.md` files, they appear in the file tree immediately
- If it has `.claude/` or `.agents/` dirs, skills and MCP configs are auto-detected
- Workspace config (config.json, sessions/, sources/) is created inside the folder

**"Default location"** (new workspace):
- Creates under `~/.craft-agent/workspaces/{slug}/`
- Notes are created here alongside workspace config
- Good for users who just want a new notes space without an existing folder

### What Shards Auto-Configures

When a workspace is created or opened, Shards automatically:

1. **Sets `config.defaults.workingDirectory`** to the workspace rootPath — so the agent's cwd is always the notes folder
2. **Auto-attaches the workspace folder as a local source** — so the agent understands it's in a folder full of notes and can browse/read/search files (uses Craft Agents' existing `local` source type)
3. **Passes the workspace folder to `loadAllSkills()`** as `workingDirectory` — so skills in `.claude/skills/` are auto-detected

### Agent Awareness

The auto-attached local source means the agent always knows:
- What files exist in the workspace
- That it's working in a notes/markdown context
- How to find and read any file the user references

This is the same as Craft Agents' existing "attach folder" functionality, just hardcoded to the workspace root.

---

## Auto-Context: CLAUDE.md / AGENTS.md

The agent should automatically have project context when working within a workspace.

### Behavior

- On session start, check the workspace root for `CLAUDE.md` or `AGENTS.md`
- If found, prepend its contents to the agent's system prompt
- If both exist, use `CLAUDE.md` (same precedence as Claude Code)
- File is re-read on each session start (not cached across sessions)
- No UI indication needed — this is invisible to the user, just like Claude Code

### What This Enables

A user who already uses Claude Code has a `CLAUDE.md` in their project. When they open that folder as their Shards workspace, the agent automatically understands the project context without any setup.

### Not In Scope

- Global CLAUDE.md from `~/.claude/` — if users want global instructions, they import them as a skill (existing functionality)
- Editing CLAUDE.md from within Shards — it's a regular `.md` file, they can open and edit it in the editor

---

## Skills & MCP Auto-Detection

Users may have set up skills and MCP servers in the same folder they're now using as a Shards workspace (e.g., via Claude Code). Shards should detect and surface these.

### Skills Auto-Detection

Already works via Craft Agents' `scanLocalSkills()` which scans the working directory. Since Shards sets workingDirectory = workspace rootPath, skills in `.claude/skills/` or `.agents/skills/` within the workspace are auto-detected.

**No new work needed** — just ensure the workspace folder is passed as `workingDirectory` to the existing `loadAllSkills()` call.

### MCP Auto-Detection (NEW)

Workspace folders may contain MCP server configurations (e.g., `.claude/mcp.json` from Claude Code). Shards should:

1. On workspace open, scan for `.claude/mcp.json` (Claude Code format) and `.agents/mcp.json`
2. Parse the MCP server configs
3. Surface them in the Sources panel alongside manually configured sources
4. Auto-detected sources shown with a badge ("Local") to distinguish from workspace-configured ones
5. Auto-detected sources are **enabled by default** but can be disabled by the user

### Sources Panel (existing, minor extension)

The existing Sources panel in the left sidebar shows all available sources. The only change: auto-detected local MCP servers appear here with a "Local" badge. No new UI needed beyond the badge.

---

## @ Mentions in Chat Input

The chat input supports referencing files, skills, and MCP sources via the `@` key. This builds on Craft Agents' existing mention system.

### How It Works

1. User types `@` in the chat input
2. A dropdown menu appears with sections:
   - **Skills** — all available skills (global + workspace + local)
   - **Sources** — all available MCP/API sources
   - **Files** — type to search for a file path in the workspace
3. User selects an item or keeps typing to filter
4. Selected item appears as an inline badge in the input

### @ Menu Sections

```
┌─────────────────────────────────┐
│ @ Skills                        │
│   code-review                   │
│   commit                        │
│   spec                          │
├─────────────────────────────────┤
│ @ Sources                       │
│   github (MCP)                  │
│   notion (MCP)                  │
├─────────────────────────────────┤
│ @ Files — type to search...     │
│   CLAUDE.md                     │
│   src/components/Editor.tsx     │
│   notes/todo.md                 │
└─────────────────────────────────┘
```

### File References

- `@` + typing a path searches the workspace folder for matching files
- Fuzzy match on file names and paths
- Selecting a file inserts a **reference** (not the file content) — the agent gets the file path and reads it itself if needed
- Multiple files can be referenced in a single message
- Files show as inline badges with a file icon

### What Already Exists

Craft Agents already has `[file:path]`, `[skill:slug]`, and `[source:slug]` mention parsing and badge rendering. The `@` trigger and dropdown menu UI is the new part — the underlying mention system is reused.

---

## Agent's Role in Notes Workflow

### What the Agent Can Do

The agent operates within the workspace folder and has access to standard Claude tools:

| Tool | What it does in Shards context |
|------|-------------------------------|
| **Read** | Read any file in the workspace |
| **Write** | Create or overwrite files in the workspace |
| **Edit** | Edit files in the workspace |
| **Glob** | Search for files by pattern |
| **Grep** | Search file contents |
| **Bash** | Run commands (subject to permission mode) |

Plus, via the auto-attached local source, the agent can browse the file tree and understands the workspace structure.

The agent can read/write any file in the workspace — not just the currently open note. This is intentional: the agent should be able to help organize, refactor, and work across multiple files.

### Privacy: Explicit Sharing

- The agent does **not** auto-read the currently open note
- User must explicitly share context via:
  - **Note+Chat mode** — the current note is auto-tagged as a `[file:path]` reference on message send (see product-design.md — Note+Chat View)
  - `@` file reference in chat input (agent reads it when needed)
  - Pasting content into the message
- This is a deliberate privacy boundary — notes are private until shared

### Agent Edits and the Editor

When the agent writes or edits files, the existing Agent Sync UX (see product-design.md — Agent Sync UX) handles editor updates via `fs.watch`. No additional spec needed here.

### Note+Chat Mode

In Note+Chat mode:
- The chat input bar is at the bottom of the editor
- User types a message and hits Send
- Auto-save fires before the message is sent
- The current note is **automatically referenced** as a `[file:path]` mention — no manual "Send Current File" step needed
- The agent processes the message and responds
- "Show chat history" link switches to Chat tab to see full conversation
- If the agent edits the currently open file, the editor reloads silently

---

## UX Decisions

1. **Workspace = notes folder** → Uses existing workspace creation flow. "Choose a location" opens an existing folder, "Default location" creates under `.craft-agent/`. No separate notes folder setting.
2. **Auto-attached local source** → Workspace folder is automatically attached as a local source so the agent can browse/read files.
3. **Working directory** → Auto-set to workspace rootPath. Agent cwd always = notes folder.
4. **CLAUDE.md loading** → Automatic, invisible, from workspace root only. Re-read on each session start.
5. **Skills auto-detection** → Already works via existing `scanLocalSkills()`. No new work.
6. **MCP auto-detection** → Scan `.claude/mcp.json` from workspace folder. Show as "Local" sources.
7. **@ mentions** → Trigger dropdown with Skills / Sources / Files sections. File references are paths only (agent reads if needed).
8. **Agent file access** → Full workspace access. Not limited to the open note.
9. **Privacy** → Agent never auto-reads notes. Explicit sharing required.
