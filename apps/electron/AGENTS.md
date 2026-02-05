# Craft Agents Electron App - Architecture & Patterns

This file provides guidance to AI agents when working with the Electron desktop application.

**Important:** Keep this file up-to-date when architectural patterns change.

## Overview

The Electron app provides the primary desktop GUI for Craft Agents. It's a multi-process application with a main process (Node.js), preload script (context bridge), and renderer process (React + Vite).

## Architecture

### Three-Process Model

```
┌─────────────────────────────────────────────────┐
│ Main Process (Node.js)                          │
│ - Agent execution (CraftAgent)                  │
│ - Session management (SessionManager)           │
│ - Window management (WindowManager)             │
│ - IPC handlers                                  │
│ - File system access                            │
│ - Deep linking                                  │
└──────────────────┬──────────────────────────────┘
                   │
                   │ IPC Communication
                   │
┌──────────────────▼──────────────────────────────┐
│ Preload (Context Bridge)                        │
│ - Type-safe IPC interface                       │
│ - Security boundary                             │
│ - Exposes window.electronAPI                    │
└──────────────────┬──────────────────────────────┘
                   │
                   │
┌──────────────────▼──────────────────────────────┐
│ Renderer (React + Vite)                         │
│ - UI components (shadcn/ui)                     │
│ - State management (Jotai)                      │
│ - Context providers                             │
│ - Chat interface                                │
│ - Settings, sources, skills UI                  │
└─────────────────────────────────────────────────┘
```

## Directory Structure

```
src/
├── main/                   # Main process (Node.js + Electron API)
│   ├── index.ts           # Entry point, window creation, auto-update
│   ├── ipc.ts             # IPC handlers registry
│   ├── sessions.ts        # SessionManager (wraps CraftAgent)
│   ├── window-manager.ts  # Multi-window management
│   ├── onboarding.ts      # Setup flow IPC handlers
│   ├── deep-link.ts       # craftagents:// URL handling
│   └── logger.ts          # electron-log configuration
│
├── preload/               # Context bridge (isolated)
│   └── index.ts          # ElectronAPI interface, Sentry init
│
├── renderer/              # React UI (Vite + TypeScript)
│   ├── App.tsx           # Root component, routing
│   ├── main.tsx          # React root, providers, Sentry
│   ├── components/       # UI components
│   │   ├── app-shell/   # Layout, sidebar, navigation
│   │   ├── chat/        # Chat interface, messages, toolbar
│   │   ├── settings/    # Settings pages
│   │   ├── onboarding/  # Setup wizard
│   │   ├── workspace/   # Workspace management
│   │   ├── files/       # File attachments, previews
│   │   └── ui/          # shadcn/ui components
│   ├── context/         # React Context providers
│   │   ├── ThemeContext.tsx        # Theme management
│   │   ├── AppShellContext.tsx     # Layout state
│   │   ├── FocusContext.tsx        # Focus mode
│   │   ├── ModalContext.tsx        # Modal state
│   │   └── StoplightContext.tsx    # macOS traffic lights
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities
│   └── styles/          # Global CSS, Tailwind config
│
└── shared/               # Types shared between processes
    └── types.ts         # IPC channels, session events, types
```

## IPC Communication

### Pattern: Type-Safe IPC

All IPC communication flows through a type-safe interface:

1. **Define channels** in `shared/types.ts`:
```typescript
export const IPC_CHANNELS = {
  GET_SESSIONS: 'sessions:get-all',
  SEND_MESSAGE: 'sessions:send-message',
  // ... more channels
} as const
```

2. **Register handlers** in `main/ipc.ts`:
```typescript
ipcMain.handle(IPC_CHANNELS.SEND_MESSAGE, async (_event, sessionId, message, attachments) => {
  return sessionManager.sendMessage(sessionId, message, attachments)
})
```

3. **Expose to renderer** in `preload/index.ts`:
```typescript
const api: ElectronAPI = {
  sendMessage: (sessionId, message, attachments) => 
    ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, sessionId, message, attachments),
}
contextBridge.exposeInMainWorld('electronAPI', api)
```

4. **Use in renderer**:
```typescript
await window.electronAPI.sendMessage(sessionId, message, attachments)
```

### Event Streaming Pattern

For real-time updates (session events, progress):

**Main process** emits events:
```typescript
window.webContents.send(IPC_CHANNELS.SESSION_EVENT, sessionEvent)
```

**Renderer** subscribes with cleanup:
```typescript
useEffect(() => {
  const cleanup = window.electronAPI.onSessionEvent((event) => {
    // Handle event
  })
  return cleanup // Unsubscribe on unmount
}, [])
```

## Main Process Patterns

### SessionManager (`main/sessions.ts`)

Wraps `CraftAgent` from `@craft-agent/shared` to provide:
- Multi-session support (one agent instance per session)
- Permission request handling
- OAuth callback routing
- Credential prompting
- Live config watching

