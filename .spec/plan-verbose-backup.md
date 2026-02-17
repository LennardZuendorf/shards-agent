---
type: entrypoint
scope: implementation
covers: milestones, task breakdown, validation criteria, session planning, dependency graph
updated: 2026-02-13
---

# Shards — Implementation Plan

Task-focused implementation plan with independently validatable milestones. Each milestone has clear exit criteria and can be completed across multiple agent sessions.

**Parent specs:** [product.md](product.md), [tech.md](tech.md)

**Status tracking:** Update milestone status table at end of document as work progresses.

---

## Current State

✅ **Foundation Ready:**
- Craft Agents fork with agent SDK, sessions, MCP, skills, permissions
- IPC channels for file operations registered
- CSS token system established
- Jotai atom infrastructure
- Main process file handling

❌ **Missing (Shards-specific):**
- tiptap v3 dependencies
- Editor components (tiptap + wrapper)
- File tree sidebar
- Editor atoms
- File service layer
- View toggle system
- Markdown I/O with frontmatter handling
- Agent-editor sync via file watcher
- Auto-tagging in Note+Chat mode

---

## Implementation Roadmap

| Phase | Goal | Sessions | Complexity |
|-------|------|----------|------------|
| **M1: Dependencies & Build** | tiptap installed, SCSS working | 1 | Low |
| **M2: Minimal Editor** | tiptap renders, extensions work | 1-2 | Medium |
| **M3: File I/O Foundation** | Read/write markdown + frontmatter | 1-2 | Medium |
| **M4: File Tree UI** | Browse, create, rename, delete files | 2-3 | High |
| **M5: Layout System** | Three panels, view toggle, tabs | 2-3 | High |
| **M6: Agent Sync** | File watcher, live reload | 2 | Medium |
| **M7: Auto-Tagging & Chat** | Note+Chat mode, auto-reference | 1-2 | Medium |
| **M8: Polish** | Shortcuts, errors, theming | 2 | Medium |

**Total estimate:** 12-17 sessions

---

## M1: Dependencies & Build Setup

**Goal:** Install tiptap packages and configure build system for SCSS + markdown.

