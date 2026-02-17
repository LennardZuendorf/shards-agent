---
type: branch
parent: tech.md
scope: technical-implementation
covers: tiptap setup, extension stack, editor components, markdown I/O, file I/O service, IPC channels, preload bridge, shared types, Jotai atoms, theming bridge, layout & view system, keyboard shortcuts
updated: 2026-02-12
---

# Infrastructure & Editor Implementation

All technical implementation details for Shards: tiptap editor setup, layout & view system, file I/O service, IPC channels, preload bridge, state management, and theming.

**Parent:** [tech.md](tech.md) | **Sibling:** [tech-agents.md](tech-agents.md)

**UX specs:** For what the editor looks like and how it behaves, see [product-design.md](product-design.md).

For Craft Agents base infrastructure, see: `apps/electron/AGENTS.md`, `packages/shared/AGENTS.md`, `packages/core/CLAUDE.md`.

---

## Dependencies (Shards additions)

```bash
# Editor core
bun add @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/markdown

# Extensions (all free/MIT)
bun add @tiptap/extension-code-block-lowlight lowlight
bun add @tiptap/extension-placeholder
bun add @tiptap/extension-task-list @tiptap/extension-task-item
bun add @tiptap/extension-highlight
bun add @tiptap/extension-table
bun add @floating-ui/dom

# Frontmatter
bun add gray-matter

# Dev
bun add -D sass-embedded
```

---

## tiptap Setup

### Template: TipTap Simple Editor

**REQUIRED:** Use the official TipTap simple-editor template as the foundation.

**Template:** https://tiptap.dev/docs/ui-components/templates/simple-editor

**UI Components:** https://tiptap.dev/docs/ui-components/components/overview

### Scaffolding

Install the simple-editor template using TipTap CLI:

```bash
npx @tiptap/cli@latest add simple-editor -p apps/electron/src/renderer/components/tiptap
```

This scaffolds:
- EditorContent component with toolbar and bubble menu
- Pre-configured UI components (Toolbar, BubbleMenu, SlashCommands)
- SCSS stylesheets for all components
- Extension configuration

**If CLI fails:** Manually copy template from https://tiptap.dev/docs/ui-components/templates/simple-editor and adjust imports.

### Critical: Use Template Components As-Is

**DO NOT custom-build editor UI.** The template provides production-ready components:
- ✅ Toolbar with formatting buttons
- ✅ Bubble menu for text selection
- ✅ Slash commands for quick actions
- ✅ Pre-styled with SCSS

**Our job:** Wire the template to Craft Agents' atoms and file I/O. Do not replace the UI components.

### Extension Stack

```typescript
// apps/electron/src/renderer/components/editor/extensions.ts
import StarterKit from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import TableKit from '@tiptap/extension-table'
import { lowlight } from 'lowlight'

export const editorExtensions = [
  StarterKit.configure({
    codeBlock: false, // replaced by CodeBlockLowlight
  }),

  Markdown.configure({
    markedOptions: { gfm: true, breaks: false },
  }),

  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'plaintext',
  }),

  Placeholder.configure({
    placeholder: 'Start writing...',
  }),

  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight.configure({ multicolor: true }),
  TableKit.configure({ resizable: true }),
]
```

### Extension Reference

| Extension | Purpose | Config notes |
|-----------|---------|-------------|
| **StarterKit** | Core editing (Blockquote, BulletList, CodeBlock, Document, HardBreak, Heading, HorizontalRule, ListItem, OrderedList, Paragraph, Text, Bold, Code, Italic, Link, Strike, Underline, Dropcursor, Gapcursor, UndoRedo, ListKeymap, TrailingNode) | `codeBlock: false` to avoid conflict |
| **Markdown** | Parse/serialize markdown via MarkedJS | `gfm: true` for tables, task lists, strikethrough |
| **CodeBlockLowlight** | Syntax highlighting in code blocks | All languages via `lowlight` |
| **Placeholder** | "Start writing..." on empty editor | Simple string placeholder |
| **TaskList + TaskItem** | Checkbox lists (`- [ ]` / `- [x]`) | `nested: true` for sub-tasks |
| **Highlight** | Text highlighting `<mark>` | `multicolor: true` |
| **TableKit** | Tables (Table + TableRow + TableHeader + TableCell) | `resizable: true` |