**Key methods:**
- `createSession(workspaceId, options)` - Creates new chat session
- `sendMessage(sessionId, message, attachments)` - Sends message to agent
- `cancelProcessing(sessionId)` - Cancels active agent run
- `getSessions()` - Returns all sessions with metadata

### WindowManager (`main/window-manager.ts`)

Manages multiple workspace windows:
- One window per workspace (focus existing if already open)
- Window-to-workspace mapping
- Deep link routing to appropriate window
- Traffic light visibility (macOS)

**Key methods:**
- `focusOrCreateWindow(workspaceId)` - Opens or focuses workspace window
- `createWindow(options)` - Creates new window with initial state
- `getWorkspaceForWindow(webContentsId)` - Maps window to workspace

### Security Patterns

**Path validation** (`validateFilePath` in `main/ipc.ts`):
- Only allows access to home directory and temp directory
- Blocks path traversal attacks
- Blocks sensitive files (`.ssh/`, `.aws/credentials`, `.env`, etc.)
- Resolves symlinks to prevent bypass

**Filename sanitization** (`sanitizeFilename` in `main/ipc.ts`):
- Removes path separators and forbidden characters
- Prevents hidden files and extension tricks
- Limits length to 200 characters

**Always use these when handling user-provided paths or filenames.**

## Renderer Process Patterns

### Component Architecture

**Composition over prop drilling:**
- Use Context for cross-cutting concerns (theme, focus mode, modal state)
- Use Jotai atoms for global state (sessions, navigation, workspace)
- Keep component-specific state local

**Component guidelines:**
- **Functional components only** - no class components
- Use `const` arrow functions
- Explicit prop types (no implicit `any`)
- Prefer composition with children
- Extract reusable logic to custom hooks

### State Management with Jotai

**Atoms are defined close to usage:**
```typescript
// Define atom
const sessionsAtom = atom<Session[]>([])

// Read/write
const [sessions, setSessions] = useAtom(sessionsAtom)

// Read-only
const sessions = useAtomValue(sessionsAtom)

// Write-only
const setSessions = useSetAtom(sessionsAtom)
```

**Derived atoms for computed values:**
```typescript
const activeChatAtom = atom((get) => {
  const sessions = get(sessionsAtom)
  const activeId = get(activeChatIdAtom)
  return sessions.find(s => s.id === activeId)
})
```

**Async atoms for data fetching:**
```typescript
const sessionMessagesAtom = atomFamily((sessionId: string) =>
  atom(async () => {
    return await window.electronAPI.getSessionMessages(sessionId)
  })
)
```

### Context Providers

**ThemeContext** (`context/ThemeContext.tsx`):
- Manages light/dark mode and custom themes
- Watches theme config files for live updates
- Applies CSS variables to document
- Cascades: system → app → workspace

**AppShellContext** (`context/AppShellContext.tsx`):
- Sidebar visibility and width
- Layout state (focused view, etc.)
- Navigation state

**FocusContext** (`context/FocusContext.tsx`):
- Focus mode toggle (hides sidebar/chrome)
- Keyboard shortcut handling

**ModalContext** (`context/ModalContext.tsx`):
- Centralized modal state management
- Stacking support for nested modals

**StoplightContext** (`context/StoplightContext.tsx`):
- macOS traffic light visibility control
- Coordinates with sidebar state

### Navigation Pattern

**Use the `navigate()` function** instead of directly setting state:
```typescript
// ❌ DON'TSET navigation state directly
setNavigationState({ screen: 'settings' })

// ✅ DO use navigate() function
navigate({ screen: 'settings' })
```

This is enforced by the custom ESLint rule `craft-agent/no-direct-navigation-state`.

### Styling with Tailwind CSS v4

**Utility-first approach:**
```tsx
<div className="flex items-center gap-2 px-4 py-2 rounded-md bg-background shadow-minimal">
  <Icon className="w-4 h-4 text-foreground/70" />
  <span className="text-sm font-medium">Label</span>
</div>
```

**Theme colors via CSS variables:**
- `bg-background`, `text-foreground`
- `bg-accent`, `text-accent-foreground`
- `bg-info`, `bg-success`, `bg-destructive`

**Responsive design:**
- Mobile-first: `flex-col md:flex-row`
- Breakpoints: `sm`, `md`, `lg`, `xl`, `2xl`

**Dark mode:**
- Managed through ThemeContext
- Use Tailwind's dark mode utilities when needed: `dark:bg-slate-900`

### Custom Hooks

**useDebounce** - Debounce value changes
**useKeyboard** - Keyboard shortcut registration
**useWorkspace** - Current workspace data
**useSessions** - Session list with real-time updates
**useSessionMessages** - Lazy-load session messages

## Key UI Patterns

### Chat Interface (`components/chat/`)

**Message rendering:**
- Markdown with syntax highlighting (Shiki)
- Code blocks with copy button
- Image attachments with lightbox
- Thinking blocks (collapsible)

**Permission requests:**
- Inline approval UI in chat
- Remember choice checkbox
- Permission mode indicator

**Toolbar:**
- Model selector
- Permission mode toggle (SHIFT+TAB)
- Session options menu