**Spec refs:** [tech-infrastructure.md#dependencies-shards-additions](tech-infrastructure.md)

### Tasks

#### 1.1 Install tiptap Packages
- [ ] Add @tiptap/react, @tiptap/pm, @tiptap/starter-kit, @tiptap/markdown
- [ ] Add extensions: code-block-lowlight, placeholder, task-list, task-item, highlight, table (+ row/header/cell)
- [ ] Add lowlight, @floating-ui/dom
- [ ] Add gray-matter for frontmatter parsing
- [ ] Add sass-embedded (dev dependency)

#### 1.2 Configure Build System
- [ ] Update vite.config.ts to handle SCSS (modern-compiler API)
- [ ] Verify tsconfig.json allows .scss imports
- [ ] Add *.scss type declarations if needed

#### 1.3 Validation
- [ ] Run `bun install` (no errors)
- [ ] Run `bun run typecheck:all` (passes)
- [ ] Run `bun run electron:dev` (starts without errors)
- [ ] No console warnings about dependencies

### Exit Criteria
✅ All dependencies installed
✅ Build system handles SCSS
✅ TypeScript types resolve

---

## M2: Minimal Editor

**Goal:** Get a basic tiptap editor rendering with extensions and theming.

**Dependencies:** M1 complete

**Spec refs:** [tech-infrastructure.md#tiptap-setup](tech-infrastructure.md), [tech-infrastructure.md#editor-components](tech-infrastructure.md)

### Tasks

#### 2.1 Scaffold tiptap Template
- [ ] Run tiptap CLI: `npx @tiptap/cli@latest add simple-editor -p apps/electron/src/renderer/components/tiptap`
- [ ] If CLI fails, manually copy template files from tiptap docs
- [ ] Verify `components/tiptap/` directory created with .tsx and .scss files

#### 2.2 Create Extension Stack
- [ ] Create `components/editor/extensions.ts`
- [ ] Configure StarterKit (disable codeBlock)
- [ ] Add Markdown extension (GFM enabled, breaks disabled)
- [ ] Add CodeBlockLowlight with lowlight
- [ ] Add Placeholder ("Start writing...")
- [ ] Add TaskList + TaskItem (nested: true)
- [ ] Add Highlight (multicolor: true)
- [ ] Add Table + TableRow + TableHeader + TableCell (resizable: true)
- [ ] Export editorExtensions array

#### 2.3 Create Editor Wrapper
- [ ] Create `components/editor/Editor.tsx`
- [ ] Initialize useEditor hook with extensions
- [ ] Set test content: "# Hello Shards\n\nThis is a test note."
- [ ] Configure editorProps (prose classes, focus outline)
- [ ] Wrap EditorContent in max-width container (720px)
- [ ] Add vertical padding (px-8 py-6)

#### 2.4 Create Test Page
- [ ] Create `pages/EditorTest.tsx`
- [ ] Add header with "Editor Test" title
- [ ] Render Editor component
- [ ] Add route to app router

#### 2.5 Theming Bridge
- [ ] Patch `components/tiptap/_variables.scss` to use --background, --foreground, --border, --accent tokens
- [ ] OR create --shards-* tokens in renderer/index.css
- [ ] Test theme toggle (dark/light) updates editor

#### 2.6 Validation
- [ ] Editor renders on test page
- [ ] Can type and format text (bold, italic, headings)
- [ ] Code blocks show syntax highlighting
- [ ] Task lists render with checkboxes
- [ ] Tables are editable and resizable
- [ ] Placeholder appears when empty
- [ ] Theme toggle works (dark/light)
- [ ] No console errors

### Exit Criteria
✅ tiptap editor renders and accepts input
✅ All extensions functional
✅ Editor follows app theme

---

## M3: File I/O Foundation

**Goal:** Open markdown files from disk, edit them, save with frontmatter preservation.

**Dependencies:** M2 complete

**Spec refs:** [tech-infrastructure.md#markdown-io](tech-infrastructure.md), [tech-infrastructure.md#file-service](tech-infrastructure.md), [tech-infrastructure.md#ipc-channel-extensions](tech-infrastructure.md)

### Tasks

#### 3.1 Create Shared Types
- [ ] Add to `shared/types.ts`: FileNode, FileOpenResult, ActiveTab, MiddlePanelMode

#### 3.2 Create Editor Atoms
- [ ] Create `atoms/editor.ts`

- [ ] Add atoms: currentFilePathAtom, frontmatterAtom, isDirtyAtom, editorWorkspacePathAtom, fileTreeAtom, fileTreeExpandedAtom, activeTabAtom, middlePanelModeAtom
- [ ] Add derived atoms: editorWindowTitleAtom, isNoteOpenAtom

#### 3.3 Create File Service (Main Process)
- [ ] Create `main/services/files.ts`
- [ ] Implement readFile(path): parse with gray-matter, return { content, frontmatter }
- [ ] Implement writeFile(path, content, frontmatter): prepend frontmatter, write to disk
- [ ] Implement listDirectory(dir): recursive readdir, filter .md files + non-dot dirs, hide CLAUDE.md/AGENTS.md, sort alphabetically
- [ ] Implement createFile(dir, name): write empty .md file
- [ ] Implement createDirectory(dir, name): mkdir recursive
- [ ] Implement deleteFile(path): shell.trashItem (system Trash)
- [ ] Implement renameFile(oldPath, newPath): fs.rename

#### 3.4 Register IPC Handlers
- [ ] Add to `main/ipc.ts`: file:open, file:save, file:list, file:create, file:create-dir, file:delete, file:rename
- [ ] Import files service
- [ ] Wire each handler to corresponding service method

#### 3.5 Extend Preload Bridge
- [ ] Add to `preload/index.ts`: window.electronAPI.file object
- [ ] Add methods: open, save, list, create, createDir, delete, rename
- [ ] Each method invokes corresponding IPC channel

#### 3.6 Wire Editor to File I/O
- [ ] Update Editor.tsx: import atoms (currentFilePath, frontmatter, isDirty)
- [ ] Add useEffect: load file when currentFilePath changes
- [ ] Add save handler: get markdown from editor, call file.save with frontmatter
- [ ] Add onUpdate handler: set isDirty(true)
- [ ] Implement auto-save: debounce 1.5s after last edit, save on blur/window focus loss
- [ ] Implement Cmd+S handler

#### 3.7 Create Test UI
- [ ] Update EditorTest page: add "Open Test File" button
- [ ] Button calls setCurrentFilePath with test file path
- [ ] Create test-note.md with frontmatter for testing

#### 3.8 Validation
- [ ] Create test .md file with frontmatter
- [ ] Click "Open Test File" loads file into editor
- [ ] File content appears (frontmatter hidden)
- [ ] Edit file, changes persist
- [ ] Save file (auto-save or Cmd+S) works
- [ ] Re-open file shows saved content
- [ ] Frontmatter preserved exactly
- [ ] Window title shows filename + dirty indicator (*)
- [ ] No console errors

### Exit Criteria
✅ Can open/save .md files
✅ Frontmatter stripped on load, prepended on save
✅ Auto-save works
✅ Dirty state tracking works

---

## Milestone 3: File Tree Sidebar

**Goal:** Browse workspace folder, click to open files, create/rename/delete files and folders.

**Dependencies:** M2 complete

### Tasks

#### M3.1: Create FileNode Component

Create `components/filetree/FileNode.tsx`:

```typescript
import { FileNode as FileNodeType } from '../../shared/types'
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react'

interface Props {
  node: FileNodeType
  depth: number
  isExpanded: boolean
  isSelected: boolean
  onToggle: () => void
  onClick: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

export const FileNode = ({
  node,
  depth,
  isExpanded,
  isSelected,
  onToggle,
  onClick,
  onContextMenu,
}: Props) => {
  const isDirectory = node.type === 'directory'

  return (
    <div>
      <div
        className={`
          flex items-center gap-2 px-2 py-1 cursor-pointer hover:bg-foreground-5
          ${isSelected ? 'bg-accent-10' : ''}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={isDirectory ? onToggle : onClick}
        onContextMenu={onContextMenu}
      >
        {isDirectory ? (
          isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />
        ) : null}
        {isDirectory ? <Folder size={16} /> : <FileText size={16} />}
        <span className="text-sm truncate">{node.name}</span>
      </div>

      {isDirectory && isExpanded && node.children?.map(child => (
        <FileNode key={child.path} node={child} depth={depth + 1} {...childProps} />
      ))}
    </div>
  )
}
```

**Spec reference:** [tech-infrastructure.md — FileTree.tsx / FileNode.tsx](tech-infrastructure.md#filetreetsx--filenodetsx)

#### M3.2: Create FileTree Component

Create `components/filetree/FileTree.tsx`:

```typescript
import { useAtom } from 'jotai'
import { fileTreeAtom, fileTreeExpandedAtom, currentFilePathAtom, editorWorkspacePathAtom } from '../../atoms/editor'
import { FileNode } from './FileNode'
import { Plus } from 'lucide-react'

export const FileTree = () => {
  const [tree] = useAtom(fileTreeAtom)
  const [expanded, setExpanded] = useAtom(fileTreeExpandedAtom)
  const [currentFile, setCurrentFile] = useAtom(currentFilePathAtom)
  const [workspacePath] = useAtom(editorWorkspacePathAtom)

  const handleToggle = (path: string) => {
    const next = new Set(expanded)
    if (next.has(path)) {
      next.delete(path)
    } else {
      next.add(path)
    }
    setExpanded(next)
  }

  const handleFileClick = (path: string) => {
    setCurrentFile(path)
  }

  const handleNewNote = async () => {
    if (!workspacePath) return
    const newPath = await window.electronAPI.file.create(workspacePath, 'Untitled')
    // Refresh tree and open new file
    refreshFileTree()
    setCurrentFile(newPath)
  }

  const refreshFileTree = async () => {
    if (!workspacePath) return
    const nodes = await window.electronAPI.file.list(workspacePath)
    setFileTree(nodes)
  }

  useEffect(() => {
    refreshFileTree()
  }, [workspacePath])

  return (
    <div className="flex flex-col h-full bg-background border-r border-border">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h2 className="text-sm font-semibold">All Notes</h2>
        <button onClick={handleNewNote} className="p-1 hover:bg-foreground-5 rounded">
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tree.length === 0 ? (
          <div className="p-4 text-center text-foreground-50">
            <p className="text-sm">No notes yet</p>
            <button onClick={handleNewNote} className="mt-2 px-3 py-1 bg-accent text-background rounded text-sm">
              + New Note
            </button>
          </div>
        ) : (
          tree.map(node => (
            <FileNode
              key={node.path}
              node={node}
              depth={0}
              isExpanded={expanded.has(node.path)}
              isSelected={currentFile === node.path}
              onToggle={() => handleToggle(node.path)}
              onClick={() => handleFileClick(node.path)}
              onContextMenu={(e) => handleContextMenu(e, node)}
            />
          ))
        )}
      </div>
    </div>
  )
}
```

**Spec reference:** [product-design.md — Middle Panel — File Tree](product-design.md#middle-panel--file-tree-by-default), [tech-infrastructure.md — FileTree.tsx](tech-infrastructure.md#filetreetsx--filenodetsx)

#### M3.3: Add Context Menu

Add right-click context menu to FileNode for:
- New Note (in folder)
- New Folder
- Rename
- Delete

Use Craft Agents' existing context menu system or a library like `react-contexify`.

**Spec reference:** [product-design.md — File Tree — Behavior](product-design.md#middle-panel--file-tree-by-default)

#### M3.4: Implement Rename Flow

Inline rename:
- Double-click filename activates inline input
- `.md` extension auto-appended
- Enter confirms, Esc cancels
- Validation: no empty names, no `/`, no duplicates

**Spec reference:** [product-design.md — Rename flow](product-design.md#middle-panel--file-tree-by-default)

#### M3.5: Implement Delete Flow

- Right-click → Delete
- Confirmation dialog: "Move `filename.md` to Trash?"
- Uses `shell.trashItem` (system Trash, not permanent delete)
- If deleted file was open, clear editor

**Spec reference:** [product-design.md — Delete flow](product-design.md#middle-panel--file-tree-by-default)

#### M3.6: Wire to Layout

Add FileTree to app layout (temporary placement for testing):

```typescript
// In app shell or test page
<div className="flex h-screen">
  <FileTree />
  <Editor />
