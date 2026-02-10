# @craft-agent/shared - Core Business Logic

This file provides guidance to AI agents when working with code in this package.

**Important:** Keep this file up-to-date whenever functionality changes.

## Overview

`@craft-agent/shared` is the core business logic package for Craft Agent. It contains:
- Agent implementation (CraftAgent, session-scoped tools, permission modes)
- Authentication (OAuth, credentials, auth state)
- Configuration (storage, preferences, themes, watcher)
- MCP client and validation
- Headless execution mode
- Dynamic status system
- Session persistence
- Skills system

## Package Exports

This package uses subpath exports for clean imports:

```typescript
import { CraftAgent, getPermissionMode, setPermissionMode } from '@craft-agent/shared/agent';
import { loadStoredConfig, type Workspace } from '@craft-agent/shared/config';
import { getCredentialManager } from '@craft-agent/shared/credentials';
import { CraftMcpClient } from '@craft-agent/shared/mcp';
import { loadWorkspaceSources, type LoadedSource } from '@craft-agent/shared/sources';
import { loadStatusConfig, createStatus } from '@craft-agent/shared/statuses';
import { loadSkills, type Skill } from '@craft-agent/shared/skills';
import { resolveTheme } from '@craft-agent/shared/config/theme';
import { debug } from '@craft-agent/shared/utils';
```

## Directory Structure

```
src/
├── agent/              # CraftAgent, session-scoped-tools, mode-manager, mode-types, permissions-config
├── auth/               # OAuth, craft-token, claude-token, state
├── config/             # Storage, preferences, models, theme, watcher
├── credentials/        # Secure credential storage (AES-256-GCM)
├── headless/           # Non-interactive execution mode
├── mcp/                # MCP client and connection validation
├── prompts/            # System prompt generation
├── sessions/           # Session index, storage, persistence-queue
├── skills/             # Skill types, storage, CRUD, discovery, import
├── sources/            # Source types, storage, service
├── statuses/           # Dynamic status types, CRUD, storage
├── subscription/       # Craft subscription checking
├── utils/              # Debug logging, file handling, summarization
├── validation/         # URL validation
├── version/            # Version management, install scripts
├── workspaces/         # Workspace storage
├── branding.ts         # Branding constants
└── network-interceptor.ts    # Fetch interceptor for API errors and MCP schema injection
```

## Key Concepts

### CraftAgent (`src/agent/craft-agent.ts`)
The main agent class that wraps the Claude Agent SDK. Handles:
- MCP server connections
- Tool permissions via PreToolUse hook
- Large result summarization via PostToolUse hook (~60KB threshold)
- Permission mode integration (safe/ask/allow-all)
- Session continuity and state management

### Permission Modes (`src/agent/mode-manager.ts`, `mode-types.ts`)
Three-level permission system per session:

| Mode | Display Name | Behavior |
|------|--------------|----------|
| `'safe'` | Explore | Read-only, blocks write operations |
| `'ask'` | Ask to Edit | Prompts for bash commands (default) |
| `'allow-all'` | Auto | Auto-approves all commands |

- **Per-session state**: No global contamination between sessions
- **Keyboard shortcut**: SHIFT+TAB cycles through modes
- **UI config**: `PERMISSION_MODE_CONFIG` provides display names, colors, SVG icons

### Permissions Configuration (`src/agent/permissions-config.ts`)
Customizable safety rules at two levels (additive merging):
- Workspace: `~/.craft-agent/workspaces/{id}/permissions.json`
- Source: `~/.craft-agent/workspaces/{id}/sources/{slug}/permissions.json`

**Rule types:**
- `blockedTools` - Tools to block (extends defaults)
- `allowedBashPatterns` - Regex for read-only bash commands
- `allowedMcpPatterns` - Regex for allowed MCP tools
- `allowedApiEndpoints` - Fine-grained API rules `{ method, pathPattern }`
- `allowedWritePaths` - Glob patterns for writable directories

### Session-Scoped Tools (`src/agent/session-scoped-tools.ts`)
Tools available within agent sessions with callback registry:

**Source management:** `source_test`, `source_oauth_trigger`, `source_google_oauth_trigger`, `source_credential_prompt`

**Utilities:** `SubmitPlan`, `config_validate`

**Callbacks:** `onPlanSubmitted`, `onOAuthBrowserOpen`, `onOAuthSuccess`, `onOAuthError`, `onCredentialRequest`, `onSourcesChanged`, `onSourceActivated`

### Skills System (`src/skills/`)
Specialized agent instructions stored per-workspace:

**Storage:** `~/.craft-agent/workspaces/{id}/skills/{slug}/`

**Structure:** Each skill contains:
- `skill.json` - Metadata (name, description, slug, tags)
- `instructions.md` - Agent instructions in markdown

**Discovery:** `discovery.ts` provides auto-discovery of skills from:
- Local filesystem directories
- MCP servers (via `skills/list` tool)
- Import from external sources

**CRUD:** `createSkill()`, `updateSkill()`, `deleteSkill()`, `loadSkills()`

**Activation:** Skills can be attached to specific sessions to customize agent behavior

### Dynamic Status System (`src/statuses/`)
Workspace-level customizable workflow states:

**Storage:** `~/.craft-agent/workspaces/{id}/statuses/config.json`

**Status properties:** `id`, `label`, `color`, `icon`, `shortcut`, `category` (open/closed), `isFixed`, `isDefault`, `order`