### Styling

**TipTap UI Components use SCSS** (included in simple-editor template). Craft Agents uses Tailwind v4. They coexist via shared CSS custom properties.

Reference: https://tiptap.dev/docs/ui-components/getting-started/style

The template's SCSS files are auto-configured. We only patch `_variables.scss` to use Craft Agents' theme tokens. See Theming Bridge section.

---

## Editor Components

### Editor.tsx

**Wrap the simple-editor template components.** Do NOT rebuild the UI.

```typescript
// apps/electron/src/renderer/components/editor/Editor.tsx
import { useEditor } from '@tiptap/react'
import { useAtom } from 'jotai'
import { editorExtensions } from './extensions'
import { isDirtyAtom, currentFilePathAtom, frontmatterAtom } from '../../atoms/editor'

// Import scaffolded template components (from simple-editor)
import { SimpleEditor } from '../tiptap/simple-editor'  // or whatever the template exports

export const Editor = () => {
  const [currentFile] = useAtom(currentFilePathAtom)
  const [, setDirty] = useAtom(isDirtyAtom)

  const editor = useEditor({
    extensions: editorExtensions,
    content: '',
    contentType: 'markdown',
    onUpdate: () => setDirty(true),
  })

  // Load file content when currentFile changes
  // useEffect that calls window.electronAPI.notes.open

  // Save handler (Cmd+S triggers this via IPC)
  // reads editor.getMarkdown(), calls notes.save with frontmatter

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Use the scaffolded simple-editor template component */}
      {/* It includes: Toolbar, BubbleMenu, EditorContent, SlashCommands */}
      <SimpleEditor editor={editor} />
      {/* Or use individual components from template: */}
      {/* <Toolbar editor={editor} /> */}
      {/* <BubbleMenu editor={editor} /> */}
      {/* <EditorContent editor={editor} className="max-w-[720px] mx-auto" /> */}
    </div>
  )
}
```

**Critical:** Use the template's `<SimpleEditor>` component (or its individual components like `<Toolbar>`, `<BubbleMenu>`, `<EditorContent>`). Reference: https://tiptap.dev/docs/ui-components/templates/simple-editor

### FileTree.tsx / FileNode.tsx

New components: `apps/electron/src/renderer/components/filetree/FileTree.tsx` and `FileNode.tsx`

**FileTree:** Shows workspace folder contents recursively. Header with "All Notes" + [+] button for New Note / New Folder dropdown.

**FileNode:** Renders a single file or folder item. Indented by depth. Icons for folder (open/closed) and document. Truncated filenames with ellipsis.

**Behavior:**
- Hierarchical folder structure, collapsible
- Only `.md` files and non-dot directories visible. Dot-directories (`.craft-agent/`, `.obsidian/`, etc.) and `CLAUDE.md`/`AGENTS.md` files are hidden
- Sorted alphabetically: directories first, then files
- Click file -> open in editor (auto-saves current note first)
- Current file highlighted with accent background
- Right-click context menu: New Note, New Folder, Rename, Delete

---

## Layout & View System

### Middle Panel Switching

The middle panel shows either the **file tree** or the **session list**. Controlled by `middlePanelModeAtom`.

```typescript
// Left sidebar items control what shows in the middle panel:
// - "All Notes" -> middlePanelMode = 'filetree'
// - "All Sessions" / Flagged / Status / Label -> middlePanelMode = 'sessions'
```

Default on app launch: `'filetree'` (note-centric by default).

### Session-Note Binding

Sessions and notes are independent by default. The user explicitly attaches/detaches them.

```typescript
// Per-session note binding — stored as a Jotai atom map
// Maps sessionId -> filePath (or null if no note attached)
export const sessionNoteBindingAtom = atom<Map<string, string>>(new Map())

// Helper: get the bound note for the currently selected session
export const currentSessionNoteAtom = atom((get) => {
  const sessionId = get(selectedSessionIdAtom)  // from useSession
  if (!sessionId) return null
  return get(sessionNoteBindingAtom).get(sessionId) ?? null
})
```