</div>
```

### Validation Criteria

- [ ] File tree shows all `.md` files in workspace folder
- [ ] Folders are collapsible/expandable
- [ ] Dot-directories hidden (`.craft-agent`, `.obsidian`, `.claude`)
- [ ] `CLAUDE.md` and `AGENTS.md` hidden
- [ ] Click file → opens in editor
- [ ] Current file highlighted in tree
- [ ] New Note button creates `Untitled.md`
- [ ] New Folder creates folder
- [ ] Rename works (inline edit, `.md` auto-appended)
- [ ] Delete moves to system Trash
- [ ] Deleting open file clears editor
- [ ] Tree refreshes after create/rename/delete

### Exit Criteria

✅ File tree renders workspace folder structure
✅ Click to open files
✅ Create/rename/delete files and folders
✅ Tree state (expanded/collapsed) persists during session
✅ Current file highlighted

---

## Milestone 4: Layout & View System

**Goal:** Three-panel layout with middle panel toggle (file tree / session list) and right panel tabs (Note / Chat).

**Dependencies:** M3 complete

### Tasks

#### M4.1: Create ViewTabs Component

Create `components/app-shell/ViewTabs.tsx`:

```typescript
import { useAtom } from 'jotai'
import { activeTabAtom } from '../../atoms/editor'

export const ViewTabs = () => {
  const [activeTab, setActiveTab] = useAtom(activeTabAtom)

  return (
    <div className="flex gap-2 border-b border-border px-3">
      <button
        className={`px-3 py-2 text-sm ${activeTab === 'note' ? 'border-b-2 border-accent' : 'text-foreground-50'}`}
        onClick={() => setActiveTab('note')}
      >
        Note
      </button>
      <button
        className={`px-3 py-2 text-sm ${activeTab === 'chat' ? 'border-b-2 border-accent' : 'text-foreground-50'}`}
        onClick={() => setActiveTab('chat')}
      >
        Chat
      </button>
    </div>
  )
}
```

**Spec reference:** [product-design.md — Right Panel — View Toggle](product-design.md#view-toggle), [tech-infrastructure.md — Tab Component](tech-infrastructure.md#tab-component)

#### M4.2: Update AppShell Layout

Modify existing `AppShell` component to support three-panel layout:

```typescript
// Pseudocode structure
<div className="flex h-screen">
  {/* Left sidebar - existing Craft Agents */}
  <LeftSidebar />

  {/* Middle panel - toggle between file tree and session list */}
  <div className="w-64 border-r border-border">
    {middlePanelMode === 'filetree' ? <FileTree /> : <SessionList />}
  </div>

  {/* Right panel - tabs for Note/Chat */}
  <div className="flex-1 flex flex-col">
    {showTabs && <ViewTabs />}

    {activeTab === 'note' ? (
      <div className="flex-1 flex flex-col">
        <Editor />
        {hasActiveSession && <ChatInputBar />}
      </div>
    ) : (
      <ChatPanel />
    )}
  </div>
