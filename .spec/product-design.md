---
type: branch
parent: product.md
scope: product-ux
covers: workspace setup, layout, UI modes, view toggle, navigation, file tree, new note flow, editor UX, auto-save, auto-tagging, keyboard shortcuts, mode transitions, empty states, agent sync UX, settings
updated: 2026-02-12
---

# UI Design Specs

All UX patterns for integrating the notes editor into Craft Agents. Covers workspace setup, layout, three right-panel views, file tree navigation, new note flow, editor, auto-save, auto-tagging, and agent-editor interaction.

**Parent:** [product.md](product.md)

**Tech implementation:** For code, components, and IPC details see [tech-infrastructure.md](tech-infrastructure.md) and [tech-agents.md](tech-agents.md).

---

## Design Principles

1. **Note-centric by default** — The file tree is the primary middle panel, not sessions
2. **Explicit binding** — Notes and sessions are independent by default. Combining them is an explicit user action (attach/detach), not an automatic side effect
3. **Three clean modes** — Note Alone, Chat Alone, Note+Chat. Each is a first-class experience, not a degraded version of another
4. **Preserve existing chat workflow** — Chat-first users can use full chat view without ever touching notes
5. **Keyboard-first navigation** — Fast access to notes and sessions via shortcuts

---

## Workspace = Notes Folder

The workspace root IS the notes folder. No separate setting needed — this uses Craft Agents' existing workspace creation flow.

### Two Paths to a Workspace

Craft Agents already provides both options:

1. **"Choose a location"** — User opens an existing folder (e.g., `~/Notes` or a project folder). That folder becomes the workspace root. If it already has `.md` files, they appear immediately in the file tree. If it has `.claude/` or `.agents/` dirs, skills and MCP configs are auto-detected.

2. **"Default location"** — Creates a new workspace under `~/.craft-agent/workspaces/{slug}/`. Notes are created here alongside the workspace config, sessions, etc.

### What Shards Sets Automatically

When a workspace is created or opened:
- `config.defaults.workingDirectory` is set to the workspace rootPath
- The workspace folder is auto-attached as a local source (so the agent can browse/read files)
- The file tree shows `.md` files from the workspace root
- Agent cwd = workspace rootPath

### Empty Workspace State

When the workspace folder contains no `.md` files:

```
         No notes yet

   Create your first note
   [+ New Note]
```

---

## Layout

Shards reuses Craft Agents' existing three-column layout. The key change: the **middle panel defaults to the file tree** ("All Notes") instead of the session list.

### Overall Structure

```
┌────────────┬─────────────────────┬───────────────────────────┐
│            │                     │                           │
│  Left      │   Middle Panel      │   Right Panel             │
│  Sidebar   │                     │                           │
│            │   File Tree         │   View-dependent:         │
│  (same as  │   by default        │   - Chat view             │
│  existing  │                     │   - Note+Chat view        │
│  Craft     │   (or Session List  │   - Note view             │
│  Agents)   │    when selected)   │                           │
│            │                     │                           │
└────────────┴─────────────────────┴───────────────────────────┘
```

### Left Sidebar (minimal changes)

The existing Craft Agents left sidebar stays the same. The only addition:

- **"+ New Note"** button alongside "+ New Session" at the top (same as `Cmd+N`)
- **"All Notes"** item added under a Notes section — clicking it switches the middle panel to the file tree

```
┌─────────────────────┐
│ [Workspace Switcher]│
├─────────────────────┤
│ + New Session       │  <- Existing
│ + New Note          │  <- NEW (same as Cmd+N)
├─────────────────────┤
│   All Sessions      │  <- Switches middle panel to session list
│   Flagged           │
│   Status            │
│   ...               │
├─────────────────────┤
│   All Notes         │  <- NEW: Switches middle panel to file tree
├─────────────────────┤
│ Sources             │  <- Existing
│ Skills              │
│ Settings            │
└─────────────────────┘
```

**Default:** "All Notes" is selected on launch — file tree shows in middle panel.

---

## Middle Panel — File Tree by Default

