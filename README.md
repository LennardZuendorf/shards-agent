# Shards

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)

**An agentic, minimal note-taking and second brain tool.**

Shards is a fork of [Craft Agents](https://github.com/lukilabs/craft-agents-oss) that extends the agent-native desktop experience with a built-in tiptap v3 markdown editor, file tree sidebar, and a note-taking-first workflow. Write markdown, organize your notes, and let Claude help you think — all in one window.

> Think of it as: **Craft Agents + a real editor = an AI-powered second brain.**

---

## Why Shards?

Craft Agents is great for agent-centric workflows — multi-session inbox, MCP integrations, skills, and a beautiful chat UI. But it has no editor. You chat with the agent, and it works on files externally.

Shards fills that gap:

- **Editor-first, agent-assisted.** A tiptap v3 WYSIWYG markdown editor is the main panel. The agent chat sidebar assists your writing.
- **Local-first notes.** Plain `.md` files on disk. No proprietary format, no database, no sync.
- **Second brain.** Unlike a generic agent chat, Shards is purpose-built for note-taking, writing, and knowledge management — with AI as a thinking partner.
- **Everything Craft Agents has.** Session management, MCP sources, skills, permissions, theming — all inherited from the upstream fork.

---

## What Shards Adds to Craft Agents

| Feature | Craft Agents | Shards |
|---------|-------------|--------|
| Agent chat | Multi-session inbox | Multi-session inbox (inherited) |
| Editor | None | tiptap v3 WYSIWYG markdown editor |
| File management | File attachments only | Full file tree sidebar (`.md` files) |
| Workflow | Chat-first, document-centric | Editor-first, agent-assisted |
| File format | Session JSONL | Plain `.md` files on disk + session JSONL |
| Agent→file sync | N/A | Agent edits files, editor reflects changes live |
| Frontmatter | N/A | YAML frontmatter preserved (stripped from editor, re-prepended on save) |

---

## Features

### Inherited from Craft Agents
- **Multi-Session Inbox**: Session management, status workflow, and flagging
- **Claude Agent SDK**: Streaming responses, tool visualization, real-time updates
- **Sources**: Connect to MCP servers, REST APIs, local filesystems
- **Permission Modes**: Three-level system (Explore, Ask to Edit, Auto)
- **Skills**: Specialized agent instructions per-workspace
- **Theme System**: Cascading themes at app and workspace levels
- **File Attachments**: Drag-drop images, PDFs, Office documents

### New in Shards
- **Markdown Editor**: tiptap v3 WYSIWYG editor with full GFM support (headings, bold, italic, code blocks, tables, task lists, highlights)
- **File Tree Sidebar**: Browse and manage `.md` files in your workspace folder
- **BubbleMenu**: Floating inline formatting toolbar on text selection
- **Syntax Highlighting**: Code blocks with language detection via lowlight/highlight.js
- **Frontmatter Support**: YAML frontmatter preserved transparently (via gray-matter)
- **Agent → Editor Sync**: Agent edits files on disk, editor reloads live
- **Word/Character Count**: Status bar with live counts via tiptap CharacterCount
- **Smart Typography**: Auto-replace quotes, dashes, arrows, fractions

---

## Installation

### Build from Source

```bash
git clone https://github.com/yourusername/shards.git
cd shards
bun install
bun run electron:start
```

### Development

```bash
bun run electron:dev              # Hot reload development
bun run electron:start            # Build and run
bun run typecheck:all             # Type check all packages
bun run lint                      # Lint all packages
bun run lint:fix                  # Auto-fix lint issues
```

---

## Architecture

Shards extends Craft Agents' monorepo structure with editor components:

```
shards/
├── apps/
│   └── electron/                  # Desktop GUI (extended)
│       └── src/
│           ├── main/              # Electron main process
│           │   └── services/
│           │       └── files.ts   # NEW: File I/O, frontmatter, file watching
│           ├── preload/           # Context bridge (extended)
│           └── renderer/          # React UI (extended)
│               └── src/
│                   ├── components/
│                   │   ├── tiptap/     # NEW: tiptap UI components (SCSS)
│                   │   ├── editor/     # NEW: Editor.tsx, EditorToolbar.tsx
│                   │   ├── filetree/   # NEW: FileTree.tsx, FileNode.tsx
│                   │   └── ...         # Existing Craft Agents components
│                   └── atoms/
│                       └── editor.ts   # NEW: Editor state atoms
└── packages/
    ├── core/                      # @craft-agent/core (inherited)
    └── shared/                    # @craft-agent/shared (inherited)
```

---

## Documentation

| Document | What it covers |
|----------|---------------|
| `PRD.md` | Product requirements, user stories, features, phases |
| `CORE_SPECS.md` | Infrastructure — file I/O service, IPC extensions, editor state, theming bridge |
| `EDITOR_SPECS.md` | Editor & UI — tiptap v3 extensions, toolbar, BubbleMenu, markdown I/O, file tree |
| `AGENT_SPECS.md` | Agent extensions — agent→editor sync, "send current file", session integration |
| `TECHNICAL_DESIGN.md` | Technical design — what we build vs. what we inherit, dependency summary |

---

## Tech Stack

Everything from Craft Agents, plus:

| Layer | Technology |
|-------|------------|
| Editor | tiptap v3 + @tiptap/markdown + CodeBlockLowlight |
| Editor UI | tiptap UI Components (Simple Editor template, SCSS) |
| Frontmatter | gray-matter |
| Editor styling | tiptap SCSS + shared CSS custom properties (`--shards-*`) |

See the upstream [Craft Agents README](https://github.com/lukilabs/craft-agents-oss) for the full base tech stack.

---

## Credits

Shards is built on top of [Craft Agents](https://github.com/lukilabs/craft-agents-oss) by [Luki Labs / Craft Docs](https://craft.do). The agent infrastructure, session management, MCP integration, permissions system, and UI foundation are all inherited from Craft Agents.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

### Third-Party Licenses

- [Craft Agents](https://github.com/lukilabs/craft-agents-oss) — Apache 2.0
- [Claude Agent SDK](https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk) — subject to [Anthropic's Commercial Terms of Service](https://www.anthropic.com/legal/commercial-terms)

### Trademark

"Craft" and "Craft Agents" are trademarks of Craft Docs Ltd. See [TRADEMARK.md](TRADEMARK.md) for usage guidelines.