</div>
```

**Spec reference:** [product-design.md — Layout](product-design.md#layout), [tech-infrastructure.md — Layout & View System](tech-infrastructure.md#layout--view-system)

#### M4.3: Add Left Sidebar Items

Extend left sidebar with:
- "+ New Note" button (alongside "+ New Session")
- "All Notes" item (switches middle panel to file tree)

**Spec reference:** [product-design.md — Left Sidebar](product-design.md#left-sidebar-minimal-changes)

#### M4.4: Implement Middle Panel Toggle

Wire up `middlePanelModeAtom` to switch between:
- `'filetree'` → shows FileTree component
- `'sessions'` → shows existing SessionList component

Clicking "All Notes" in left sidebar sets mode to `'filetree'`.
Clicking "All Sessions" / Flagged / Status sets mode to `'sessions'`.

**Spec reference:** [tech-infrastructure.md — Middle Panel Switching](tech-infrastructure.md#middle-panel-switching)

#### M4.5: Implement Right Panel View Logic

Wire up `activeTabAtom` to switch between:
- `'note'` → shows Editor (+ ChatInputBar if session active)
- `'chat'` → shows full ChatPanel

Tab visibility rules:
- Show tabs when both a note AND a session exist
- Hide tabs if only note or only session

**Spec reference:** [tech-infrastructure.md — Right Panel View Toggle](tech-infrastructure.md#right-panel-view-toggle)

#### M4.6: Create ChatInputBar Component

Extract chat input from full ChatPanel into a compact bottom bar:

```typescript
export const ChatInputBar = () => {
  const [currentFile] = useAtom(currentFilePathAtom)

  return (
    <div className="border-t border-border p-3 bg-background-5">
      <div className="text-xs text-foreground-50 mb-2">
        <a onClick={() => setActiveTab('chat')} className="underline cursor-pointer">
          Show chat history
        </a>
      </div>
      <div className="text-sm text-foreground-50 mb-1">
        Ask Claude about {currentFile ? path.basename(currentFile) : 'this note'}
      </div>
      {/* Reuse existing chat input component */}
      <FreeFormInput ... />
    </div>
  )
}
```

**Spec reference:** [product-design.md — Note+Chat View](product-design.md#notechat-view-note-tab-session-active--the-core-shards-experience), [tech-infrastructure.md — Note Tab Layout](tech-infrastructure.md#note-tab-layout-with-session-active)

### Validation Criteria

- [ ] Three-panel layout renders correctly
- [ ] Left sidebar shows "+ New Note" and "All Notes"
- [ ] Clicking "All Notes" switches middle panel to file tree
- [ ] Clicking "All Sessions" switches middle panel to session list
- [ ] Right panel shows [Note] [Chat] tabs when both exist
- [ ] Clicking Note tab shows editor (+ chat input if session active)
- [ ] Clicking Chat tab shows full chat history
- [ ] "Show chat history" link in chat input bar switches to Chat tab
- [ ] Tabs hidden when only note or only session exists
- [ ] Layout responsive (no overflow, scrolling works)

### Exit Criteria

✅ Three-panel layout working
✅ Middle panel toggles between file tree and session list
✅ Right panel tabs switch between Note and Chat views
✅ Note+Chat mode shows editor with chat input at bottom
✅ Tab visibility rules implemented

---

## Milestone 5: Agent-Editor Sync

**Goal:** When agent edits a file, editor auto-reloads. File watcher detects external changes.

**Dependencies:** M4 complete

### Tasks

#### M5.1: Add File Watcher to File Service

Update `services/files.ts` with file watching:

```typescript
import * as fs from 'fs'
import { BrowserWindow } from 'electron'

const watchedDirs = new Map<string, fs.FSWatcher>()
const lastWriteTimestamps = new Map<string, number>()

export function watchDirectory(dirPath: string, window: BrowserWindow) {
  if (watchedDirs.has(dirPath)) return // already watching

  const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
    if (!filename) return

    const fullPath = path.join(dirPath, filename)

    // Ignore if this was our own write (within 500ms)
    const lastWrite = lastWriteTimestamps.get(fullPath) ?? 0
    if (Date.now() - lastWrite < 500) return

    // Debounce 100ms
    clearTimeout(debounceTimers.get(fullPath))
    debounceTimers.set(fullPath, setTimeout(() => {
      // Emit to renderer
      if (filename.endsWith('.md')) {
        window.webContents.send('file:changed', fullPath)
      } else {
        window.webContents.send('file:tree-changed')
      }
    }, 100))
  })

  watchedDirs.set(dirPath, watcher)
}

export function unwatchDirectory(dirPath: string) {
  const watcher = watchedDirs.get(dirPath)
  if (watcher) {
    watcher.close()
    watchedDirs.delete(dirPath)
  }
}

// Track our own writes
export async function writeFile(
  filePath: string,
  content: string,
  frontmatter: string
): Promise<void> {
  // ... existing write logic ...

  // Track write timestamp to ignore in watcher
  lastWriteTimestamps.set(filePath, Date.now())
}
```

**Spec reference:** [tech-infrastructure.md — File Service — watchDirectory](tech-infrastructure.md#file-service-appselectronsrcmainservicesfilests), [tech-agents.md — Agent -> Editor Sync — File Watcher](tech-agents.md#agent---editor-sync)

#### M5.2: Add IPC Events for File Changes

Update IPC to send file change events:

```typescript
// In main/ipc.ts, when workspace is opened:
ipcMain.handle('workspace:open', async (event, workspaceId) => {
  // ... existing workspace open logic ...

  const workspace = loadWorkspace(workspaceId)
  const window = BrowserWindow.fromWebContents(event.sender)

  // Start watching workspace folder
  files.watchDirectory(workspace.rootPath, window)

  return workspace
})