The middle panel shows the **file tree by default**, not the session list. Clicking "All Sessions" (or Flagged, Status, etc.) in the left sidebar switches it to the session list. Clicking "All Notes" switches back.

### File Tree

```
┌─────────────────────────────────┐
│  All Notes                [+]   │
├─────────────────────────────────┤
│ > Projects/                     │
│   > shards-agent/               │
│   v personal-blog/              │
│     blog-post-ideas.md          │
│     2026-goals.md               │
│ v Daily Notes/                  │
│   2026-02-11.md                 │
│   2026-02-10.md                 │
│ .obsidian/                      │
│ inbox.md                        │
│ todos.md                        │
└─────────────────────────────────┘
```

**The file tree IS the note switcher.** Click any `.md` file to open it in the right panel. No separate note navigation needed.

**Behavior:**
- Hierarchical folder structure, collapsible
- Only `.md` files and directories visible. Dot-directories (`.obsidian/`, `.craft-agent/`, etc.) and `CLAUDE.md`/`AGENTS.md` files are **hidden** from the file tree
- Sorted alphabetically: directories first, then files
- Click file → open in editor (auto-saves current note first)
- Current file highlighted with accent background
- Right-click context menu: New Note, New Folder, Rename, Delete
- [+] dropdown: "New Note" / "New Folder" — creates in selected folder or root

**Create folder:**
- Right-click → New Folder, or [+] dropdown → "New Folder"
- Creates folder with inline rename active (same pattern as new note)

**Rename flow:**
- Double-click filename in tree, or right-click → Rename
- Inline text input replaces the filename label
- `.md` extension is auto-appended — user types the name only (e.g., type "meeting-notes", file becomes "meeting-notes.md")
- Enter confirms, Esc cancels
- Validates: no empty names, no `/` in names, no duplicate names in same directory
- If the renamed file is currently open in the editor, the editor header updates immediately

**Delete flow:**
- Right-click → Delete
- Confirmation dialog: "Move `filename.md` to Trash?"
- Uses `shell.trashItem` (moves to system Trash, not permanent delete)
- If the deleted file was open in the editor, editor clears and returns to empty state
- Folders can be deleted too — recursive trash. Confirmation: "Move `folder/` and its contents to Trash?"
- If any file inside the deleted folder was open, editor clears

**Move flow:**
- Post-MVP (see Future Enhancements — drag-and-drop)

### Session List (existing)

When "All Sessions", "Flagged", any Status, or any Label is selected in the left sidebar — the middle panel switches to the existing Craft Agents session list. No changes to this.

---

## Right Panel — Three Modes

The right panel has three independent modes. Notes and sessions are **not automatically linked** — combining them requires an explicit user action (attach/detach).

### The Three Modes

1. **Note Alone** — Full-height editor. No chat. Distraction-free writing.
2. **Chat Alone** — Full-height chat. Existing Craft Agents experience, unchanged. No note.
3. **Note+Chat** — Note with chat attached. Editor fills most of the panel, chat input at bottom. Tab switcher between integrated note+chat view and full chat history.

### How modes connect (Attach / Detach)

Notes and sessions start independent. The user explicitly binds them:

**Attaching a note to a session:**
- From Chat Alone: use a slash command (e.g. `/attach-note`) or action button → opens file picker or attaches currently open note → becomes Note+Chat
- From Note Alone: click "Start chat" (or Cmd+Shift+N) → creates a new session with the current note auto-attached → becomes Note+Chat

**Detaching:**
- From Note+Chat: "Detach note" action → session continues as Chat Alone, note stays open as Note Alone
- From Note+Chat: "Close chat" → session is deselected, note stays as Note Alone
- From Note+Chat: "New session" → creates a new session with the same note auto-attached (previous session still exists, just deselected)

**Key principle:** A session knows which note is attached to it (if any). A note can exist without any session. Switching between sessions in the session list automatically shows/hides the note based on that session's binding.

### View Toggle (Note+Chat mode only)

Two tabs appear at the top of the right panel **only when a note is attached to a session**:

```
┌─────────────────────────────────────────────┐
│  [Note+Chat] [Chat History]   blog-post.md  │
└─────────────────────────────────────────────┘
```

- **Note+Chat** tab — Editor with chat input bar at bottom (the core Shards experience)
- **Chat History** tab — Full chat with conversation history (existing ChatPage)

When only a note is open (no session): no tabs. When only a session is open (no note attached): no tabs.

### Chat Alone (no note attached)

Full-height chat. This is the existing Craft Agents experience, completely unchanged.

```
┌─────────────────────────────────────────────┐
│  New chat ∨                                 │
├─────────────────────────────────────────────┤
│                                             │
│  [Full-height chat messages]                │
│                                             │
├─────────────────────────────────────────────┤
│  [Explore ∨]                    [○ Todo ∨]  │
│  [Message input...]               [Send]    │
│  [Attach Files] [Choose Sources] [Work in…] │
└─────────────────────────────────────────────┘
```

### Note Alone (no session)

Full-height editor for distraction-free writing. No chat interface.

```
┌─────────────────────────────────────────────┐
│  blog-post.md  *                            │
├─────────────────────────────────────────────┤
│  [EditorToolbar]                            │
├─────────────────────────────────────────────┤
│                                             │
│  # Blog Post Ideas                          │
│                                             │
│  ## Technical                               │
│  - How to build...                          │
│                                             │
│  [Start chat]                               │
└─────────────────────────────────────────────┘
```

A subtle "Start chat" action at the bottom or in the header creates a new session with this note auto-attached.

### Note+Chat (note attached to session) — the core Shards experience

Note fills most of the right panel. Chat input bar sits at the bottom. Full chat history is accessible via the Chat History tab.

**Note+Chat tab (default):**

```
┌─────────────────────────────────────────────┐
│  [Note+Chat] [Chat History]   blog-post.md *│
├─────────────────────────────────────────────┤
│  [EditorToolbar]                            │
├─────────────────────────────────────────────┤
│                                             │
│  # Blog Post Ideas                          │
│  - How to build...                          │
│                                             │
│                                             │
├─────────────────────────────────────────────┤
│  Ask Claude about blog-post.md              │
│  [Message input...]               [Send]    │
└─────────────────────────────────────────────┘
```

**Chat History tab:**

```
┌─────────────────────────────────────────────┐
│  [Note+Chat] [Chat History]   blog-post.md  │
├─────────────────────────────────────────────┤
│                                             │
│  [Full-height chat messages]                │
│                                             │
├─────────────────────────────────────────────┤
│  [Message input...]               [Send]    │
└─────────────────────────────────────────────┘
```

**Auto-tagging:**
- When the user sends a message in Note+Chat mode, the attached note is **automatically referenced** as a `[file:path]` mention in the background
- The agent receives the file path and can read it if needed
- This replaces the manual "Send Current File" button — no explicit action needed
- Uses the existing Craft Agents file mention system

**Chat input bar (Note+Chat tab):**
- Same input component as Chat view, positioned at the bottom of the editor
- Supports `@` mentions, file attachments, etc.
- Auto-save editor content before sending any message

### Session-Note Binding Lifecycle

The binding between a session and a note is **per-session state**, not global:

- `sessionNoteBinding`: Map<sessionId, filePath | null>
- When a session has a bound note, selecting that session in the session list shows Note+Chat mode
- When a session has no bound note, selecting it shows Chat Alone
- Opening a note from the file tree sets it as the "current note" but does NOT auto-attach it to the current session
- The binding is explicit: attach command, "Start chat" from note, or starting a new session while a note is open

---

## New Note Flow

### Creation

- `Cmd+N` (or "+ New Note" in the left sidebar) creates `Untitled.md` in the currently selected folder in the file tree (or workspace root if nothing is selected)
- If `Untitled.md` already exists, use `Untitled 2.md`, `Untitled 3.md`, etc.
- The file is written to disk immediately

### After Creation

