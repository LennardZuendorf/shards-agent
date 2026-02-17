---
type: entrypoint
scope: implementation
covers: milestones, task breakdown, validation criteria, session planning
updated: 2026-02-14
status: validated against codebase
---

# Shards — Implementation Plan (Validated)

**VALIDATED** plan with realistic estimates based on codebase exploration. Accounts for Craft Agents integration complexity and KISS principles.

**Parent specs:** [product.md](product.md), [tech.md](tech.md)

---

## Validation Summary

This plan has been validated against the actual Craft Agents codebase. Key findings:

✅ **Already Exists (Don't Rebuild):**
- Mention system (`useInlineMention` hook, `[file:path]` support)
- File operations (extensive IPC handlers)
- CLAUDE.md loading
- Theme system (CSS custom properties)
- Empty states & toast notifications

❌ **Must Build:**
- Markdown editor (tiptap)
- File tree UI
- SCSS support
- Local source type implementation
- Note-specific routing

**Timeline:** 17-22 sessions (realistic, not optimistic)

---

## Critical Architecture Decisions

### ✅ Decided
- **IPC Namespace:** `notes:*` (not `file:*`)
- **Session ↔ File Binding:** Explicit attach/detach (per-session binding via `sessionNoteBindingAtom`)
- **Workspace Notes Location:** Workspace root with filtering
- **CSS Tokens:** Use existing `--background`, `--foreground`, etc. (NOT `--shards-*`)
- **File Tree Phasing:** Split M4 into M4a (basic) + M4b (CRUD)

### ⚠️ To Implement in Pre-M1
- [ ] Route pattern: `routes.view.note(workspaceId, filePath)`
- [ ] NavigationState extension: `{ navigator: 'note', details: { workspaceId, filePath } }`
- [ ] Auto-save + watcher algorithm with timestamp tracking

---

## Implementation Roadmap

| Milestone | Goal | Sessions | Risk | Changes from Original |
|-----------|------|----------|------|----------------------|
| **Pre-M1** | Architecture Decisions | 0.5 | Low | NEW (missing from original) |
| **M1** | Dependencies & Build | 1 | Low | Simplified (no `--shards-*` tokens) |
| **M2+M3** | Editor with File I/O | 3 | Medium | MERGED (was 2+2) to avoid fragile split |
| **M4a** | Basic File Tree | 2 | Medium | SPLIT from M4 (basic rendering only) |
| **M4b** | File Tree CRUD | 2-3 | High | SPLIT from M4 (create/rename/delete) |
| **M5** | Layout Integration | 2 | Low | SIMPLIFIED — basic navigation only, no session-note binding |
| **M6** | Agent Sync | 2-3 | Medium | +1 session (race condition tests). Moved before Note+Chat — independent infrastructure. |
| **M7** | Note+Chat Mode | 3-4 | High | MERGED old M5b + M7. Attach/detach, ViewTabs, auto-tagging, ChatInputBar — one coherent feature. |
| **M8** | UI Tuning & Refinement | 2-3 | Low | NEW — user-driven UI tweaks, layout adjustments, visual consistency |
| **M9** | Polish & Shortcuts | 2 | Medium | Was M8. Keyboard shortcuts, error handling, theming, performance. |

**Total:** 20-26 sessions

**Eliminated Milestones:**
- ~~M9: @ Mention System~~ (already exists via `useInlineMention`)
- ~~M10: Workspace Auto-Config~~ (CLAUDE.md loading already works, defer MCP)

---

## Pre-M1: Architecture Decisions (0.5 sessions)

**Goal:** Define routing, navigation, and sync patterns before implementation

**Why this is needed:** Original plan missed critical integration points with Craft Agents' navigation system.

### Tasks

#### ✅ Decided
- [x] IPC namespace: Use `notes:*` prefix
- [x] Session ↔ file binding: Explicit attach/detach (revised from "independent" — per-session binding)
- [x] Timeline: Accept 17-22 sessions (realistic)
- [x] File tree phasing: Split M4 into M4a + M4b

#### ✅ Implemented
- [x] Add route stub to `apps/electron/src/shared/routes.ts`:
  ```typescript
  note: (workspaceId: string, filePath: string) =>
    `note/${workspaceId}?path=${encodeURIComponent(filePath)}`
  ```
  **Note:** Actual path is `apps/electron/src/shared/routes.ts` (not `packages/shared/`)
- [x] Design NavigationState extension (`NotesNavigationState` interface + `isNotesNavigation` type guard in types.ts, route parsing/building in route-parser.ts)
- [x] Document auto-save + watcher algorithm (in `tech-infrastructure.md`)
- [ ] Prepare manual tiptap template from docs (fallback if CLI fails) — deferred to M2+M3, will attempt CLI first

### Exit Criteria
✅ Route pattern defined (stub in routes.ts)
✅ Navigation extension documented
✅ Watcher algorithm documented
✅ Manual tiptap template ready

---

## M1: Dependencies & Build Setup

**Goal:** Install tiptap, configure SCSS build

**Spec refs:** [tech-infrastructure.md](tech-infrastructure.md#dependencies-shards-additions)

**Changes from original:**
- ✅ Use existing CSS tokens (no `--shards-*` creation)
- ✅ Test Sass + Tailwind v4 coexistence

### Tasks

- [x] **Install TipTap UI Components dependencies** (required for simple-editor template)
  - Core: `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit`
  - Extensions: `@tiptap/markdown` (note: not `@tiptap/extension-markdown`), `@tiptap/extension-code-block-lowlight`, `@tiptap/extension-placeholder`, `@tiptap/extension-task-list`, `@tiptap/extension-task-item`, `@tiptap/extension-highlight`, `@tiptap/extension-table`, `@tiptap/extension-table-row`, `@tiptap/extension-table-header`, `@tiptap/extension-table-cell`
  - Utilities: `lowlight`, `@floating-ui/dom`, `gray-matter`
- [x] Install dev: `sass-embedded` (required for TipTap UI Component SCSS)
- [x] Update `vite.config.ts`: Add SCSS preprocessor with modern-compiler API
- [x] Verify `tsconfig.json` allows `.scss` imports (added `.scss` module declaration to `vite-env.d.ts`)
- [x] Test Sass + Tailwind v4 coexistence — confirmed via `bunx vite build`
- [x] Validate: `bun install` ✅, `bunx vite build` ✅, lint ✅ (pre-existing upstream TS errors in `packages/shared` — not from our changes)

### Exit Criteria
✅ Dependencies installed
✅ SCSS compilation works
✅ Sass + Tailwind v4 coexist without conflicts
✅ TypeScript types resolve

---

## M2+M3: Editor with File I/O (3 sessions)

**Goal:** tiptap editor with markdown file loading/saving

**Spec refs:** [tech-infrastructure.md](tech-infrastructure.md#tiptap-setup), [tech-infrastructure.md](tech-infrastructure.md#markdown-io)

**Why merged:** Building editor without file I/O risks incompatible hooks. Validate roundtrip from day 1.

### Tasks

#### Types & Atoms
- [x] Add to `shared/types.ts`: `FileNode`, `FileOpenResult`, `ActiveTab`, `MiddlePanelMode`
- [x] Create `atoms/editor.ts`: `currentFilePathAtom`, `frontmatterAtom`, `isDirtyAtom`, `editorWorkspacePathAtom`, `fileTreeAtom`, `fileTreeExpandedAtom`, `activeTabAtom`, `middlePanelModeAtom`
- [x] Add derived atoms: `editorWindowTitleAtom`, `isNoteOpenAtom`

#### File Service (inline in ipc.ts — no separate files.ts)
- [x] Implement `notes:open`: gray-matter parse, return `{ content, frontmatter }`
- [x] Implement `notes:save`: prepend frontmatter, write
- [x] Implement `notes:list`: recursive, filter `.md` + non-dot dirs, hide `CLAUDE.md`/`AGENTS.md`, sort
- [ ] ~~createFile, createDirectory, deleteFile, renameFile~~ — deferred to M4b (scope: editor-only read/write/list)

#### IPC Layer
- [x] Register handlers inline in `main/ipc.ts`: `notes:open`, `notes:save`, `notes:list`
- [x] Extend `preload/index.ts`: `window.electronAPI.notesOpen`, `notesSave`, `notesList`

#### Editor Component
- [x] Scaffold tiptap simple-editor template via CLI (user ran interactively; 29 files scaffolded)
  - Only CSS from template used; own Editor.tsx wrapper built (template had many missing UI deps)
- [x] Create `components/editor/extensions.ts`: StarterKit, Markdown, CodeBlockLowlight, Placeholder, TaskList/Item, Highlight, TableKit
- [x] Create `components/editor/Editor.tsx`:
  - `useEditor` hook with extensions
  - Load file on `currentFilePathAtom` change
  - `onUpdate` → set `isDirty` (with `isLoadingFile` guard)
  - Save handler with frontmatter preservation + concurrent-save guard
  - Auto-save: 1.5s debounce + on blur + Cmd+S
  - 720px max-width content area
- [x] Create `components/editor/editor.css` with custom styles

#### Test Page & Navigation
- [x] Create `pages/EditorTestPage.tsx` (routed + standalone modes)
- [x] Wire into `MainContentPanel.tsx` via `isNotesNavigation` route
- [x] Fix `NavigationContext.tsx` to allow note compound routes through `parseRoute` gate
- [x] Add dev helper (`window.__shards`) for console-based navigation testing
- [x] Create `test-note.md` with frontmatter and complex markdown

#### Validation
- [x] Editor renders with all extensions working
- [x] Open test file → content loads, frontmatter hidden
- [x] Edit + save → changes persist, frontmatter preserved
- [x] Auto-save works (1.5s debounce + blur)
- [x] Cmd+S saves immediately
- [x] Window title shows filename + dirty indicator

### Exit Criteria
✅ Editor renders, extensions work
✅ Open/save .md files with frontmatter
✅ Complex markdown roundtrips without data loss
✅ Auto-save functional
✅ Frontmatter edge cases handled

---

## M4a: Basic File Tree (2 sessions)

**Goal:** File browser with basic navigation

**Spec refs:** [product-design.md](product-design.md#middle-panel--file-tree-by-default), [tech-infrastructure.md](tech-infrastructure.md#filetreetsx--filenodetsx)

**Why split:** File tree is complex. Build basic rendering first, add CRUD separately.

### Tasks

#### Components
- [x] Create `components/filetree/FileNode.tsx`:
  - Hierarchical display with depth indentation
  - Icons: `ChevronRight`/`ChevronDown`, `Folder`/`FolderOpen`, `FileText`
  - Click handlers for files/folders
  - Current file highlighting (muted `bg-foreground/10`)
- [x] Create `components/filetree/FileTree.tsx`:
  - Header: "All Notes" via PanelHeader (in AppShell)
  - Tree rendering with recursion
  - Empty state (using existing `<Empty>` component)
  - Load tree on workspacePath change

#### Features
- [x] Implement file click → `navigate(routes.view.note(workspaceId, filePath))`
- [x] Implement folder collapse/expand → update `fileTreeExpandedAtom`
- [x] Filter: Hide dot-dirs (`.craft-agent`, `.obsidian`, `.git`, `.claude`) — handled by `notes:list` IPC
- [x] Filter: Hide `CLAUDE.md`, `AGENTS.md` — handled by `notes:list` IPC
- [x] Show only `.md` files and directories — handled by `notes:list` IPC

#### Integration
- [x] Add FileTree to layout (temporary test placement in middle panel via AppShell)
- [x] Wire to `notes:list` IPC handler

#### Validation
- [x] Tree shows all `.md` files in workspace
- [x] Folders collapsible/expandable
- [x] Expanded state persists during re-render
- [x] Dot-dirs hidden
- [x] `CLAUDE.md`/`AGENTS.md` hidden
- [x] Click file → navigates to editor (route works)
- [x] Current file highlighted in tree
- [ ] Empty state shows when no files — not manually tested yet

### Exit Criteria
✅ File tree renders correctly
✅ Basic navigation works (click file → opens)
✅ Filtering works (dot-dirs, CLAUDE.md hidden)
✅ Expand/collapse state persists

---

## M4b: File Tree CRUD (2-3 sessions)

**Goal:** Create, rename, delete operations

**Spec refs:** [product-design.md](product-design.md#middle-panel--file-tree-by-default), [tech-infrastructure.md](tech-infrastructure.md#filetreetsx--filenodetsx)

**Why separate:** CRUD operations are complex with validation, error handling, and state management.

### Tasks

#### [+] Button & Context Menu
- [x] Implement [+] dropdown menu: "New Note", "New Folder" — `FileTreeHeaderActions` in AppShell header
- [x] Implement context menu (right-click): "New Note", "New Folder", "Rename", "Delete" — Radix ContextMenu on each FileNode
- [x] Use existing menu components — DropdownMenu + ContextMenu from shadcn/ui

#### New Note/Folder
- [x] Implement "New Note":
  - IPC `notes:create` with `Untitled.md` (existence check, unique name generation)
  - Refresh tree
  - Activate RenameDialog (chose dialog over inline input)
- [x] Implement "New Folder":
  - IPC `notes:create-dir` with `Untitled`
  - Refresh tree, expand parent
  - Activate RenameDialog

#### Rename (RenameDialog, not inline)
- [x] Double-click file/folder → opens RenameDialog
- [x] Auto-append `.md` for files (on confirm)
- [x] Validation:
  - No empty names (toast error)
  - No `/` or `\` in name
  - Existence check in IPC handler (prevents duplicates)
- [x] Enter confirms, Esc/Cancel cancels
- [x] Call `notes:rename` on confirm
- [x] Refresh tree, preserve expanded state
- [x] If renamed file was open → navigate to new path

#### Delete
- [x] Implement delete:
  - Native `dialog.showMessageBox` confirmation ("Move to Trash")
  - `shell.trashItem` (safe, reversible)
  - Refresh tree
  - If deleted file was open → `setCurrentFilePath(null)`

#### Tree Refresh
- [x] Implement refresh logic that preserves expanded folders state (via `fileTreeExpandedAtom`)
- [ ] Debounce multiple rapid refreshes (100ms) — deferred, not needed yet

#### Validation
- [x] New Note creates `Untitled.md`, rename dialog active
- [x] New Folder creates `Untitled`, rename dialog active
- [x] Rename works, `.md` auto-appended for files
- [x] Rename validation prevents empty/invalid/duplicate names
- [x] Delete confirmation shows
- [x] Delete moves to system Trash
- [x] Delete clears editor if open file deleted
- [x] Tree refreshes after all operations
- [x] Expanded folders stay expanded after refresh
- [x] No duplicate files/folders created
- [x] Error handling via toast notifications

### Exit Criteria
✅ Create new notes/folders
✅ Rename with validation
✅ Delete with Trash
✅ Tree state persists across operations
✅ Error handling graceful

---

## M5: Layout Integration (2 sessions)

**Goal:** Three-panel layout where notes and sessions each work independently

**Spec refs:** [product-design.md](product-design.md#layout), [tech-infrastructure.md](tech-infrastructure.md#layout--view-system)

**REVISED (Session 3 reset):** Original M5 tried to build a complex atom-based view system with attach/detach, ViewTabs, session-note bindings, and 3-mode rendering. This got off-track — broken atoms, missing state, non-compiling code. Reset to use the existing NavigationState routing system instead. Session-note connection (attach/detach, Note+Chat mode) deferred to a new M5b milestone.

### Tasks

#### Navigation Integration (via NavigationState routing)
- [x] `routes.view.note()` exists from Pre-M1
- [x] `MainContentPanel.tsx` routes notes via `isNotesNavigation(navState)` → `EditorTestPage`
- [x] `FileTree` click → `navigate(routes.view.note(workspaceId, filePath))` + sets `currentFilePathAtom`
- [x] Session navigation untouched — existing Craft Agents routing works as-is

#### Middle Panel Toggle
- [x] Wire `middlePanelModeAtom`:
  - `'filetree'` → show `FileTree` component
  - `'sessions'` → show existing `SessionList` component
- [x] Default to `'filetree'` (note-centric default)

#### Left Sidebar Extension
- [x] Add "All Notes" item (sets `middlePanelMode='filetree'`)
- [x] Wire existing "All Sessions" to set `middlePanelMode='sessions'`
- [ ] Add "+ New Note" button — deferred to M8 (polish)

#### App Shell Update
- [x] Modify `AppShell.tsx` layout:
  - Left sidebar (existing, extended with "All Notes")
  - Middle panel (toggle: FileTree / SessionList via middlePanelModeAtom)
  - Right panel (NavigationState-driven: note or session content)

#### Validation
- [x] Clicking "All Notes" → middle panel shows file tree
- [x] Clicking "All Sessions" → middle panel shows session list
- [x] Open note from file tree → editor renders in right panel
- [x] Click a session → chat renders in right panel (existing flow, no regression)
- [x] Layout responsive, no overflow
- [x] **Critical:** Chat/sessions work exactly like existing Craft Agents (no regressions)
- [x] **Critical:** Can use sessions independently without ever touching notes

### Exit Criteria
✅ Three-panel layout works
✅ Middle panel toggles correctly
✅ Note navigation works (file tree → editor)
✅ Session navigation works (session list → chat)
✅ No Craft Agents regressions

---

---

## M6: Agent Sync (2-3 sessions)

**Goal:** File watcher with race condition prevention

**Spec refs:** [tech-agents.md](tech-agents.md#agent---editor-sync), [tech-infrastructure.md](tech-infrastructure.md#file-service-appselectronsrcmainservicesfilests)

**Why +1 session:** Race condition testing and timestamp tracking add complexity.

### Tasks

#### File Watcher
- [ ] Add to `main/services/files.ts`: `watchDirectory(dir, window)`
  - Use `fs.watch` with `recursive: true`
  - Implement debounce (100ms for rapid changes)
  - **Track own write timestamps** (Map<filePath, timestamp>)
  - **Ignore own writes** (if timestamp < 500ms ago)
  - Emit `notes:changed` event with `{ path }` for `.md` file changes
  - Emit `notes:tree-changed` event for directory structure changes
- [ ] Implement `unwatchDirectory()`

#### IPC Events
- [ ] Update `main/ipc.ts`:
  - Start watching on `workspace:open`
  - Stop watching on `workspace:close`
- [ ] Add preload listeners in `preload/index.ts`:
  - `notes.onChanged(callback)` → returns unsubscribe function
  - `notes.onTreeChanged(callback)` → returns unsubscribe function

#### Editor Integration
- [ ] Add `useEffect` in `Editor.tsx`:
  - Subscribe to `notes:changed` events
  - On event for current file:
    1. Check if `isDirty`
    2. If dirty: call save handler, wait for completion
    3. Reload file content via `notes:open`
    4. Update editor content
    5. Clear `isDirty`
  - Unsubscribe on unmount

#### File Tree Integration
- [ ] Add `useEffect` in `FileTree.tsx`:
  - Subscribe to `notes:tree-changed` events
  - On event: refresh tree, preserve `fileTreeExpandedAtom` state
  - Unsubscribe on unmount

#### Race Condition Algorithm Implementation
```
1. Main process tracks: lastWriteTimestamps = Map<filePath, timestamp>
2. On editor change:
   - Set isDirty = true
   - Start 1.5s debounce timer
3. On fs.watch event:
   a. Check if lastWriteTimestamps.get(path) within 500ms → IGNORE (own write)
   b. Otherwise:
      - If editor has this file open AND isDirty:
        1. await saveFile()
        2. reload file
      - Else if editor has this file open:
        1. reload file immediately
      - Emit notes:changed or notes:tree-changed
4. On save (notes:save):
   - Record lastWriteTimestamps.set(path, Date.now())
   - Write file
```

#### Validation (Critical Tests)
- [ ] **Test: Agent writes file while editor dirty**
  1. Open file in editor
  2. Type changes (isDirty = true)
  3. Agent uses Write tool on same file
  4. Verify: editor auto-saves first, then reloads
  5. Verify: no data loss
- [ ] **Test: Agent writes file while editor clean**
  1. Open file in editor
  2. Agent uses Write tool
  3. Verify: editor reloads silently
  4. Verify: no "file changed" dialogs
- [ ] **Test: Rapid agent writes**
  1. Agent writes file 3 times in quick succession
  2. Verify: debounce works, only final state loaded
  3. Verify: no duplicate reloads
- [ ] **Test: External app edits file**
  1. Open file in editor
  2. Edit in external app (VSCode, TextEdit)
  3. Verify: editor reloads
- [ ] **Test: Agent creates file**
  1. Agent uses Write tool to create new file
  2. Verify: file tree refreshes
  3. Verify: new file appears
- [ ] **Test: Agent deletes file**
  1. Open file in editor
  2. Agent uses Bash `rm` command
  3. Verify: tree refreshes, editor clears
- [ ] **Test: Expanded folders persist**
  1. Expand several folders in tree
  2. Agent creates file
  3. Verify: tree refreshes, expanded state unchanged
- [ ] **Test: No duplicate events**
  1. Save file via editor
  2. Verify: watcher event ignored (own write timestamp)
  3. Verify: no reload loop

### Exit Criteria
✅ File watcher detects changes
✅ Editor auto-reloads on external changes
✅ Tree auto-refreshes on structure changes
✅ Race conditions handled (no data loss)
✅ Own writes ignored (no reload loop)
✅ All validation tests pass

---

## M7: Note+Chat Mode (3-4 sessions)

**Goal:** The core Shards experience — attach a note to a session, dual-view with tabs, auto-tagging, chat input bar

**Spec refs:** [product-design.md](product-design.md#notechat-note-attached-to-session--the-core-shards-experience), [product-design.md](product-design.md#right-panel--three-modes), [tech-agents.md](tech-agents.md#auto-tagging-notechat-mode), [tech-infrastructure.md](tech-infrastructure.md#layout--view-system)

**Why merged (was M5b + old M7):** Attach/detach without auto-tagging is useless. Auto-tagging without attach/detach can't exist. They're the same user-facing feature — the Note+Chat experience.

**Note:** Mention system already exists (`useInlineMention` hook), just wire to auto-tagging.

### Tasks

#### Session-Note Binding State
- [ ] Add `sessionNoteBindingAtom` to `atoms/editor.ts`: `Map<sessionId, filePath>` — per-session note binding
- [ ] Add `activeNoteViewTabAtom` to `atoms/editor.ts`: `'noteChat' | 'chatHistory'`
- [ ] Wire session selection to check note binding:
  - Selecting a session with bound note → show Note+Chat
  - Selecting a session without bound note → show Chat Alone

#### View Tabs Component
- [ ] Create `components/app-shell/ViewTabs.tsx`:
  - Tabs: [Note+Chat] [Chat History]
  - Read/write `activeNoteViewTabAtom`
  - Only show when session has a bound note

#### Three-Mode Right Panel
- [ ] Update `MainContentPanel.tsx` for three-mode rendering:
  - Session + bound note → ViewTabs + Editor/ChatPage (based on active tab)
  - Session + no bound note → Chat Alone (existing ChatPage, unchanged)
  - Note only (no session) → full-height Editor
  - Fallback → empty state

#### Attach/Detach Actions
- [ ] Implement `attachNoteToSession(sessionId, filePath)`:
  - Updates `sessionNoteBindingAtom`
  - Sets `currentFilePathAtom` to the note
  - Sets `activeNoteViewTabAtom` to `'noteChat'`
- [ ] Implement `detachNoteFromSession(sessionId)`:
  - Removes binding from `sessionNoteBindingAtom`
  - Note stays in `currentFilePathAtom` (Note Alone mode)
- [ ] "Start chat" from Note Alone:
  - Creates new session via `onCreateSession`
  - Auto-attaches current note to the new session
- [ ] "Detach note" action in Note+Chat header
- [ ] "Close chat" action in Note+Chat header (deselects session → Note Alone)

#### Chat Input Bar
- [ ] Create `components/chat/ChatInputBar.tsx`:
  - Compact input at editor bottom (in Note+Chat mode)
  - Placeholder: `Ask Claude about ${filename}` when note attached
  - Reuse existing `FreeFormInput` component

#### Auto-Save Before Send
- [ ] In ChatInputBar: before sending message
  - Check `isDirtyAtom`
  - If dirty: save via `notes:save`, clear `isDirty`
  - Wait for save completion before sending

#### Auto-Tagging
- [ ] In sendMessage handler:
  - Get bound note from `sessionNoteBindingAtom` for current session
  - If bound note exists: add `[file:${boundNotePath}]` to message mentions
  - Send through existing Craft Agents `sendMessage` flow
  - Mentions parsed automatically by `lib/mentions.ts`

#### `/attach-note` Command
- [ ] Register `/attach-note` slash command in chat input:
  - If note currently open → attach to current session
  - If no note open → prompt user to open one
  - Updates `sessionNoteBindingAtom`, switches to Note+Chat

#### Validation
- [ ] Open note, "Start chat" → Note+Chat mode with tabs
- [ ] [Note+Chat] tab shows editor + chat input bar
- [ ] [Chat History] tab shows full chat (existing ChatPage)
- [ ] "Detach note" → session becomes Chat Alone, note stays Note Alone
- [ ] Select session with bound note → Note+Chat (tabs appear)
- [ ] Select session without bound note → Chat Alone (no tabs)
- [ ] Send message in Note+Chat → auto-tags bound note `[file:path]`
- [ ] Auto-save fires before send when editor is dirty
- [ ] `/attach-note` attaches current note to session
- [ ] Manual `@` file mentions still work
- [ ] **Critical:** Chat Alone mode works exactly like existing Craft Agents (no regressions)

### Exit Criteria
✅ Attach/detach works
✅ ViewTabs toggle between Note+Chat and Chat History
✅ Three-mode rendering correct
✅ Auto-tagging works (bound note in mentions)
✅ Auto-save before send
✅ ChatInputBar functional
✅ No Craft Agents regressions

---

## M8: UI Tuning & Refinement (2-3 sessions)

**Goal:** User-driven UI tweaks, layout adjustments, visual consistency

**Why this exists:** After the core features are built (M5-M7), there will be UI feedback — spacing, sizing, visual polish, interaction feel. This milestone captures those changes before the final technical polish pass.

### Tasks

_Tasks will be added based on user feedback during validation of M5-M7. Examples of what goes here:_
- Layout spacing and sizing adjustments
- Visual consistency between file tree, editor, and chat panels
- Interaction improvements (hover states, transitions, focus behavior)
- Typography and readability tuning
- Panel resizing behavior
- Empty state improvements
- Any UI change that isn't a new feature or a bug fix

### Exit Criteria
✅ User-identified UI issues addressed
✅ Visual consistency across all panels
✅ Interactions feel polished and intentional

---

## M9: Polish & Shortcuts (2 sessions)

**Goal:** Keyboard shortcuts, error handling, final UX polish

**Spec refs:** [product-design.md](product-design.md#keyboard-shortcuts), [tech-infrastructure.md](tech-infrastructure.md#keyboard-shortcut-implementation)

### Tasks

#### Keyboard Shortcuts
- [ ] Add Electron accelerators in `main/index.ts` (or menu setup):
  - Cmd+N → new note
  - Cmd+S → save note
  - Cmd+E → toggle view (Note ↔ Chat)
  - Cmd+W → close note
  - Cmd+Shift+\ → toggle middle panel
  - Cmd+1 → show sessions
  - Cmd+2 → show file tree
- [ ] Wire handlers in renderer:
  - Subscribe to `shortcut:*` IPC events
  - Call appropriate atom setters or functions
- [ ] Verify existing shortcuts still work:
  - Cmd+Shift+N → new session
  - Other Craft Agents shortcuts

#### Error Handling
- [ ] File not found:
  - Show toast notification
  - Clear editor
  - Remove from file tree (if stale)
- [ ] Permission denied:
  - Show toast with error message
  - Keep editor dirty (don't lose changes)
  - Offer "Save As" option
- [ ] Workspace not accessible:
  - Show empty state with "Open Workspace" button
- [ ] Frontmatter parse error:
  - Log warning to console
  - Treat as no frontmatter
  - Continue loading file
- [ ] File watcher error:
  - Log warning
  - Continue without live reload
  - Show manual refresh button

#### Settings Integration
- [ ] Add to Settings page (if one exists):
  - Auto-save toggle (default: on)
  - Auto-save delay (default: 1.5s)

#### Window Title
- [ ] Wire `editorWindowTitleAtom` to document title or IPC `setWindowTitle`
- [ ] Update on `currentFilePathAtom` or `isDirtyAtom` change
- [ ] Format: `${filename}${isDirty ? ' •' : ''} - Shards`

#### Empty States
- [ ] No workspace:
  - Show "Create or open a workspace" prompt
  - Reuse existing workspace setup flow
- [ ] Empty workspace:
  - Show "Create your first note" with "+ New Note" button
  - Helpful illustration (use existing `<Empty>` component)
- [ ] No file open:
  - Show placeholder or recent notes list (optional)

#### Theming
- [ ] Verify existing CSS tokens work in dark/light mode:
  - `--background`, `--foreground`, `--border`, `--accent`
- [ ] Test editor theming:
  - Text color, background, selection, cursor
  - Code block syntax highlighting
- [ ] Test file tree theming:
  - Hover state, selected file, expanded folder icon
- [ ] Test tiptap toolbar/bubble menu theming (if applicable)

#### Mode Transitions Testing
- [ ] Test all scenarios from [product-design.md Mode Transitions table](product-design.md#mode-transitions):
  - No workspace → Create workspace → New note
  - Open note → Start session → Note+Chat mode
  - Switch between Note and Chat tabs
  - Close note, close session, etc.
- [ ] Verify no regressions in existing Craft Agents features:
  - Chat-only mode still works
  - Session management unchanged
  - Skills, sources, settings all functional

#### Performance Testing
- [ ] Typing in long doc (>10,000 words) → no lag
- [ ] Rapid file switching (10+ files) → smooth
- [ ] Large file tree (100+ files) → renders quickly
- [ ] Auto-save doesn't block UI

#### Final Validation
- [ ] All shortcuts work
- [ ] Errors handled gracefully (no crashes)
- [ ] Settings page integrated (if applicable)
- [ ] Window title updates correctly
- [ ] Empty states helpful and clear
- [ ] Theme switching works (light/dark)
- [ ] Mode transitions correct
- [ ] No console errors or warnings
- [ ] Performance smooth (daily-driver quality)

### Exit Criteria
✅ All shortcuts implemented
✅ Error handling complete
✅ Settings integrated
✅ Theming polished
✅ Daily-driver quality achieved

---

## Deferred to Post-MVP

**Not in 18-23 session plan:**

- ~~M9: @ Mention System~~ (already exists via `useInlineMention`, verified in M7)
- ~~M10: Workspace Auto-Config~~ (`CLAUDE.md` loading already works, MCP auto-detection deferred)
- **Future features** (from specs, not blocking MVP):
  - Backlinks panel
  - Note templates
  - Full-text search
  - Cmd+P quick switcher
  - Pinned notes
  - Diff view (editor ↔ chat edits)
  - Multi-file tabs
  - PDF export
  - Frontmatter UI editor
  - Drag-drop file attachment

---

## Dependencies & Critical Path

| Milestone | Requires | Blocks | Can Run Parallel With |
|-----------|----------|--------|----------------------|
| Pre-M1 | - | M1-M9 | - |
| M1 | Pre-M1 | M2+M3 | - |
| M2+M3 | M1 | M4a, M4b, M6, M7 | - |
| M4a | M2+M3 | M4b, M5 | - |
| M4b | M4a | - | M5, M6 (can overlap) |
| M5 | M4a | M7, M8 | M4b, M6 |
| M6 | M2+M3, M4a | - | M5, M7 |
| M7 | M5 | M8, M9 | M6 |
| M8 | M5 through M7 | M9 | - |
| M9 | M8 | - | - |

**Critical Path:** Pre-M1 → M1 → M2+M3 → M4a → M5 → M7 → M8 → M9

**Recommended order:** M5 (validate) → M6 (agent sync) → M7 (Note+Chat) → M8 (UI tuning) → M9 (polish). M6 is independent infrastructure that benefits M7, so do it first.

---

## Validation Strategy

### Per-Milestone
- [ ] Complete all tasks
- [ ] Check all validation criteria
- [ ] Test dark mode + light mode
- [ ] Test empty workspace + populated workspace
- [ ] Check for console errors/warnings
- [ ] Verify no Craft Agents regressions (existing features work)
- [ ] Document any deviations or blockers

### Integration Testing (After M8)

**New User Flow (Note-first):**
1. Launch app (no workspace)
2. Create workspace (choose folder)
3. Create first note (Cmd+N)
4. Edit note, auto-save works → Note Alone mode
5. "Start chat" → creates session with note attached → Note+Chat mode
6. Send message from ChatInputBar (auto-tags bound note)
7. Agent reads note (auto-tagging)
8. Agent edits note (Write tool)
9. Editor reloads with changes

**Chat-first Flow (existing users):**
1. Open app, click "All Sessions"
2. Create new session (Cmd+Shift+N) → Chat Alone mode
3. Chat normally — no notes involved
4. Optionally: `/attach-note` → attaches a note → Note+Chat mode
5. "Detach note" → back to Chat Alone

**Existing Folder Flow:**
1. Open existing folder with `.md` files
2. Browse file tree (All Notes)
3. Open note, edit, save → Note Alone
4. Switch to another note
5. Create new note, rename, delete

**Agent Workflow:**
1. Open note, "Start chat" → Note+Chat mode
2. Ask agent to summarize note (auto-tagged via binding)
3. Verify auto-tagging sent `[file:path]`
4. Ask agent to edit note (Write tool)
5. Editor reloads with agent's changes
6. Switch to Chat History tab (Cmd+E), view history
7. Switch back to Note+Chat tab
8. "Detach note" → Chat Alone continues, note stays open
9. Agent creates new file → file tree refreshes

**Keyboard Navigation:**
- Cmd+N (new note), Cmd+E (toggle tabs), Cmd+1/2 (panels), Cmd+S (save), Cmd+W (close)

**Error Handling:**
- Non-existent file, permission denied, external edits, conflict resolution

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| tiptap CLI scaffolding fails | Medium | Low | Prepare manual template from tiptap docs |
| Markdown roundtrip loses formatting | Medium | High | Extensive testing in M2+M3, document limitations |
| Craft Agents layout hard to extend | Medium | High | Study AppShell thoroughly, keep changes additive |
| File watcher race conditions | Medium | High | Implement timestamp tracking, dedicated tests |
| Frontmatter corruption | Low | High | Extensive edge case testing, validate byte 0 position |
| Navigation integration breaks routing | Low | Medium | Test with existing routes, have query param fallback |
| Auto-save + agent writes conflict | Medium | High | Algorithm with timestamps, validation tests |

---

## KISS Violations Avoided

✅ **Merged M2+M3** - Build editor with file I/O from start, avoid fragile split
✅ **Use existing CSS tokens** - No unnecessary `--shards-*` namespace
✅ **Use existing mention system** - Don't rebuild `useInlineMention` hook
✅ **Session ↔ file explicit binding** - Per-session Map atom, no global coupling
✅ **Single file metadata atom** - Not separate `frontmatterAtom`, simpler state
✅ **Workspace root as notes folder** - No extra `notes/` subfolder
✅ **Eliminated M9/M10** - Don't rebuild what exists, defer optional features

---

## Session Planning

**Estimated breakdown:**

- **Session 1:** Pre-M1 (0.5) + M1 (1) = 1.5 sessions ✅
- **Sessions 2-4:** M2+M3 (editor + file I/O) = 3 sessions ✅
- **Sessions 5-6:** M4a (basic tree) = 2 sessions ✅
- **Sessions 7-9:** M4b (tree CRUD) = 2-3 sessions ✅
- **Sessions 10-11:** M5 (layout + navigation) = 2 sessions ← current (needs validation)
- **Sessions 12-14:** M6 (agent sync / file watcher) = 2-3 sessions
- **Sessions 15-18:** M7 (Note+Chat mode) = 3-4 sessions
- **Sessions 19-21:** M8 (UI tuning & refinement) = 2-3 sessions
- **Sessions 22-23:** M9 (polish & shortcuts) = 2 sessions

**Total: 20-26 sessions**

**Between sessions:**
- Document deviations from plan
- Update task checklists
- Note blockers or risks discovered
- Adjust estimates if needed

---

## Success Criteria

Shards MVP is complete when:

✅ Pre-M1 through M9 complete
✅ Create/edit/save markdown notes
✅ File tree browsing with create/rename/delete
✅ Agent can read/write notes, editor reloads live
✅ Note+Chat auto-tagging works
✅ Three-panel layout functional
✅ Keyboard shortcuts work
✅ Dark/light theme works
✅ No console errors
✅ No Craft Agents regressions
✅ Daily-driver quality (smooth, reliable)

---

## Status Tracking

| Milestone | Status | Completed | Sessions Used | Notes |
|-----------|--------|-----------|---------------|-------|
| Pre-M1 | ✅ Complete | 2026-02-16 | 0.5 / 0.5 | Route stub, NavigationState, auto-save algorithm |
| M1 | ✅ Complete | 2026-02-16 | 0.5 / 1 | Deps installed, SCSS configured, build verified |
| M2+M3 | ✅ Complete | 2026-02-16 | 2 / 3 | Editor + File I/O — inline in ipc.ts, no separate files.ts. CRUD deferred to M4b. |
| M4a | ✅ Complete | 2026-02-16 | 0.5 / 2 | FileNode.tsx + FileTree.tsx, wired into AppShell middle panel. Muted selection highlight. |
| M4b | ✅ Complete | 2026-02-16 | 1 / 2-3 | CRUD: create, rename (RenameDialog), delete (shell.trashItem). Context menu on dirs/files, [+] header button. |
| M5 | ✅ Complete | 2026-02-17 | 2 / 2 | Layout integration with clean NavigationState routing. Middle panel toggle, "All Notes" sidebar, restore-last-note on switch. |
| M6 | ⬜ Not Started | - | 0 / 2-3 | Agent sync (file watcher, live reload). Independent infrastructure — no Note+Chat dependency. |
| M7 | ⬜ Not Started | - | 0 / 3-4 | Note+Chat mode (merged old M5b + old M7). Attach/detach, ViewTabs, auto-tagging, ChatInputBar. |
| M8 | ⬜ Not Started | - | 0 / 2-3 | UI tuning & refinement. User-driven UI tweaks after M5-M7 validation. |
| M9 | ⬜ Not Started | - | 0 / 2 | Polish & shortcuts (was M8). |

**Total Sessions Used:** 6.5 / 20-26

**Last Updated:** 2026-02-17
**Next Milestone:** M6 (Agent Sync)
**Recommended order:** M6 (agent sync) → M7 (Note+Chat) → M8 (UI tuning) → M9 (polish)
**Status:** M5 validated and complete. Next up: M6 (file watcher, live reload, race conditions).