// Clean up watcher on workspace close
ipcMain.handle('workspace:close', async (event, workspaceId) => {
  const workspace = loadWorkspace(workspaceId)
  files.unwatchDirectory(workspace.rootPath)
})
```

#### M5.3: Add Preload Listeners

Update `preload/index.ts` with file change listeners:

```typescript
file: {
  // ... existing methods ...

  onChanged: (cb: (path: string) => void) => {
    const listener = (_: unknown, path: string) => cb(path)
    ipcRenderer.on('file:changed', listener)
    return () => ipcRenderer.removeListener('file:changed', listener)
  },

  onTreeChanged: (cb: () => void) => {
    const listener = () => cb()
    ipcRenderer.on('file:tree-changed', listener)
    return () => ipcRenderer.removeListener('file:tree-changed', listener)
  },
},
```

**Spec reference:** [tech-infrastructure.md — Preload / Context Bridge](tech-infrastructure.md#preload--context-bridge)

#### M5.4: Wire Editor to File Change Events

Update `components/editor/Editor.tsx` to reload on file changes:

```typescript
useEffect(() => {
  const unsubscribe = window.electronAPI.file.onChanged(async (changedPath) => {
    if (changedPath !== currentFile) return // not the current file

    // If dirty, auto-save first
    if (isDirty && editor) {
      const markdown = editor.storage.markdown.getMarkdown()
      await window.electronAPI.file.save(currentFile, markdown, frontmatter)
    }

    // Reload from disk
    const { content, frontmatter: newFrontmatter } = await window.electronAPI.file.open(changedPath)
    editor?.commands.setContent(content)
    setFrontmatter(newFrontmatter)
    setDirty(false)
  })

  return unsubscribe
}, [currentFile, editor, isDirty, frontmatter])
```

**Spec reference:** [tech-agents.md — Agent -> Editor Sync — Solution](tech-agents.md#solution-file-watcher)

#### M5.5: Wire FileTree to Tree Change Events

Update `components/filetree/FileTree.tsx` to refresh on tree changes:

```typescript
useEffect(() => {
  const unsubscribe = window.electronAPI.file.onTreeChanged(async () => {
    // Refresh file tree, preserve expanded state
    if (!workspacePath) return
    const nodes = await window.electronAPI.file.list(workspacePath)
    setFileTree(nodes)
  })

  return unsubscribe
}, [workspacePath])
```

#### M5.6: Test Agent Edit Flow

Create a test:
1. Open a note in editor
2. Use Craft Agents chat to ask agent to edit the file via Write/Edit tool
3. Verify editor reloads silently with agent's changes
4. Verify frontmatter preserved

**Spec reference:** [product-design.md — Agent Sync UX](product-design.md#agent-sync-ux)

### Validation Criteria

- [ ] Agent uses Write tool → file changes → editor reloads
- [ ] Agent uses Edit tool → file changes → editor reloads
- [ ] External app edits file → editor reloads
- [ ] Editor has unsaved changes → auto-saves before reloading
- [ ] Editor has no unsaved changes → reloads silently
- [ ] Agent creates new file → file tree refreshes, file appears
- [ ] Agent deletes file → file tree refreshes, editor clears if it was open
- [ ] Expanded folders in file tree remain expanded after refresh
- [ ] No console errors or duplicate reloads

### Exit Criteria

✅ File watcher detects changes in workspace folder
✅ Editor auto-reloads when current file changes
✅ File tree auto-refreshes when files added/removed
✅ Conflict resolution works (auto-save before reload)
✅ Agent edits appear live in editor

---

## Milestone 6: Auto-Tagging & Note+Chat

**Goal:** In Note+Chat mode, current file is auto-referenced in every message sent to the agent.

**Dependencies:** M4 complete (M5 optional but recommended)

### Tasks

#### M6.1: Implement Auto-Save Before Send

In ChatInputBar component, auto-save editor before sending message:

```typescript
const handleSendMessage = async (message: string) => {
  // Auto-save if editor is dirty
  if (isDirty && currentFile && editor) {
    const markdown = editor.storage.markdown.getMarkdown()
    await window.electronAPI.file.save(currentFile, markdown, frontmatter)
    setDirty(false)
  }

  // Send message with auto-tagging
  await sendMessageWithAutoTag(sessionId, message)
}
```

**Spec reference:** [tech-agents.md — Auto-Tagging — Implementation](tech-agents.md#implementation)

#### M6.2: Implement Auto-Tagging

Add current file as a mention in every message:

```typescript
async function sendMessageWithAutoTag(
  sessionId: string,
  userMessage: string,
) {
  const currentFile = currentFilePathAtom.get()

  // Auto-tag current file as a mention if it exists
  const mentions: string[] = []
  if (currentFile) {
    mentions.push(`[file:${currentFile}]`)
  }

  // Send through Craft Agents' normal sendMessage flow
  // The mention is parsed by lib/mentions.ts
  await window.electronAPI.sendMessage(sessionId, userMessage, { mentions })
}
```

**Spec reference:** [tech-agents.md — Auto-Tagging](tech-agents.md#auto-tagging-notechat-mode), [product-design.md — Auto-tagging](product-design.md#notechat-view-note-tab-session-active--the-core-shards-experience)

#### M6.3: Update Chat Input Placeholder

Show context-aware placeholder in chat input:

```typescript
// In ChatInputBar
const currentFileName = currentFile ? path.basename(currentFile) : 'this note'
const placeholder = `Ask Claude about ${currentFileName}`
```

**Spec reference:** [product-design.md — Chat input bar](product-design.md#notechat-view-note-tab-session-active--the-core-shards-experience)

#### M6.4: Test Auto-Tagging Flow

1. Open a note with some content
2. Switch to Note tab (with active session)
3. Type a message in chat input: "Summarize this"
4. Verify agent receives `[file:path]` mention automatically
5. Verify agent reads the file and summarizes it
6. Verify chat history shows the message (without visible mention)

### Validation Criteria

- [ ] In Note+Chat mode, sending a message auto-tags current file
- [ ] Agent receives file path as a mention
- [ ] Agent can read file content (via existing file mention system)
- [ ] Auto-save fires before message send
- [ ] Placeholder shows current filename
- [ ] "Show chat history" link switches to Chat tab
- [ ] Manual @ file mentions still work

### Exit Criteria

✅ Current file auto-referenced in every message in Note+Chat mode
✅ Auto-save before send works
✅ Agent receives file path and can read it
✅ User never has to manually "send current file"

---

## Milestone 7: Polish & Keyboard Shortcuts

**Goal:** Complete UX with keyboard shortcuts, error handling, settings, and final theming.

**Dependencies:** M1-M6 complete

### Tasks

#### M7.1: Implement Keyboard Shortcuts

Add Electron accelerators to app menu:

```typescript
// In main/index.ts or menu setup
{ label: 'New Note', accelerator: 'CmdOrCtrl+N', click: () => win.webContents.send('shortcut:new-note') },
{ label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => win.webContents.send('shortcut:save') },
{ label: 'Cycle View', accelerator: 'CmdOrCtrl+E', click: () => win.webContents.send('shortcut:cycle-view') },
{ label: 'Close Note', accelerator: 'CmdOrCtrl+W', click: () => win.webContents.send('shortcut:close-note') },
{ label: 'Toggle Middle Panel', accelerator: 'CmdOrCtrl+Shift+\\', click: () => win.webContents.send('shortcut:toggle-middle') },
{ label: 'Show File Tree', accelerator: 'CmdOrCtrl+2', click: () => win.webContents.send('shortcut:show-filetree') },
{ label: 'Show Sessions', accelerator: 'CmdOrCtrl+1', click: () => win.webContents.send('shortcut:show-sessions') },
```

Wire up handlers in renderer:

```typescript
useEffect(() => {
  const handlers = {
    'shortcut:new-note': () => handleNewNote(),
    'shortcut:save': () => handleSave(),
    'shortcut:cycle-view': () => setActiveTab(prev => prev === 'note' ? 'chat' : 'note'),
    'shortcut:close-note': () => setCurrentFile(null),
    'shortcut:toggle-middle': () => setMiddlePanelVisible(prev => !prev),
    'shortcut:show-filetree': () => setMiddlePanelMode('filetree'),
    'shortcut:show-sessions': () => setMiddlePanelMode('sessions'),
  }

  Object.entries(handlers).forEach(([event, handler]) => {
    ipcRenderer.on(event, handler)
  })

  return () => {
    Object.keys(handlers).forEach(event => {
      ipcRenderer.removeAllListeners(event)
    })
  }
}, [])
```

**Spec reference:** [product-design.md — Keyboard Shortcuts](product-design.md#keyboard-shortcuts), [tech-infrastructure.md — Keyboard Shortcut Implementation](tech-infrastructure.md#keyboard-shortcut-implementation)

#### M7.2: Error Handling

Add error handling for file operations:

| Error | Where | Surface |
|-------|-------|---------|
| File not found | `files.readFile` | Toast + clear editor |
| Permission denied | `files.writeFile` | Toast, keep editor dirty |
| Workspace not accessible | `files.listDirectory` | Empty state in file tree |
| Frontmatter parse error | `files.readFile` | Treat as no frontmatter, log warning |
| File watcher error | `files.watchDirectory` | Log warning, continue without watch |

Use Craft Agents' existing toast/notification system.

**Spec reference:** [tech-infrastructure.md — Error Handling](tech-infrastructure.md#error-handling)

#### M7.3: Add Shards Settings

Add to Craft Agents settings page:

- **Auto-save** toggle (default: on)
- (Future: editor preferences, default note location, etc.)

**Spec reference:** [product-design.md — Shards-Specific Settings](product-design.md#shards-specific-settings)

#### M7.4: Window Title Updates

Wire up window title to show current file:

```typescript
useEffect(() => {
  const title = editorWindowTitleAtom.get()
  document.title = title
  // Or use IPC to set native window title
  window.electronAPI.setWindowTitle(title)
}, [currentFile, isDirty])
```

**Spec reference:** [tech-infrastructure.md — Editor State — editorWindowTitleAtom](tech-infrastructure.md#editor-state-jotai)

#### M7.5: Empty States

Add empty states for:
- No workspace (prompt to create/open)
- Empty workspace (no notes, "Create your first note")
- No file open in editor (show placeholder or recent notes)

**Spec reference:** [product-design.md — Empty Workspace State](product-design.md#empty-workspace-state)

#### M7.6: Final Theming Pass

- Verify `--shards-*` tokens work in both dark and light mode
- Test editor theming (text color, background, selection, cursor)
- Test file tree theming (hover, selected, expanded states)
- Ensure tiptap toolbar/bubble menu follow app theme

**Spec reference:** [tech-infrastructure.md — Theming Bridge](tech-infrastructure.md#theming-bridge)

#### M7.7: Mode Transitions Testing

Test all mode transition scenarios:

| Current View | User Action | Expected Result |
|-------------|------------|------------------|
| Chat | Click note in file tree | Switch to Note tab (note opens with chat input at bottom) |
| Chat | Cmd+N | Switch to Note tab (new note) |
| Note | Click Chat tab | Switch to Chat tab (full chat view) |
| Note+Chat | Click Chat tab | Switch to Chat tab (full chat view) |
| Note+Chat | Click "Show chat history" | Switch to Chat tab |
| Note+Chat | Click different note in file tree | Note switches, stay on Note tab |
| Chat | Click Note tab | Switch back to Note+Chat (editor + chat input) |
| Any | Cmd+Shift+N | Switch to Chat tab (new session) |
| Any | Cmd+N | Switch to Note tab (new note) |

**Spec reference:** [product-design.md — Mode Transitions](product-design.md#mode-transitions)

### Validation Criteria

- [ ] All keyboard shortcuts work (Cmd+N, Cmd+S, Cmd+E, Cmd+W, Cmd+1, Cmd+2, Cmd+Shift+\)
- [ ] Error handling works for all file operations
- [ ] Settings page has auto-save toggle
- [ ] Window title updates with filename and dirty indicator
- [ ] Empty states show helpful messages
- [ ] Dark/light theme switch works correctly
- [ ] All mode transitions work as specified
- [ ] No console errors in normal operation
- [ ] Performance is smooth (no lag when typing, switching files, etc.)

### Exit Criteria

✅ All keyboard shortcuts implemented
✅ Error handling covers all failure cases
✅ Settings integrated
✅ Window title updates correctly
✅ Empty states implemented
✅ Theming complete and tested
✅ Mode transitions all working

---

## Milestone 8 (Optional): Workspace Auto-Configuration

**Goal:** Auto-configure workspace folder as local source, set working directory, load CLAUDE.md.

**Dependencies:** M1-M7 complete

**Note:** Much of this already works via Craft Agents. This milestone is for verification and any missing pieces.

### Tasks

#### M8.1: Verify Working Directory Auto-Set

When workspace is created/opened, verify `config.defaults.workingDirectory` is set to workspace rootPath.

**Spec reference:** [tech-agents.md — Workspace Auto-Configuration — Working Directory](tech-agents.md#working-directory)

#### M8.2: Auto-Attach Workspace as Local Source

On workspace open, ensure a local source exists for the workspace root:

```typescript
// In workspace creation/open logic
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