**Default statuses:** Todo, In Progress, Needs Review, Done, Cancelled

**CRUD:** `createStatus()`, `updateStatus()`, `deleteStatus()`, `reorderStatuses()`

### Theme System (`src/config/theme.ts`)
Cascading theme configuration: app → workspace (last wins)

**Storage:**
- App: `~/.craft-agent/config/theme.json`
- Workspace: `~/.craft-agent/workspaces/{id}/theme.json`

**6-color system:** `background`, `foreground`, `accent`, `info`, `success`, `destructive`

**Functions:** `resolveTheme()`, `themeToCSS()`, dark mode support via `dark: { ... }` overrides

### Session Persistence (`src/sessions/`)
- **persistence-queue.ts**: Debounced async session writes (500ms)
- **storage.ts**: Session CRUD, portable path format
- **index.ts**: Session listing and metadata

### Credentials (`src/credentials/`)
All sensitive credentials (API keys, OAuth tokens) are stored in an AES-256-GCM encrypted file at `~/.craft-agent/credentials.enc`. The `CredentialManager` provides the API for reading and writing credentials.

**Security features:**
- Master key derived from machine-specific hardware ID
- Per-credential encryption with unique IVs
- Automatic rotation on credential updates

### Bridge MCP Server Credential Flow

For Codex sessions, API sources use the Bridge MCP Server which runs as a subprocess. Since it can't access the encrypted credentials directly, a **passive credential refresh** model is used:

```
┌─────────────────────────────────────────────────────────────────┐
│ Main Process (Electron)                                          │
│                                                                  │
│  1. User enables API source in session                          │
│  2. decrypt credential from credentials.enc                      │
│  3. write to .credential-cache.json (permissions: 0600)         │
│     └── ~/.craft-agent/workspaces/{ws}/sources/{slug}/          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ reads on each request
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Bridge MCP Server (subprocess)                                   │
│                                                                  │
│  1. On tool call, read fresh credential from cache file         │
│  2. Check expiresAt - if expired, return auth error             │
│  3. Inject auth header and make API request                     │
└─────────────────────────────────────────────────────────────────┘
```

**Key characteristics:**
- **Passive refresh:** Bridge reads cache on each request (no active polling)
- **Token expiry:** If OAuth token expires mid-session, requests fail with auth error
- **User action required:** To refresh expired tokens, user must re-authenticate in UI
- **Security:** Cache files have 0600 permissions (owner read/write only)

**Files involved:**
- Write: `apps/electron/src/main/sessions.ts` → `setupCodexSessionConfig()`
- Read: `packages/bridge-mcp-server/src/index.ts` → `readCredential()`

### Configuration (`src/config/storage.ts`)
Multi-workspace configuration stored in `~/.craft-agent/config.json`. Supports:
- Multiple workspaces with separate MCP servers and sessions
- Default permission mode for new sessions
- Extended cache TTL preference
- Token display mode
- Model preferences (global and per-workspace)

### Config Watcher (`src/config/watcher.ts`)
File watcher for live config updates:
- Watches `config.json`, `theme.json`, `permissions.json` at all levels
- Callbacks: `onConfigChange`, `onThemeChange`, `onWorkspacePermissionsChange`, `onSourcePermissionsChange`
- Automatic reload without restart

### Sources (`src/sources/`)
Sources are external data connections (MCP servers, APIs, local filesystems). Stored at `~/.craft-agent/workspaces/{id}/sources/{slug}/` with config.json and guide.md.

**Types:**
- `mcp` - Local or remote MCP servers
- `api` - REST API integrations
- `local` - Local filesystem/Git repos
- `gmail` - Gmail integration

**Environment variable filtering**: Sensitive env vars (API keys, tokens) are automatically filtered when spawning local MCP servers for security.

### Network Interceptor (`src/network-interceptor.ts`)
Global fetch interceptor that:
- Adds `_intent` field to MCP tool schemas for summarization context
- Handles API errors and rate limiting
- Provides centralized error handling

## Code Patterns

### TypeScript Best Practices
- Strict mode enabled - all checks enforced
- Explicit types for function parameters and return values
- Prefer `interface` for object shapes, `type` for unions
- No `any` types - use `unknown` if type is truly unknown
- Enable `noUncheckedIndexedAccess: true` - always check array/object access

### Path Handling
- **ALWAYS** use Node's `path` module for path operations
- **NEVER** hardcode path separators (`/` or `\\`)
- Use `path.join()` for combining paths
- Use `path.resolve()` for absolute paths

### Error Handling
- Use try-catch for async operations
- Log errors appropriately with context
- Provide user-friendly error messages
- Never swallow errors silently

## Dependencies

- `@craft-agent/core` - Shared types
- `@anthropic-ai/claude-agent-sdk` - Claude Agent SDK

## Testing

### Type Checking
```bash
# From monorepo root
cd packages/shared && bun run tsc --noEmit
```

### Linting
```bash
# From monorepo root
bun run lint
```

## Integration with Electron App

The electron app (`apps/electron`) consumes this package extensively:
- Main process: Agent execution, session management, IPC handlers
- Renderer: Configuration UI, session display, source management

Key integration points:
- `SessionManager` (main) wraps `CraftAgent` for multi-session support
- IPC channels expose agent functionality to renderer
- Config watcher enables live updates without restart

---

**Note**: This package is the core of Craft Agents - changes here impact the entire application. Test thoroughly and update documentation when making changes.
