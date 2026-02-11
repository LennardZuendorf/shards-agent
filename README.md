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
- **Multi-Session Inbox**: Desktop app with session management, status workflow, and flagging
- **Claude Code Experience**: Streaming responses, tool visualization, real-time updates
- **Multiple LLM Connections**: Add multiple AI providers and set per-workspace defaults
- **Codex / OpenAI Support**: Run Codex-backed sessions alongside Anthropic
- **Craft MCP Integration**: Access to 32+ Craft document tools (blocks, collections, search, tasks)
- **Sources**: Connect to MCP servers, REST APIs (Google, Slack, Microsoft), and local filesystems
- **Permission Modes**: Three-level system (Explore, Ask to Edit, Auto) with customizable rules
- **Background Tasks**: Run long-running operations with progress tracking
- **Dynamic Status System**: Customizable session workflow states (Todo, In Progress, Done, etc.)
- **Theme System**: Cascading themes at app and workspace levels
- **Multi-File Diff**: VS Code-style window for viewing all file changes in a turn
- **Skills**: Specialized agent instructions stored per-workspace
- **File Attachments**: Drag-drop images, PDFs, Office documents with auto-conversion
- **Hooks**: Event-driven automation — run commands or create sessions on label changes, schedules, tool use, and more

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
git clone https://github.com/LennardZuendorf/shards-agent.git
cd shards-agent
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

**Debug logging** (writes to `~/Library/Logs/Craft Agents/`):
Logs are automatically enabled in development mode.

### Environment Variables

OAuth integrations (Slack, Microsoft) require credentials baked into the build. Create a `.env` file:

```bash
MICROSOFT_OAUTH_CLIENT_ID=your-client-id
SLACK_OAUTH_CLIENT_ID=your-slack-client-id
SLACK_OAUTH_CLIENT_SECRET=your-slack-client-secret
```

**Note:** Google OAuth credentials are NOT baked into the build. Users provide their own credentials via source configuration.

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

**Sub-package docs (inherited from Craft Agents):**
| Document | What it covers |
|----------|---------------|
| `apps/electron/AGENTS.md` | Electron app architecture, IPC patterns, renderer patterns, security |
| `packages/shared/AGENTS.md` | Core business logic — CraftAgent, permissions, sessions, MCP, skills, statuses |
| `packages/core/CLAUDE.md` | Shared types — workspace, session, message types |

**Always check the relevant spec before implementing.** The Shards specs are the source of truth for editor/note-taking features. The Craft Agents sub-package docs are the source of truth for agent infrastructure.

---

## Configuration

Configuration is stored at `~/.craft-agent/`:

```
~/.craft-agent/
├── config.json              # Main config (workspaces, LLM connections)
├── credentials.enc          # Encrypted credentials (AES-256-GCM)
├── preferences.json         # User preferences
├── theme.json               # App-level theme
└── workspaces/
    └── {id}/
        ├── config.json      # Workspace settings
        ├── theme.json       # Workspace theme override
        ├── hooks.json       # Event-driven automation hooks
        ├── sessions/        # Session data (JSONL)
        ├── sources/         # Connected sources
        ├── skills/          # Custom skills
        └── statuses/        # Status configuration
```

### Hooks (Automation)

Hooks let you automate workflows by triggering actions when events happen — labels change, sessions start, tools run, or on a cron schedule.

**Just ask the agent:**
- "Set up a daily standup briefing every weekday at 9am"
- "Notify me when a session is labelled urgent"
- "Log all permission mode changes to a file"
- "Every Friday at 5pm, summarise this week's completed tasks"

Or configure manually in `~/.craft-agent/workspaces/{id}/hooks.json`:

```json
{
  "version": 1,
  "hooks": {
    "SchedulerTick": [
      {
        "cron": "0 9 * * 1-5",
        "timezone": "America/New_York",
        "labels": ["Scheduled"],
        "hooks": [
          { "type": "prompt", "prompt": "Check @github for new issues assigned to me" }
        ]
      }
    ],
    "LabelAdd": [
      {
        "matcher": "^urgent$",
        "permissionMode": "allow-all",
        "hooks": [
          { "type": "command", "command": "osascript -e 'display notification \"Urgent session\" with title \"Craft Agent\"'" }
        ]
      }
    ]
  }
}
```

**Two hook types:**
- **Command hooks** — run shell commands with event data as environment variables (`$CRAFT_LABEL`, `$CRAFT_SESSION_ID`, etc.)
- **Prompt hooks** — create a new agent session with a prompt (supports `@mentions` for sources and skills)

**Supported events:** `LabelAdd`, `LabelRemove`, `PermissionModeChange`, `FlagChange`, `TodoStateChange`, `SchedulerTick`, `PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, and more.

See the [Hooks documentation](https://agents.craft.do/docs/hooks/overview) for the full reference.

---

## Tech Stack

Everything from Craft Agents, plus:

| Layer | Technology |
|-------|------------|
| Editor | tiptap v3 + @tiptap/markdown + CodeBlockLowlight |
| Editor UI | tiptap UI Components (Simple Editor template, SCSS) |
| Frontmatter | gray-matter |
| Editor styling | tiptap SCSS + shared CSS custom properties (`--shards-*`) |

**Inherited from Craft Agents:**

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| AI | @anthropic-ai/claude-agent-sdk |
| Desktop | Electron + React 18 |
| UI | shadcn/ui + Tailwind CSS v4 |
| Build | esbuild (main/preload) + Vite (renderer) |
| State | Jotai |
| Language | TypeScript (strict) |

See the upstream [Craft Agents README](https://github.com/lukilabs/craft-agents-oss) for more details on the base tech stack.

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