**Spec reference:** [tech-agents.md — Auto-Attach Local Source](tech-agents.md#auto-attach-local-source)

#### M8.3: CLAUDE.md Auto-Loading

Verify `findAllProjectContextFiles()` from `packages/shared/src/prompts/system.ts` is called with `workingDirectory` set to workspace rootPath.

If not working, implement:

```typescript
// In session creation
const autoContext = await loadAutoContext(workspace.rootPath)
if (autoContext) {
  systemPrompt = autoContext + '\n\n' + systemPrompt
}
```

**Spec reference:** [tech-agents.md — CLAUDE.md / AGENTS.md Auto-Loading](tech-agents.md#claudemd--agentsmd-auto-loading)

#### M8.4: Skills Auto-Detection

Verify `loadAllSkills()` is called with `projectRoot` = workspace rootPath.

**Spec reference:** [tech-agents.md — Skills Discovery](tech-agents.md#skills-discovery)

#### M8.5: MCP Auto-Detection

Implement detection of `.claude/mcp.json` and `.agents/mcp.json`:

```typescript
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

Surface in Sources panel with "Local" badge.

**Spec reference:** [tech-agents.md — MCP Auto-Detection](tech-agents.md#mcp-auto-detection), [product-agent.md — MCP Auto-Detection](product-agent.md#mcp-auto-detection-new)

### Validation Criteria

- [ ] Create workspace with "Choose a location" → existing folder becomes workspace
- [ ] Workspace folder auto-attached as local source
- [ ] Agent cwd = workspace rootPath
- [ ] Create `CLAUDE.md` in workspace → new session includes it in system prompt
- [ ] Create `.claude/skills/` with a skill → skill appears in Skills panel
- [ ] Create `.claude/mcp.json` with MCP server → server appears in Sources panel with "Local" badge
- [ ] Agent can browse workspace files via local source
- [ ] Agent can read/write files in workspace

### Exit Criteria

✅ Workspace rootPath auto-set as working directory
✅ Workspace auto-attached as local source
✅ CLAUDE.md auto-loaded in system prompt
✅ Local skills auto-detected
✅ Local MCP servers auto-detected

---

## Milestone 9 (Optional): @ Mention System

**Goal:** Type `@` in chat input to trigger dropdown with Skills / Sources / Files.

**Dependencies:** M3 complete (file tree), M6 complete (chat input)

**Note:** Craft Agents already has this (`InlineMentionMenu` + `useInlineMention`). This milestone is verification + wiring to file tree.

### Tasks

#### M9.1: Verify @ Mention Menu Exists

Check if `InlineMentionMenu` component and `useInlineMention` hook exist in `components/chat/`.

If yes, verify it has sections for:
- Skills
- Sources
- Files
- Folders

**Spec reference:** [tech-agents.md — @ Mention System — What Already Exists](tech-agents.md#what-already-exists-vs-whats-new)

#### M9.2: Wire File Search to Workspace

Ensure @ mention menu's file search uses `fileTreeAtom` or calls `window.electronAPI.file.list()` to get workspace files.

```typescript
const fileResults = flattenFileTree(fileTreeAtom.get())
  .filter(node => node.type === 'file')
  .filter(node => fuzzyMatch(query, node.path))
```

#### M9.3: Test @ Mention Flow

1. Type `@` in chat input
2. Dropdown appears with Skills / Sources / Files sections
3. Type to filter (e.g., `@note` matches `notes/todo.md`)
4. Select a file
5. File badge appears in input
6. Send message
7. Verify agent receives `[file:path]` mention

### Validation Criteria

- [ ] `@` triggers dropdown menu
- [ ] Skills section shows all available skills
- [ ] Sources section shows all MCP/API sources
- [ ] Files section shows workspace files
- [ ] Typing filters results (fuzzy match)
- [ ] Selecting item inserts mention badge
- [ ] Multiple mentions can be added to one message
- [ ] Agent receives mentions correctly

### Exit Criteria

✅ @ mention menu working
✅ File search includes workspace files
✅ All mention types (skill, source, file) work
✅ Agent receives mentions correctly

---

## Post-MVP Enhancements

**Not in initial implementation plan, but documented in specs:**

- Backlinks and graph view ([product-design.md — Future Enhancements](product-design.md#future-enhancements-post-mvp))
- Note templates (daily note, meeting note, project)
- Full-text search across all notes
- File tree search / filter
- Quick note switcher (Cmd+P command palette)
- Recent notes list
- Pinned / favorited notes
- Session ↔ note soft linking
- Agent suggests edits with inline diff view
- Multiple notes open (tabs or split)
- Export as PDF
- Frontmatter editing UI
- Drag-and-drop file move in file tree

---

## Validation Strategy

### Per-Milestone Validation

Each milestone has a "Validation Criteria" checklist. Before marking a milestone complete:

1. Run all validation checks manually
2. Test in both dark and light mode
3. Test with an empty workspace and a populated workspace
4. Check for console errors
5. Verify no regressions in Craft Agents features

### Integration Testing (After M7)

Full app testing scenarios:

1. **New User Flow:**
   - Create new workspace (default location)
   - Create first note
   - Edit note, auto-save works
   - Start session, send message
   - Agent reads note (auto-tagging)
   - Agent edits note, editor reloads

2. **Existing Folder Flow:**
   - Open existing folder with notes
   - Browse file tree
   - Open note, edit, save
   - Switch notes via file tree
   - Create new note, rename, delete

3. **Agent Workflow:**
   - Open note in Note+Chat mode
   - Ask agent to summarize (auto-tagging sends file)
   - Ask agent to edit note (Write/Edit tool)
   - Verify editor reloads with changes
   - Switch to Chat tab, view history
   - Switch back to Note tab

4. **Keyboard Navigation:**
   - Cmd+N → new note
   - Cmd+E → switch to Chat tab
   - Cmd+E → switch back to Note tab
   - Cmd+1 → show sessions
   - Cmd+2 → show file tree
   - Cmd+S → save note

5. **Error Handling:**
   - Try to open non-existent file → toast error
   - Delete open file → editor clears
   - Edit file externally → editor reloads
   - Lose file permissions → error handled gracefully

### Performance Testing

- Type in editor with long document (>10k words) → no lag
- Switch between files rapidly → no lag
- File tree with 100+ files → renders smoothly
- Agent edits file with unsaved changes → conflict resolution works

---

## Dependencies & Risk Management

### External Dependencies

| Dependency | Risk | Mitigation |
|------------|------|------------|
| tiptap v3 stability | Medium | Use stable release, test early |
| tiptap markdown roundtrip | Medium | GFM enabled, test edge cases (tables, nested lists) |
| Craft Agents upstream changes | Low | Keep changes isolated, don't modify `packages/` |
| Electron file watcher reliability | Low | Use `fs.watch` with debounce, tested API |

### Internal Dependencies

| Milestone | Depends On | Blocking |
|-----------|------------|----------|
| M1 | M0 | All subsequent milestones |
| M2 | M1 | M3, M5, M6 |
| M3 | M2 | M4, M5 |
| M4 | M3 | M6, M7 |
| M5 | M2, M4 | - (optional for M6) |
| M6 | M4 | - |
| M7 | M1-M6 | - |
| M8 | M7 | - (optional) |
| M9 | M3, M6 | - (optional) |

### Risk Mitigation

1. **tiptap scaffolding fails:** Manually copy template files from tiptap docs
2. **Markdown roundtrip loses formatting:** Test early (M1), document limitations, adjust extension config
3. **Craft Agents layout hard to extend:** Study AppShell thoroughly in M4, keep changes minimal and additive
4. **File watcher doesn't detect changes:** Add manual refresh button as fallback
5. **Frontmatter corruption:** Extensive testing in M2, backup strategy (keep `.md.bak` on write)

---

## Session Planning

### Recommended Session Breakdown

**Session 1-2: M0 + M1**
- Install dependencies, scaffold tiptap, get basic editor rendering
- Exit: Editor works on test page

**Session 3-4: M2**
- File I/O layer, atoms, IPC handlers, markdown with frontmatter
- Exit: Can open/edit/save files

**Session 5-6: M3**
- File tree sidebar, create/rename/delete
- Exit: Full file browser working

**Session 7-8: M4**
- Layout integration, view toggle, tabs
- Exit: Three-panel layout with view switching

**Session 9-10: M5**
- File watcher, agent-editor sync
- Exit: Live reload on agent edits

**Session 11: M6**
- Auto-tagging in Note+Chat mode
- Exit: Current file auto-referenced

**Session 12-14: M7**
- Keyboard shortcuts, error handling, polish
- Exit: Daily-driver quality

**Session 15 (optional): M8**
- Workspace auto-configuration verification
- Exit: Agent context works

**Session 16 (optional): M9**
- @ mention system wiring
- Exit: @ file search working

### Between Sessions

- Document any deviations from plan in this file
- Update validation checklists as features are completed
- Note any new risks or blockers
- Update dependency graph if needed

---

## Success Criteria (Final)

Shards is complete when:

✅ All M0-M7 milestones complete (M8-M9 optional)
✅ Can create/edit/save markdown notes with frontmatter
✅ File tree shows workspace folder, click to open files
✅ Agent can read/write notes, editor reloads live
✅ Note+Chat mode auto-tags current file
✅ Three-panel layout with view toggle works
✅ Keyboard shortcuts implemented
✅ Dark/light theme works throughout
✅ No console errors in normal operation
✅ Can run daily as a second brain / note-taking app

---

## Document Status

| Milestone | Status | Completed Date | Notes |
|-----------|--------|----------------|-------|
| M0 | ⬜ Not Started | - | - |
| M1 | ⬜ Not Started | - | - |
| M2 | ⬜ Not Started | - | - |
| M3 | ⬜ Not Started | - | - |
| M4 | ⬜ Not Started | - | - |
| M5 | ⬜ Not Started | - | - |
| M6 | ⬜ Not Started | - | - |
| M7 | ⬜ Not Started | - | - |
| M8 | ⬜ Not Started | - | Optional |
| M9 | ⬜ Not Started | - | Optional |

**Last Updated:** 2026-02-13
**Next Milestone:** M0 (Dependencies & Setup)
