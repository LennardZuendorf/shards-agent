---
type: branch
parent: tech.md
scope: agent-editor-sync
covers: agent->editor sync via file watcher, auto-tagging, CLAUDE.md auto-loading, MCP auto-detection, workspace auto-configuration, @ mention implementation, conflict resolution
updated: 2026-02-12
---

# Agent-Editor Integration

Technical implementation of agent-editor synchronization, auto-tagging in Note+Chat mode, CLAUDE.md auto-loading, MCP auto-detection, workspace auto-configuration, and @ mention system.

**Parent:** [tech.md](tech.md) | **Sibling:** [tech-infrastructure.md](tech-infrastructure.md)

**UX specs:** [product-design.md](product-design.md) (Agent Sync UX), [product-agent.md](product-agent.md) (agent context, skills, MCP, @ mentions).

For Craft Agents base agent infrastructure, see: `packages/shared/AGENTS.md`, `apps/electron/AGENTS.md`.

---

## What We Inherit (Don't Re-implement)

Craft Agents already provides:

| Feature | Where | Shards action |
|---------|-------|---------------|
| Agent execution (`CraftAgent`) | `packages/shared/src/agent/` | Use as-is |
| Claude Agent SDK streaming | `packages/shared/src/agent/craft-agent.ts` | Use as-is |
| Session management | `apps/electron/src/main/sessions.ts` | Use as-is |
| Permission modes (safe/ask/allow-all) | `packages/shared/src/agent/mode-manager.ts` | Use as-is |
| Tool approval UI | `apps/electron/src/renderer/components/chat/` | Use as-is |
| MCP server integration | `packages/shared/src/sources/` | Use as-is |
| Session persistence (JSONL) | `packages/shared/src/sessions/` | Use as-is |
| Chat UI (messages, tool blocks) | `apps/electron/src/renderer/components/chat/` | Use as-is |
| Local source type (attach folder) | `packages/shared/src/sources/` | Auto-attach workspace folder |
| Skills discovery (global + local) | `packages/shared/src/skills/discovery.ts` | Pass workspace as workingDirectory |
| Mention parsing (`[file:path]`, `[skill:slug]`, `[source:slug]`) | `apps/electron/src/renderer/lib/mentions.ts` | Reuse for auto-tagging and @ menu |
| Inline mention badges in chat input | `apps/electron/src/renderer/components/chat/` | Reuse for @ menu |
| System prompt generation | `packages/shared/src/prompts/` | Extend with CLAUDE.md content |

**Do not create a separate agent service, streaming protocol, or chat panel.**

---

## Workspace Auto-Configuration

When a workspace is created or opened, Shards automatically configures three things:

### Working Directory

```typescript
// Set in workspace config — Craft Agents already supports this
workspace.config.defaults.workingDirectory = workspace.rootPath
```

The agent's cwd is always the workspace root (= notes folder).

### Auto-Attach Local Source

The workspace folder is hardcoded as a local source so the agent can browse/read files:

```typescript
// On workspace open, ensure a local source exists for the workspace root
// Uses Craft Agents' existing local source type
const workspaceSource: SourceConfig = {
  type: 'local',
  slug: 'workspace-notes',
  name: 'Workspace Notes',
  config: {
    path: workspace.rootPath,
  },
}
// Save to workspace sources if not already present
```

This gives the agent browse/read tools for the entire workspace folder.

### Skills Discovery

Pass the workspace rootPath as `projectRoot` to the existing `loadAllSkills()` call:

```typescript
const skills = loadAllSkills(workspaceRoot, workspace.rootPath)
// workspaceRoot = ~/.craft-agent/workspaces/{id}/ (workspace skills)
// projectRoot = workspace.rootPath (project-local skills from .agents/skills/)
```

Already works via Craft Agents' `scanLocalSkills()` — just ensure the workspace rootPath is passed as `projectRoot`.

---

## CLAUDE.md / AGENTS.md Auto-Loading

### Behavior

On session start, check the workspace root for context files and prepend to the agent's system prompt.

```typescript
// In session creation / agent initialization
async function loadAutoContext(workspaceRootPath: string): Promise<string | null> {
  const candidates = ['CLAUDE.md', 'AGENTS.md']
  for (const filename of candidates) {
    const filePath = path.join(workspaceRootPath, filename)
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return content
    } catch {
      continue  // file doesn't exist, try next
    }
  }
  return null
}

// Prepend to system prompt
const autoContext = await loadAutoContext(workspace.rootPath)
if (autoContext) {
  systemPrompt = autoContext + '\n\n' + systemPrompt
}
```