**Binding lifecycle:**
- `attachNote(sessionId, filePath)` — binds a note to a session
- `detachNote(sessionId)` — removes the binding
- When selecting a session, check its binding to determine the right panel mode
- Binding persists in memory for the session lifetime (not saved to disk for MVP)

### Right Panel — Three Modes

The right panel renders one of three modes based on state:

```typescript
type RightPanelMode = 'noteAlone' | 'chatAlone' | 'noteChat'
```

**Mode determination logic (in MainContentPanel):**

```typescript
// 1. Settings/Sources/Skills navigation overrides everything (existing)
// 2. If a session is selected AND it has a bound note → 'noteChat'
// 3. If a session is selected AND no bound note → 'chatAlone'
// 4. If no session but a note is open (currentFilePathAtom) → 'noteAlone'
// 5. Fallback: empty state
```

### View Toggle (Note+Chat mode only)

Two tabs: **[Note+Chat] [Chat History]**. Controlled by `activeTabAtom`.

```typescript
type ActiveTab = 'noteChat' | 'chatHistory'
```

- `'noteChat'` — Editor with chat input bar at bottom
- `'chatHistory'` — Full-height chat (existing ChatPage)

Tabs only appear in Note+Chat mode. Note Alone and Chat Alone show no tabs.

### Tab Component

```typescript
// apps/electron/src/renderer/components/app-shell/ViewTabs.tsx
// Two text tabs: [Note+Chat] [Chat History]
// Reads/writes activeTabAtom
// Only renders when session has a bound note
// Cmd+E toggles between tabs
```

### Note+Chat Layout

When the Note+Chat tab is active:

```
┌─────────────────────────────────┐
│ [Note+Chat] [Chat History]      │  <- tabs
│                  filename.md  * │  <- filename + dirty
├─────────────────────────────────┤
│ [EditorToolbar]                 │
├─────────────────────────────────┤
│                                 │
│ Editor content (flex-1)         │
│                                 │
├─────────────────────────────────┤
│ Ask Claude about filename.md    │
│ [Message input...]     [Send]   │
└─────────────────────────────────┘
```

The chat input bar is the existing Craft Agents chat input component, positioned at the bottom.

---

## Markdown I/O

### Loading a File

```typescript
const { content, frontmatter } = await window.electronAPI.notes.open(filePath)
setFrontmatter(frontmatter)
editor.commands.setContent(content, { contentType: 'markdown' })
setDirty(false)
```

### Saving a File

```typescript
const markdown = editor.getMarkdown()
const frontmatter = getFrontmatter()  // from Jotai atom
await window.electronAPI.notes.save(currentFilePath, markdown, frontmatter)
setDirty(false)
```

### Frontmatter Handling

`@tiptap/markdown` does not support YAML frontmatter. Handled at the service layer:

- **On read:** `gray-matter` strips frontmatter -> `{ content, frontmatter }` sent to renderer
- **In renderer:** `frontmatterAtom` stores the raw frontmatter string
- **On save:** frontmatter re-prepended before writing to disk
- **Editor never sees frontmatter**

### Roundtrip Notes

- GFM enabled: tables, task lists, strikethrough all roundtrip
- Table cells limited to one paragraph (MarkedJS limitation)
- Code blocks preserve language tags

---

## File Service (`apps/electron/src/main/services/files.ts`)

New service module in main process.

**Methods:**

| Method | Args | Returns | Description |
|--------|------|---------|-------------|
| `readFile` | `path` | `{ content, frontmatter }` | Read `.md`, strip frontmatter via `gray-matter` |
| `writeFile` | `path, content, frontmatter` | `void` | Re-prepend frontmatter, write to disk |
| `listDirectory` | `dir` | `FileNode[]` | Recursive readdir, `.md` files + non-dot directories. Hides dot-dirs and CLAUDE.md/AGENTS.md |
| `createFile` | `dir, name` | `string` (path) | Create new `.md` file, return path |
| `createDirectory` | `dir, name` | `string` (path) | Create new folder, return path |
| `deleteFile` | `path` | `void` | Move to Trash via `shell.trashItem` |
| `renameFile` | `old, new` | `void` | Rename/move file |
| `watchDirectory` | `dir` | — | Watch workspace dir, emit `notes:changed` / `notes:tree-changed` |