1. File appears in file tree
2. File opens in editor (right panel switches to Note view)
3. Filename is highlighted in file tree with inline rename active (editable text input)
4. `.md` extension is auto-appended — user types the name only
5. User types desired name, presses Enter to confirm (or Esc to keep "Untitled")
6. Editor gets focus after rename completes (or after Esc)

### Edge Cases

- If no workspace exists yet, `Cmd+N` triggers the workspace creation flow (existing Craft Agents UI)
- Creating a note auto-saves the currently open note before switching

---

## Editor UX

**Use TipTap's simple-editor template:** https://tiptap.dev/docs/ui-components/templates/simple-editor

**Use TipTap UI Components:** https://tiptap.dev/docs/ui-components/components/overview

Don't custom-build editor features — use the production-ready components from the template:
- **Toolbar** - formatting buttons (bold, italic, headings, lists, etc.)
- **BubbleMenu** - inline formatting on text selection
- **SlashCommands** - quick actions via `/` command palette
- **EditorContent** - the main editing area

The toolbar, bubble menu, and formatting options are whatever the simple-editor template provides. Scaffold via CLI and use as-is.

### Shards-Specific Customizations

- Max content width: 720px, centered horizontally
- Generous padding (px-8 py-6)
- Placeholder text: "Start writing..."

### Frontmatter

- YAML frontmatter is **invisible** in the editor
- Stripped on file read, re-prepended on save
- Stored in a separate state atom, not in the editor document
- User never directly edits frontmatter in the editor (future: dedicated UI)

### Auto-Save

Auto-save follows the VS Code model — the user never thinks about saving.

**Triggers:**
- ~1.5s of inactivity after last edit (debounced from tiptap `onUpdate`)
- Window blur / focus loss
- Note switch (before opening the new note)
- Chat message send (before sending to agent)
- `Cmd+S` triggers immediate save (for muscle memory)

**Dirty indicator:**
- Unsaved changes shown as a dot (`*`) next to the filename in the header
- Dot clears immediately on save

**No dialogs:**
- No "unsaved changes" dialogs — ever
- No "save before closing?" prompts
- Switching notes, closing notes, quitting the app — all auto-save silently

---

## Mode Transitions

### Within a mode

| Current Mode | User Action | Result |
|-------------|------------|----------|
| Note Alone | Click different note in file tree | Switch note (auto-save first). Stay in Note Alone. |
| Chat Alone | Click different session in session list | Switch session. Stay in Chat Alone. |
| Note+Chat | Click different note in file tree | Switch the note in the editor. Binding does NOT change — the session is still attached to the original note. The new note is just being viewed. |
| Note+Chat | Click Chat History tab | Show full chat history. Click Note+Chat tab to return. |

### Attaching (entering Note+Chat)

| Current Mode | User Action | Result |
|-------------|------------|----------|
| Note Alone | "Start chat" / Cmd+Shift+N | Create new session. Auto-attach current note to it. → Note+Chat |
| Chat Alone | `/attach-note` slash command | Attach a note (current open note or file picker) to the session. → Note+Chat |
| Chat Alone | Click note in file tree | Open note in Note Alone. Session is NOT attached — user stays in Chat Alone in the background, note opens independently. |

### Detaching (leaving Note+Chat)

| Current Mode | User Action | Result |
|-------------|------------|----------|
| Note+Chat | "Detach note" | Session continues as Chat Alone. Note stays open as Note Alone. Binding removed. |
| Note+Chat | "Close chat" | Deselect session. → Note Alone (note stays open) |
| Note+Chat | "New session" | Create new session with same note auto-attached. Previous session still exists. → Note+Chat (new session) |
| Note+Chat | Click "All Sessions" + select different session | If new session has a bound note → Note+Chat with that note. If no bound note → Chat Alone. Previous note closes. |

### Cross-mode navigation

| Current Mode | User Action | Result |
|-------------|------------|----------|
| Note Alone | Click "All Sessions" + select session | If session has bound note → Note+Chat. If no bound note → Chat Alone. Note Alone note closes. |
| Chat Alone | Click "All Notes" + select note | → Note Alone. Chat session stays selected in background but right panel shows note. |
| Any | Cmd+N | Create new note → Note Alone |