### Rules

- Check `CLAUDE.md` first, then `AGENTS.md` (same precedence as Claude Code)
- If both exist, use `CLAUDE.md` only
- Re-read on each session start (not cached across sessions)
- No UI indication — invisible to the user

### What Already Exists

Craft Agents already has `findAllProjectContextFiles()` and `getProjectContextFilesPrompt()` in `packages/shared/src/prompts/system.ts` that discover and include CLAUDE.md/AGENTS.md files from the working directory. This works automatically when `workingDirectory` is set to the workspace rootPath.

**No new work needed** — just ensure the workspace rootPath is passed as `workingDirectory` when creating sessions. The existing system prompt generation handles the rest.

---

## MCP Auto-Detection

Workspace folders may contain MCP server configurations from Claude Code or other tools. Shards detects and surfaces these.

### Detection

```typescript
// On workspace open, scan for MCP configs
async function detectLocalMcpConfigs(workspaceRootPath: string): Promise<McpServerConfig[]> {
  const candidates = [
    path.join(workspaceRootPath, '.claude', 'mcp.json'),
    path.join(workspaceRootPath, '.agents', 'mcp.json'),
  ]

  const configs: McpServerConfig[] = []
  for (const configPath of candidates) {
    try {
      const raw = await fs.readFile(configPath, 'utf-8')
      const parsed = JSON.parse(raw)
      // Parse Claude Code mcp.json format -> Craft Agents source format
      configs.push(...parseMcpConfig(parsed, configPath))
    } catch {
      continue
    }
  }
  return configs
}
```

### Surfacing

- Auto-detected MCP servers appear in the Sources panel alongside manually configured sources
- Shown with a "Local" badge to distinguish from workspace-configured ones
- Enabled by default, can be disabled by the user
- Uses Craft Agents' existing source/MCP infrastructure — just adds sources programmatically

---

## Auto-Tagging (Note+Chat Mode)

When the user sends a message in Note+Chat mode, the current note is automatically referenced so the agent knows which file the user is working on.

### Implementation

```typescript
// Before sending message in Note+Chat mode:
async function sendMessageWithAutoTag(
  sessionId: string,
  userMessage: string,
  currentFilePath: string | null,
  editor: Editor,
  frontmatter: string,
) {
  // 1. Auto-save if dirty
  if (isDirty && currentFilePath) {
    const markdown = editor.getMarkdown()
    await window.electronAPI.file.save(currentFilePath, markdown, frontmatter)
    setDirty(false)
  }

  // 2. Auto-tag current file as a mention
  let mentions: string[] = []
  if (currentFilePath) {
    mentions.push(`[file:${currentFilePath}]`)
  }

  // 3. Send through Craft Agents' normal sendMessage flow
  // The mention is parsed by lib/mentions.ts — agent receives the file path
  // and can read it if needed
  await window.electronAPI.sendMessage(sessionId, userMessage, { mentions })
}
```

### How It Works

- Uses the existing Craft Agents mention system (`[file:path]` syntax parsed by `lib/mentions.ts`)
- The agent receives the file path and reads it if relevant to the user's question
- No file content is injected into the message — the agent decides whether to read the file
- This is the same mechanism as manual `@` file references, just automated

### When Auto-Tagging Fires

- Only when on the Note tab with a session active (`activeTabAtom === 'note'` and session exists)
- Only when a note is open (`currentFilePathAtom !== null`)
- On every message send (not just the first message)

---

## @ Mention System

### Trigger

User types `@` in the chat input. A dropdown menu appears with three sections.

### Implementation Approach

Extends Craft Agents' existing chat input (RichTextInput) which already supports inline mention badges.

```typescript
// @ menu dropdown sections:
// 1. Skills — from loadAllSkills() (global + workspace + local)
// 2. Sources — from loadWorkspaceSources() (MCP + API + auto-detected local)
// 3. Files — fuzzy search workspace files via notes:list

// Selection inserts the appropriate mention type:
// - Skill -> [skill:slug]
// - Source -> [source:slug]
// - File -> [file:relative/path.md]
```

### File Search

When typing after `@`, the Files section performs a fuzzy match on file names and paths from the workspace:

```typescript
// File list is already available from fileTreeAtom (flat list of all .md files)
// Filter by fuzzy match on the typed query
const results = flatFileList.filter(f => fuzzyMatch(query, f.path))
```