### File Attachments (`components/files/`)

**Drag-and-drop:**
- Dropzone component with visual feedback
- Multiple file support
- Size/type validation

**Previews:**
- Images: inline preview with thumbnail generation
- PDFs: first page preview via MarkItDown
- Other: file icon + metadata

**Storage:**
- Attachments stored in `~/.craft-agent/workspaces/{id}/attachments/{sessionId}/`
- Original filename preserved, sanitized for filesystem
- Referenced by ID in session JSON

### Settings Pages (`components/settings/`)

**API Setup:**
- Auth type selector (Anthropic, Claude.ai, Custom)
- API key management (secure credential storage)
- Connection testing

**Workspace Settings:**
- Sources management (add/remove/configure MCP)
- Skills management
- Statuses customization
- Theme editor

**Preferences:**
- Default permission mode
- Extended cache TTL
- Token display mode

## Deep Linking

External apps can navigate using `craftagents://` URLs:

**URL format:**
```
craftagents://allChats                    # All chats view
craftagents://allChats/chat/session123    # Specific chat
craftagents://settings                    # Settings
craftagents://sources/source/github       # Source info
craftagents://action/new-chat             # Create new chat
```

**Handler** in `main/deep-link.ts`:
1. Parses URL
2. Routes to appropriate window (or creates new one)
3. Sends navigation event to renderer

**Renderer** listens via `onDeepLinkNavigate`:
```typescript
useEffect(() => {
  return window.electronAPI.onDeepLinkNavigate((nav) => {
    navigate(nav) // Apply navigation
  })
}, [])
```

## Build & Development

### Development Mode
```bash
bun run electron:dev    # Hot reload (Vite HMR)
```

**Process:**
1. Vite dev server starts (renderer)
2. esbuild watches main/preload in parallel
3. Electron launches and connects to Vite
4. Changes trigger hot reload

### Production Build
```bash
bun run electron:build   # Build all processes
bun run electron:start   # Run production build
```

**Output:**
- Main: `dist-electron/main.js` (esbuild bundle)
- Preload: `dist-electron/preload.js` (esbuild bundle)
- Renderer: `dist/` (Vite production build)

### Type Checking
```bash
bun run typecheck:all    # Type check all packages
```

### Linting
```bash
bun run lint             # Lint electron + shared
bun run lint:fix         # Auto-fix (electron only)
```

## Error Handling & Logging

### Main Process
- Use `electron-log` for structured logging
- Different log levels: `ipcLog`, `windowLog`, `searchLog`
- Logs written to: `~/Library/Logs/Craft Agent/main.log` (macOS)

### Renderer
- Sentry error tracking (renderer init in `main.tsx`)
- Console integration: `console.warn/error` sent to Sentry
- Scrubs sensitive data (tokens, keys, passwords)

### Error Boundaries
- Top-level: `Sentry.ErrorBoundary` with `CrashFallback` component
- Component-level: Wrap risky components in error boundaries

## Common Gotchas

### Don't Use localStorage
❌ Avoid `localStorage` - it's not persistent across Electron restarts in some cases.
✅ Use the config system (`@craft-agent/shared/config`) instead.

Enforced by custom ESLint rule `craft-agent/no-localstorage`.

### Cross-Platform Paths
❌ Never hardcode `/` or `\\` in paths.
✅ Always use Node's `path` module: `path.join()`, `path.resolve()`.

Enforced by custom ESLint rule `craft-paths/no-hardcoded-path-separator`.

### Platform Checks
❌ Don't use `process.platform` directly.
✅ Use platform utility functions for consistent behavior.

Enforced by custom ESLint rule `craft-platform/no-direct-platform-check`.

### File Operations
❌ Don't bypass the file preview system with `shell.openPath()`.
✅ Use the link interceptor for proper file handling.

Enforced by custom ESLint rule `craft-links/no-direct-file-open`.

## Testing Checklist

Before committing changes to the electron app:

- [ ] Type check passes: `bun run typecheck:all`
- [ ] Lint passes: `bun run lint`
- [ ] Build succeeds: `bun run electron:build`
- [ ] Test in both light and dark mode
- [ ] Test with multiple workspaces
- [ ] Test permission modes (safe/ask/allow-all)
- [ ] Verify cross-platform paths (no hardcoded separators)
- [ ] Check for sensitive data in logs/errors

## Integration with Shared Package

The electron app heavily depends on `@craft-agent/shared`:

**Main process:**
- `CraftAgent` - Agent execution
- `SessionManager` wrapper - Multi-session support
- `loadStoredConfig`, `saveConfig` - Configuration
- `getCredentialManager` - Secure credential storage
- `loadWorkspaceSources` - Source management

**Renderer:**
- Types from `@craft-agent/core`
- No direct import of main-process-only code

**Important:** Changes to `@craft-agent/shared` APIs may require updates in electron app IPC handlers and UI components.

---

**Note**: This is the user-facing desktop application. UI/UX changes should prioritize clarity and ease of use, following agent-native principles.
