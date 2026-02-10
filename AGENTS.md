# Shards — Agent Context

Shards is a fork of [Craft Agents](https://github.com/lukilabs/craft-agents-oss) extended into an **agentic, minimal note-taking and second brain tool**. It adds a tiptap v3 markdown editor, file tree sidebar, and note-taking-first workflow on top of Craft Agents' existing agent infrastructure.

---

## Documentation Map

| Document | What it covers |
|----------|---------------|
| `PRD.md` | Product requirements, user stories, features, phases, non-goals |
| `CORE_SPECS.md` | **Shards infrastructure** — file I/O service, IPC extensions, editor state, theming bridge, frontmatter handling |
| `EDITOR_SPECS.md` | **Editor & UI** — tiptap v3 extensions, toolbar assembly, BubbleMenu, markdown I/O, file tree, status bar |
| `AGENT_SPECS.md` | **Agent extensions** — agent→editor sync, "send current file", session integration with editor |
| `TECHNICAL_DESIGN.md` | **Design overview** — what we build vs. inherit, tiptap integration, dependency summary |

**Sub-package docs (inherited from Craft Agents):**
| Document | What it covers |
|----------|---------------|
| `apps/electron/AGENTS.md` | Electron app architecture, IPC patterns, renderer patterns, security |
| `packages/shared/AGENTS.md` | Core business logic — CraftAgent, permissions, sessions, MCP, skills, statuses |
| `packages/core/CLAUDE.md` | Shared types — workspace, session, message types |

**Always check the relevant spec before implementing.** The Shards specs are the source of truth for editor/note-taking features. The Craft Agents sub-package docs are the source of truth for agent infrastructure.

---

## What This Is

A **fork and extension of Craft Agents** that adds:

1. **tiptap v3 WYSIWYG markdown editor** as the primary workspace panel
2. **File tree sidebar** for browsing/managing `.md` files in a workspace folder
3. **Agent → editor sync** so the agent can edit the file you're working on and you see changes live
4. **Note-taking workflow** — editor-first, agent-assisted (vs. Craft Agents' chat-first approach)

Everything else — agent chat, session management, MCP sources, skills, permissions, theming, credential management — is **inherited from Craft Agents** and should not be re-implemented.

---

## Architecture Overview

Shards follows Craft Agents' monorepo structure. New code lives primarily in `apps/electron/`:

```
shards/
├── apps/
│   └── electron/                      # Desktop GUI (extended from Craft Agents)
│       └── src/
│           ├── main/
│           │   ├── index.ts           # App lifecycle (extended)
│           │   ├── ipc.ts             # IPC handlers (extended with file channels)
│           │   ├── sessions.ts        # SessionManager (inherited)
│           │   └── services/
│           │       └── files.ts       # NEW: File I/O, frontmatter, file watching
│           │
│           ├── preload/
│           │   └── index.ts           # Context bridge (extended with file + editor APIs)
│           │
│           └── renderer/
│               └── src/
│                   ├── components/
│                   │   ├── tiptap/    # NEW: tiptap UI components (scaffolded, SCSS)
│                   │   ├── editor/    # NEW: Editor.tsx, EditorToolbar.tsx, extensions.ts
│                   │   ├── filetree/  # NEW: FileTree.tsx, FileNode.tsx
│                   │   ├── chat/      # Inherited: Chat interface
│                   │   ├── app-shell/ # Extended: Layout with editor panel
│                   │   └── ui/        # Inherited: shadcn/ui components
│                   ├── atoms/
│                   │   ├── editor.ts  # NEW: currentFilePath, isDirty, frontmatter
│                   │   └── ...        # Inherited Craft Agents atoms
│                   └── styles/
│                       └── ...        # Extended with --shards-* CSS tokens
│
├── packages/
│   ├── core/                          # @craft-agent/core (inherited, unmodified)
│   └── shared/                        # @craft-agent/shared (inherited, unmodified)
│
├── PRD.md
├── CORE_SPECS.md
├── EDITOR_SPECS.md
├── AGENT_SPECS.md
└── TECHNICAL_DESIGN.md
```

---

## Tech Stack

### Inherited from Craft Agents

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| AI | @anthropic-ai/claude-agent-sdk |
| Desktop | Electron + React 18 |
| UI | shadcn/ui + Tailwind CSS v4 |
| Build | esbuild (main/preload) + Vite (renderer) |
| State | Jotai |
| Language | TypeScript (strict) |

### Added by Shards

| Layer | Technology |
|-------|-----------|
| Editor | tiptap v3 + @tiptap/markdown + CodeBlockLowlight + 10 free extensions |
| Editor UI | tiptap UI Components (Simple Editor template, scaffolded via CLI) |
| Editor styling | tiptap SCSS + shared CSS custom properties (`--shards-*`) |
| Frontmatter | gray-matter (strip before tiptap, re-prepend on save) |

---

## IPC Bridge Extensions

Shards adds these IPC channels on top of Craft Agents' existing channels:

**File channels (new):**
`file:open`, `file:save`, `file:list`, `file:create`, `file:delete`, `file:rename`, `file:changed` (event), `file:tree-changed` (event)

**Existing Craft Agents channels** (sessions, config, etc.) remain unchanged.

Full IPC specification in `CORE_SPECS.md`.

---

## Key Patterns

### Editor (see EDITOR_SPECS.md)
- Extension stack: StarterKit + Markdown + CodeBlockLowlight + TaskList + Highlight + TableKit + Typography + Placeholder + CharacterCount
- Toolbar assembled from tiptap's free UI components, not built from scratch
- BubbleMenu for inline formatting on text selection
- Markdown I/O via `editor.getMarkdown()` / `setContent(md, {contentType: 'markdown'})`
- Frontmatter stripped at I/O layer via gray-matter, stored in Jotai atom

### Agent → Editor Sync (see AGENT_SPECS.md)
- Agent uses standard `Write`/`Edit` tools to modify files on disk
- Main process watches the currently open file with `fs.watch`
- On external change: reload file content into tiptap
- Auto-save editor before agent query to avoid conflicts

### State (Jotai)
New atoms for editor state:
- `atoms/editor.ts` — currentFilePath, isDirty, frontmatter, windowTitle (derived)

Existing Craft Agents atoms remain for sessions, navigation, workspace, etc.

---

## Development Commands

```bash
bun install                    # Install dependencies
bun run electron:dev           # Hot reload development
bun run electron:start         # Build and run
bun run typecheck:all          # Type check all packages
bun run lint                   # Lint all packages
bun run lint:fix               # Auto-fix lint issues
```

---

## Code Style

Inherits all Craft Agents code style rules, plus:

- **tiptap components use SCSS.** App components use Tailwind. Both reference `--shards-*` CSS tokens.
- **Editor components** live in `components/editor/` and `components/tiptap/` — keep them separate from chat components.
- **File I/O logic** lives in `services/files.ts` — not in IPC handlers or components.
- Prefer editing existing Craft Agents files over creating new ones where possible.
- Follow Craft Agents' ESLint rules (no localStorage, no hardcoded paths, no direct platform checks, use navigate()).

---

## Constraints

- One file open at a time in the editor (no tabs)
- Agent chat uses Craft Agents' existing multi-session system (unchanged)
- Only `.md` files shown in the file tree
- No plugin system, no extension marketplace (beyond Craft Agents' skills/sources)
- macOS-first (Windows/Linux secondary)
- Plain `.md` files on disk — no proprietary format, no database

---

## Data Storage

### Inherited from Craft Agents
- **Config:** `~/.craft-agent/config.json`
- **Credentials:** `~/.craft-agent/credentials.enc` (AES-256-GCM)
- **Sessions:** `~/.craft-agent/workspaces/{id}/sessions/*.jsonl`
- **Sources, Skills, Statuses:** `~/.craft-agent/workspaces/{id}/...`

### Added by Shards
- **Notes:** Plain `.md` files in the user's workspace folder (wherever they point it)
- **Editor config:** Stored in Craft Agents' existing config system (font size, theme, workspace path)