**Frontmatter:** Uses `gray-matter`. Only treats frontmatter as valid if at byte 0.

**File watching:** `fs.watch` with 100ms debounce. Emits `notes:changed` and `notes:tree-changed` events. Ignores own writes (track last-write timestamp).

**Auto-save + Watcher Algorithm:**

```
1. Main process tracks: lastWriteTimestamps = Map<filePath, number>
2. On editor change (renderer):
   - Set isDirty = true
   - Start 1.5s debounce timer → on expiry, call notes:save
3. On blur / focus-loss / file-switch (renderer):
   - If isDirty, call notes:save immediately (cancel debounce)
4. On notes:save (main process):
   - Record lastWriteTimestamps.set(path, Date.now())
   - Write file to disk
5. On fs.watch event (main process):
   a. Check lastWriteTimestamps.get(path):
      - If timestamp exists AND (Date.now() - timestamp) < 500ms → IGNORE (own write)
   b. Otherwise, emit to renderer:
      - For .md file content changes: emit notes:changed { path }
      - For directory structure changes (create/delete/rename): emit notes:tree-changed
6. On notes:changed event (renderer, for current open file):
   a. If isDirty:
      1. await notes:save (preserve user changes)
      2. Reload file via notes:open
   b. If clean:
      1. Reload file via notes:open immediately
   c. Update editor content, clear isDirty
7. On notes:tree-changed event (renderer):
   - Refresh file tree, preserve expanded folder state
```

**Security:** Must go through Craft Agents' existing `validateFilePath` from `main/ipc.ts`.

---

## IPC Channel Extensions

Added to existing handler registry in `apps/electron/src/main/ipc.ts`. **Do not create a separate file.**

### Notes Channels (IPC Namespace: `notes:*`)

| Channel | Direction | Args | Returns |
|---------|-----------|------|---------|
| `notes:open` | invoke | `path: string` | `{ content: string, frontmatter: string }` |
| `notes:save` | invoke | `path: string, content: string, frontmatter: string` | `void` |
| `notes:list` | invoke | `dir: string` | `FileNode[]` |
| `notes:create` | invoke | `dir: string, name: string` | `string` (path) |
| `notes:create-dir` | invoke | `dir: string, name: string` | `string` (path) |
| `notes:delete` | invoke | `path: string` | `void` |
| `notes:rename` | invoke | `oldPath: string, newPath: string` | `void` |
| `notes:changed` | send (main->renderer) | `path: string` | — |
| `notes:tree-changed` | send (main->renderer) | — | — |

### Handler Registration

```typescript
// In apps/electron/src/main/ipc.ts — add to existing handler registration
import * as files from './services/files'

ipcMain.handle('notes:open', (_, path: string) => files.readFile(path))
ipcMain.handle('notes:save', (_, path: string, content: string, frontmatter: string) => files.writeFile(path, content, frontmatter))
ipcMain.handle('notes:list', (_, dir: string) => files.listDirectory(dir))
ipcMain.handle('notes:create', (_, dir: string, name: string) => files.createFile(dir, name))
ipcMain.handle('notes:create-dir', (_, dir: string, name: string) => files.createDirectory(dir, name))
ipcMain.handle('notes:delete', (_, path: string) => files.deleteFile(path))
ipcMain.handle('notes:rename', (_, oldPath: string, newPath: string) => files.renameFile(oldPath, newPath))
```

---

## Preload / Context Bridge

Extend `window.electronAPI` with notes operations (using `notes:*` IPC namespace):