### What Already Exists vs. What's New

| Part | Status |
|------|--------|
| Mention parsing (`[file:path]`, `[skill:slug]`, `[source:slug]`) | Exists in `lib/mentions.ts` |
| Inline badge rendering in chat input | Exists in `FreeFormInput` |
| `@` trigger and `InlineMentionMenu` dropdown | **Exists** — `useInlineMention` hook, sections for Skills/Sources/Files/Folders |
| File fuzzy search in @ menu | **Exists** — workspace file search already in mention menu |
| Skills/Sources listing in dropdown | **Exists** — loaded from workspace data |

The `@` mention system is **already fully built** in Craft Agents (`InlineMentionMenu` + `useInlineMention` hook in `FreeFormInput`). No new UI work needed — just ensure it has access to the file tree data from the workspace folder.

---

## Agent -> Editor Sync

### Problem

When the agent uses `Write` or `Edit` tools (via Claude Agent SDK), it modifies files on disk. If the modified file is currently open in the editor, the editor needs to reload.

### Solution: File Watcher

File watching handled by `services/files.ts` (see [tech-infrastructure.md — File Service](tech-infrastructure.md)):

```
Agent edits file on disk (via CraftAgent's tool execution)
    |
fs.watch fires change event
    |
Main process debounces (100ms) + checks if change was from our own save
    | (if external change)
Main sends 'notes:changed' event to renderer
    |
Renderer re-reads file via notes.open(path)
    |
Editor reloads: editor.commands.setContent(newContent, { contentType: 'markdown' })
    |
Dirty flag cleared (content matches disk)
```

### Conflict Resolution

| Scenario | Behavior |
|----------|----------|
| Agent edits file, editor has no unsaved changes | Auto-reload silently |
| Agent edits file, editor has unsaved changes | Auto-save editor first, then reload agent's version |
| Agent creates new file | File tree refreshes, file appears. Not auto-opened. |
| Agent deletes current file | Clear editor, show toast |
| Agent edits a different file | No editor action. File tree may refresh. |
| External app edits current file | Same as agent edit: `fs.watch` fires, auto-save if dirty, then reload |

### Auto-Save Before Agent Query

To avoid conflicts, the editor auto-saves before any agent query starts:

```typescript
// Before sending a message in the chat, if editor has unsaved changes:
if (isDirty && currentFilePath) {
  const markdown = editor.getMarkdown()
  await window.electronAPI.file.save(currentFilePath, markdown, frontmatter)
  setDirty(false)
}
// Then send the message through Craft Agents' normal sendMessage flow
```

Integrates with existing `sendMessage` flow — not a separate path.

---

## Session <-> Editor Relationship

### Independence

Agent sessions and editor files are **independent**:
- A session is NOT tied to a specific file
- You can switch files while keeping the same session
- You can switch sessions while keeping the same file open
- The agent can access any file in the workspace, not just the open one

### Workspace Alignment

Both editor and agent operate within the same workspace directory:
- Editor: opens `.md` files from workspace folder
- Agent: `cwd` set to workspace folder (inherited from Craft Agents)

The agent's `Read`, `Write`, `Edit`, `Glob`, `Grep` tools all operate within the same folder the file tree shows.

---

## Integration Points with Craft Agents

### Chat Input Extension

The @ mention dropdown and auto-tagging require modifications to Craft Agents' chat input component (RichTextInput). Minimal, additive changes — not a rewrite.

### App Shell Extension

Editor and file tree panels require modifications to the app shell layout. The view toggle and middle panel switching are new components added to the existing shell.

### System Prompt Extension

CLAUDE.md auto-loading requires a hook into Craft Agents' system prompt generation. Additive — prepend content before the standard prompt.

### Session Events

Craft Agents already streams session events to the renderer. The `notes:changed` watcher handles sync at the filesystem level — no changes to session event types or streaming protocol needed.

---

## Resolved Technical Questions

1. **MCP config format** — Claude Code's `.claude/mcp.json` uses `{ mcpServers: { name: { type, command, args, env } } }`. Craft Agents uses per-source folders with `{ type: "mcp", mcp: { transport, command, args, env } }`. Conversion is trivial: `type` -> `mcp.transport`, nest `command/args/env` under `mcp`, generate `id`/`slug`/`name`/`enabled` metadata. Auth `headers` map to `authType: "bearer"`.
2. **Multiple file edits** — Not MVP. The agent chat already shows tool use (Write/Edit) in the conversation. No additional notification needed for non-current file edits.
