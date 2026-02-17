---
type: entrypoint
scope: product
children:
  - product-design.md
  - product-agent.md
updated: 2026-02-12
---

# Shards — Product

Shards is a fork of [Craft Agents](https://github.com/lukilabs/craft-agents-oss) extended into an **agentic, minimal note-taking and second brain tool**. It adds a tiptap v3 markdown editor, file tree sidebar, and note-taking-first workflow on top of Craft Agents' existing agent infrastructure.

**One-liner:** Craft Agents + a real markdown editor = an AI-powered second brain.

---

## Design Principles

1. **Editor-first, agent-assisted.** The markdown editor is the primary panel. Chat is a sidebar.
2. **Built on Craft Agents.** Don't re-implement what exists. Extend it.
3. **Local-first.** Plain `.md` files on disk. No proprietary format, no database, no sync.
4. **Minimal and opinionated.** Fewer settings, better defaults.
5. **Second brain, not just a chat.** Help users think, write, and organize.

## Target User

Solo knowledge worker / technical writer / indie developer who takes notes in markdown daily and wants AI assistance in the same window.

## What Shards Inherits (don't re-implement)

Multi-session agent chat, Claude Agent SDK streaming, MCP server integration, REST API sources, permission modes, skills system, status system, theme system (extended with `--shards-*` tokens), credential management, session persistence, deep linking, file attachments, responsive layout.

## What Shards Adds

| Feature | Priority | Details in |
|---------|----------|------------|
| **Markdown Editor** (tiptap v3 WYSIWYG) | P0 | [product-design.md — Editor UX](product-design.md) |
| **File Tree Sidebar** | P0 | [product-design.md — Middle Panel](product-design.md) |
| **Three UI Modes** (Chat Only / Note+Chat / Note Only) | P0 | [product-design.md — Right Panel](product-design.md) |
| **Agent -> Editor Sync** (live reload on agent edits) | P1 | [product-design.md — Agent Sync UX](product-design.md) |
| **Auto-Tagging** (current note auto-referenced in Note+Chat) | P1 | [product-design.md — Note+Chat View](product-design.md) |
| **Editor Theming** (`--shards-*` CSS bridge) | P1 | Tech concern — see [tech-infrastructure.md](tech-infrastructure.md) |

## Implementation Phases

| Phase | Goal | Exit criteria |
|-------|------|---------------|
| **1: Editor Shell** | tiptap working in Electron with toolbar, theming, layout | Editor renders, dark/light mode works |
| **2: File System** | Open folder, browse/edit/save `.md` files, frontmatter preserved | Full file I/O with auto-save, workspace folder setup |
| **3: Agent <-> Editor** | Agent edits appear live, "send current file" works | Live reload on agent Write/Edit, file creation visible |
| **4: Polish** | Keyboard shortcuts, settings, error handling, performance | Daily-driver quality |

## Non-Goals

- Full IDE or code editor
- Collaborative editing
- Cloud sync (use git/iCloud/Dropbox externally)
- Plugin marketplace beyond Craft Agents' skills/sources
- Mobile app
- Obsidian-style graph view, backlinks, 500 plugins

## Product Decisions

1. **Auto-save: VS Code style.** Debounce ~1.5s after last edit + save on blur/switch/focus-loss. `Cmd+S` works but is rarely needed. No save dialogs — ever.
2. **Agent creates/edits notes only when a note is open** in Note+Chat mode. Agent should ask before creating new notes.
3. **Single note open at a time.** Not in MVP. Design should allow future expansion.
4. **Workspace = notes folder.** Uses Craft Agents' existing workspace creation: "Choose a location" opens an existing folder (which becomes the workspace and notes live there), "Default location" creates under `~/.craft-agent/workspaces/`. No separate notes folder setting — the workspace root IS the notes folder. Agent cwd and working directory auto-set to workspace rootPath.
5. **Editor = tiptap defaults.** Use tiptap's out-of-the-box template. Don't custom-build editor features — use what tiptap provides.

## Branch Documents

| Document | Covers |
|----------|--------|
| **[product-design.md](product-design.md)** | All UX: workspace setup, layout, modes, navigation, file tree, new note flow, editor, auto-save, keyboard shortcuts, agent sync, settings |
| **[product-agent.md](product-agent.md)** | Agent context (CLAUDE.md auto-loading), skills/MCP auto-detection, @ mentions, file references, agent's role in notes workflow |