```typescript
// Add to apps/electron/src/preload/index.ts
notes: {
  open: (path: string) => ipcRenderer.invoke('notes:open', path),
  save: (path: string, content: string, frontmatter: string) => ipcRenderer.invoke('notes:save', path, content, frontmatter),
  list: (dir: string) => ipcRenderer.invoke('notes:list', dir),
  create: (dir: string, name: string) => ipcRenderer.invoke('notes:create', dir, name),
  createDir: (dir: string, name: string) => ipcRenderer.invoke('notes:create-dir', dir, name),
  delete: (path: string) => ipcRenderer.invoke('notes:delete', path),
  rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('notes:rename', oldPath, newPath),
  onChanged: (cb: (path: string) => void) => {
    const listener = (_: unknown, path: string) => cb(path)
    ipcRenderer.on('notes:changed', listener)
    return () => ipcRenderer.removeListener('notes:changed', listener)
  },
  onTreeChanged: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('notes:tree-changed', listener)
    return () => ipcRenderer.removeListener('notes:tree-changed', listener)
  },
},
```

All `on*` listeners return an unsubscribe function for cleanup in React `useEffect`.

**Decision:** Extend existing `window.electronAPI.notes` (not `window.electronAPI.file`) to semantically separate note operations from file attachment operations.

---

## Shared Types

Add to `apps/electron/src/shared/types.ts` (alongside existing Craft Agents types):

```typescript
// === Shards Types ===

export interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
}

export interface FileOpenResult {
  content: string       // markdown body (frontmatter stripped)
  frontmatter: string   // raw frontmatter string (including --- delimiters), or ''
}

export type ActiveTab = 'noteChat' | 'chatHistory'
export type MiddlePanelMode = 'filetree' | 'sessions'
```

---

## Editor State (Jotai)

New atoms file: `apps/electron/src/renderer/atoms/editor.ts`

**These are the canonical atom names.** All docs reference these.

```typescript
import { atom } from 'jotai'
import type { FileNode, ActiveTab, MiddlePanelMode } from '../../shared/types'

// Current open file (note being viewed — independent of session binding)
export const currentFilePathAtom = atom<string | null>(null)
export const frontmatterAtom = atom('')        // preserved frontmatter string
export const isDirtyAtom = atom(false)         // unsaved changes flag

// File tree
export const editorWorkspacePathAtom = atom<string | null>(null)
export const fileTreeAtom = atom<FileNode[]>([])
export const fileTreeExpandedAtom = atom<Set<string>>(new Set())  // expanded folder paths

// Layout
export const activeTabAtom = atom<ActiveTab>('noteChat')  // only used in Note+Chat mode
export const middlePanelModeAtom = atom<MiddlePanelMode>('filetree')

// Session-Note Binding: maps sessionId -> attached filePath
export const sessionNoteBindingAtom = atom<Map<string, string>>(new Map())

// Derived: window title
export const editorWindowTitleAtom = atom((get) => {
  const path = get(currentFilePathAtom)
  const dirty = get(isDirtyAtom)
  if (!path) return 'Shards'
  const name = path.split('/').pop() ?? 'Untitled'
  return `${dirty ? '* ' : ''}${name} — Shards`
})

// Derived: current mode
export const isNoteOpenAtom = atom((get) => get(currentFilePathAtom) !== null)
```

Coexists with Craft Agents' existing atoms (`sessions.ts`, `overlay.ts`, etc.).

---

## Theming Bridge

### Strategy

Craft Agents uses a 6-color theme system (`background`, `foreground`, `accent`, `info`, `success`, `destructive`). Shards adds `--shards-*` tokens for the editor.

### CSS Custom Properties

```css
:root {
  --shards-editor-bg: var(--background);
  --shards-editor-text: var(--foreground);
  --shards-editor-cursor: var(--foreground);
  --shards-editor-selection: color-mix(in srgb, var(--accent) 20%, transparent);
  --shards-code-bg: var(--background);
  --shards-code-text: var(--foreground);
  --shards-border: var(--border, #e5e7eb);
}
```

### tiptap SCSS Integration

Patch tiptap's scaffolded `_variables.scss`:

```scss
// apps/electron/src/renderer/components/tiptap/_variables.scss
$color-bg: var(--shards-editor-bg);
$color-text: var(--shards-editor-text);
$color-border: var(--shards-border);
$color-accent: var(--accent);
```

---

## Keyboard Shortcut Implementation

### Electron Accelerators

```typescript
// In app menu — add alongside existing menu items
{ label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('shortcut:new-note') },
{ label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('shortcut:save') },
{ label: 'Cycle View', accelerator: 'CmdOrCtrl+E', click: () => win.webContents.send('shortcut:cycle-view') },
{ label: 'Close Note', accelerator: 'CmdOrCtrl+W', click: () => win.webContents.send('shortcut:close-note') },
{ label: 'Toggle Middle Panel', accelerator: 'CmdOrCtrl+Shift+\\', click: () => win.webContents.send('shortcut:toggle-middle') },
```

### Shortcut Mapping (matches product-design.md)

| Shortcut | Action | Implementation |
|----------|--------|---------------|
| `Cmd+N` | New note | Electron accelerator -> renderer creates file |
| `Cmd+Shift+N` | New chat session | Existing Craft Agents shortcut |
| `Cmd+W` | Close current note | Electron accelerator -> clear currentFilePathAtom |
| `Cmd+E` | Switch between Note and Chat tabs | Electron accelerator -> toggle activeTabAtom |
| `Cmd+S` | Save current note | Electron accelerator -> trigger save |
| `Cmd+\` | Toggle left sidebar | Existing Craft Agents shortcut |
| `Cmd+Shift+\` | Toggle middle panel | Electron accelerator |
| `Cmd+1` | Middle panel -> Session list | Electron accelerator -> set middlePanelModeAtom |
| `Cmd+2` | Middle panel -> File tree | Electron accelerator -> set middlePanelModeAtom |

### Coexistence

- **Electron accelerators:** Shards shortcuts above
- **tiptap keybindings:** Cmd+B, Cmd+I, Cmd+K, etc. (whatever the template provides)
- **Craft Agents shortcuts:** Shift+Tab (permissions), etc. — unchanged

---

## Error Handling

| Error | Where | Surface |
|-------|-------|---------|
| File not found | `files.readFile` | Toast + clear editor |
| Permission denied | `files.writeFile` | Toast, keep editor dirty |
| Workspace not accessible | `files.listDirectory` | Empty state in file tree |
| Frontmatter parse error | `files.readFile` | Treat as no frontmatter, log warning |
| File watcher error | `files.watchDirectory` | Log warning, continue without watch |

Uses Craft Agents' existing toast/notification system.

---

## Component File Map

```
apps/electron/src/renderer/components/
├── tiptap/                    # Scaffolded tiptap UI (SCSS) — use as-is from template
│   ├── _variables.scss        # Patched with --shards-* tokens
│   └── ...                    # Whatever the tiptap CLI scaffolds
├── editor/                    # Shards editor wrapper
│   ├── Editor.tsx
│   └── extensions.ts
├── filetree/                  # File navigation
│   ├── FileTree.tsx
│   └── FileNode.tsx
└── app-shell/                 # Extended (existing Craft Agents)
    └── ViewTabs.tsx            # NEW: [Note] [Chat] tabs
```

---

## Open Technical Questions

1. **Tables in markdown roundtrip** — TableKit works in editor, but `@tiptap/markdown` limits table cells to one child node. Complex tables may lose content.
2. **Image handling** — tiptap's `ImageUploadButton` assumes upload. Need to adapt for local file paths (`![alt](./relative/path.png)`).
3. **Editor focus management** — When switching between file tree, editor, and chat input, focus needs correct routing.
4. **tiptap CLI + Craft Agents' Vite config** — CLI assumes standard Vite project structure. May need manual file placement.
5. **SCSS in Vite config** — Does existing renderer Vite config handle SCSS? May need `sass-embedded` dev dep.
6. **Navigation integration** — How do Shards' note routes integrate with Craft Agents' `navigate()` system and the `no-direct-navigation-state` ESLint rule?