**Note switching:** Clicking a different file in the file tree always auto-saves the current note first, then opens the new note.

**Session switching:** Selecting a different session in the session list checks that session's note binding and renders the appropriate mode.

---

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | New note |
| `Cmd+Shift+N` | New chat session |
| `Cmd+W` | Close current note (stays in chat if session active) |
| `Cmd+E` | Switch between Note and Chat tabs |
| `Cmd+\` | Toggle left sidebar |
| `Cmd+Shift+\` | Toggle middle panel |
| `Cmd+S` | Save current note |

### Editor

Standard tiptap keyboard shortcuts (Cmd+B, Cmd+I, Cmd+K, etc.) — whatever the template provides.

### Navigation

| Shortcut | Action |
|----------|--------|
| `Cmd+1` | Middle panel → Session list |
| `Cmd+2` | Middle panel → File tree |

---

## Agent Sync UX

How agent-initiated file changes appear to the user. (Tech implementation in [tech-agents.md](tech-agents.md).)

| Scenario | What the user sees |
|----------|-------------------|
| Agent edits current file, no unsaved changes | Editor content updates silently |
| Agent edits current file, unsaved changes exist | Editor auto-saves first, then updates with agent's version |
| Agent creates a new file | File tree refreshes, new file appears. Not auto-opened. |
| Agent deletes current file | Editor clears, toast notification |
| Agent edits a different file | No editor change. File tree may refresh. |
| External app edits current file | Same as agent edit: `fs.watch` fires, editor auto-saves if dirty, then reloads silently |

---

## Shards-Specific Settings

Additions to Craft Agents' existing settings pages, kept minimal for MVP.

- **Auto-save** — toggle, default on

That's it. The workspace folder is set at workspace creation time (existing Craft Agents flow). Use tiptap defaults for everything else.

---

## UX Decisions Log

Previously open questions, now resolved:

1. **New Note flow** → `Cmd+N` creates `Untitled.md`, inline rename in file tree. `.md` auto-appended.
2. **Workspace = notes folder** → Uses existing workspace creation flow. No separate folder setting.
3. **Note switching with dirty state** → Auto-save silently before switching. No dialogs.
4. **File tree refresh after agent changes** → Incremental via `fs.watch`. Expanded/collapsed state preserved in Jotai atom.
5. **Folder deletion** → Allowed, recursive trash via `shell.trashItem`. If open file inside, editor clears.
6. **Hidden directories** → Dot-directories and CLAUDE.md/AGENTS.md files hidden from file tree.
7. **File tree sort** → Alphabetical (A-Z) only. No sort options.
8. **Rename extension** → `.md` auto-appended, user types name only.
9. **Editor features** → Use tiptap defaults. Don't custom-build.
10. **Middle panel default** → File tree ("All Notes"), not session list.
11. **Note switching UI** → File tree in middle panel IS the note switcher. No separate navigation.
12. **View toggle** → Two text tabs [Note] [Chat] at top of right panel header.
13. **Auto-tagging** → In Note+Chat, current note is auto-referenced as `[file:path]` on every message send. Replaces manual "Send Current File" button.
14. **Chat history in Note+Chat** → "Show chat history" link switches to Chat tab. Click Note tab to return.
15. **Dot-directories** → All dot-dirs (`.craft-agent/`, `.obsidian/`, `.claude/`, etc.) hidden from file tree. `CLAUDE.md` and `AGENTS.md` also hidden.
16. **Right sidebar** → Existing SessionMetadataPanel kept as-is. No changes for Shards.

---

## Future Enhancements (post-MVP)

- Backlinks and graph view
- Note templates (daily note, meeting note, project)
- Full-text search across all notes
- File tree search / filter
- Quick note switcher (Cmd+P command palette)
- Recent notes list
- Pinned / favorited notes
- ~~Session ↔ note soft linking~~ (now implemented as explicit attach/detach binding)
- Agent suggests edits with inline diff view
- Multiple notes open (tabs or split)
- Export as PDF
- Frontmatter editing UI
- Drag-and-drop file move in file tree
