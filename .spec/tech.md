---
type: entrypoint
scope: technical
children:
  - tech-infrastructure.md
  - tech-agents.md
updated: 2026-02-12
---

# Shards — Technical Architecture

## Design Philosophy

1. **Inherit everything from Craft Agents. Only build what's new.**
2. **Use TipTap's simple-editor template and UI Components.** Don't rebuild editor UI - use production-ready components from https://tiptap.dev/docs/ui-components/.

## Architecture Overview

```
shards/
├── apps/electron/src/
│   ├── main/
│   │   ├── index.ts              # App lifecycle (extended)
│   │   ├── ipc.ts                # IPC handlers (extended with file channels)
│   │   ├── sessions.ts           # SessionManager (inherited)
│   │   └── services/files.ts     # NEW: File I/O, frontmatter, watching
│   ├── preload/index.ts          # Context bridge (extended with file APIs)
│   └── renderer/
│       ├── components/
│       │   ├── tiptap/           # NEW: tiptap UI components (SCSS)
│       │   ├── editor/           # NEW: Editor.tsx, EditorToolbar.tsx
│       │   ├── filetree/         # NEW: FileTree.tsx, FileNode.tsx
│       │   ├── chat/             # Inherited
│       │   ├── app-shell/        # Extended with view toggle + middle panel switching
│       │   └── ui/               # Inherited (shadcn/ui)
│       ├── atoms/editor.ts       # NEW: currentFilePath, isDirty, frontmatter, activeTab
│       └── styles/               # Extended with --shards-* tokens
├── packages/
│   ├── core/                     # Inherited, unmodified
│   └── shared/                   # Inherited, unmodified
└── .spec/                        # Design docs
```

## Tech Stack

**Inherited:** Bun, Electron + React 18, @anthropic-ai/claude-agent-sdk, shadcn/ui + Tailwind CSS v4, esbuild + Vite, Jotai, TypeScript (strict).

**Added:** TipTap v3 editor core + TipTap UI Components (simple-editor template: https://tiptap.dev/docs/ui-components/templates/simple-editor), @tiptap/markdown + CodeBlockLowlight + free extensions, gray-matter (frontmatter), sass-embedded (dev).

## What We Build vs. Inherit vs. Get from TipTap

| Source | Approx. Lines | What |
|--------|---------------|------|
| **Craft Agents** (inherited) | ~15k+ | Agent, sessions, chat, MCP, skills, permissions, theming, Electron shell |
| **TipTap simple-editor template** (scaffolded) | ~3,500 | Toolbar, BubbleMenu, SlashCommands, node renderers, primitives, StarterKit, markdown I/O, syntax highlighting |
| **Shards** (new code) | ~800 | File I/O service, IPC extensions, editor wrapper (wires template to file ops), file tree, atoms, theme bridge, layout, auto-tagging |

## Key Patterns (details in branch docs)

- **Editor:** TipTap simple-editor template (https://tiptap.dev/docs/ui-components/templates/simple-editor) scaffolded as-is. Use template's Toolbar, BubbleMenu, and SlashCommands components. Extension stack from TipTap UI Components. Markdown I/O via @tiptap/markdown. Frontmatter stripped at I/O layer. -> [tech-infrastructure.md — Editor](tech-infrastructure.md)
- **Layout:** Three-column layout. Middle panel toggles between file tree and session list. Right panel has two tabs [Note / Chat]. -> [tech-infrastructure.md — Layout & Views](tech-infrastructure.md)
- **File sync:** Agent writes to disk -> main process watches with `fs.watch` -> renderer reloads into tiptap. Auto-save before agent query. -> [tech-agents.md — Agent-Editor Sync](tech-agents.md)
- **Auto-tagging:** In Note+Chat mode, current note auto-referenced as `[file:path]` mention on message send. -> [tech-agents.md — Auto-Tagging](tech-agents.md)
- **State:** Jotai atoms for `currentFilePath`, `isDirty`, `frontmatter`, `activeTab`, `middlePanelMode`. Coexist with Craft Agents atoms. -> [tech-infrastructure.md — Editor State](tech-infrastructure.md)
- **Theming:** `--shards-*` CSS custom properties bridge tiptap SCSS and Tailwind. -> [tech-infrastructure.md — Theming Bridge](tech-infrastructure.md)
- **IPC:** New `file:*` channels added to existing IPC handler registry. -> [tech-infrastructure.md — IPC Channel Extensions](tech-infrastructure.md)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Craft Agents layout hard to extend | Study AppShell thoroughly, keep changes minimal and additive |
| tiptap markdown roundtrip loses formatting | GFM enabled, frontmatter at I/O layer, test early |
| Agent edits conflict with unsaved changes | Auto-save before agent runs, file watcher handles reload |
| Upstream Craft Agents updates break fork | Keep changes isolated, don't modify `packages/` |

## Branch Documents

| Document | Covers |
|----------|--------|
| **[tech-infrastructure.md](tech-infrastructure.md)** | tiptap setup, extension stack, editor components, file I/O service, IPC channels, preload bridge, shared types, Jotai atoms, theming bridge, layout & view system, keyboard shortcuts |
| **[tech-agents.md](tech-agents.md)** | Agent-editor sync via file watcher, auto-tagging, CLAUDE.md auto-loading, MCP auto-detection, workspace auto-configuration, @ mention implementation |

## Inherited Architecture Docs

| Document | Covers |
|----------|--------|
| [`apps/electron/AGENTS.md`](../apps/electron/AGENTS.md) | Electron app architecture, IPC patterns, renderer patterns, security |
| [`packages/shared/AGENTS.md`](../packages/shared/AGENTS.md) | CraftAgent, permissions, sessions, MCP, skills, statuses |
| [`packages/core/CLAUDE.md`](../packages/core/CLAUDE.md) | Shared types — workspace, session, message types |
