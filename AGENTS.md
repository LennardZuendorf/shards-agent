# Craft Agents - Project Guidelines for AI Agents

## Project Overview

Craft Agents is an Electron-based desktop application that provides an intuitive interface for working with AI agents. It's built with the Claude Agent SDK and enables multitasking, API/MCP connections, session management, and a document-centric workflow.

**Key Philosophy**: Agent-native software principles - built with Craft Agents, customizable through prompts.

## Architecture & Stack

### Monorepo Structure
```
craft-agents-oss/
├── apps/
│   ├── electron/              # Primary desktop GUI
│   │   ├── src/
│   │   │   ├── main/         # Electron main process
│   │   │   ├── preload/      # Context bridge
│   │   │   └── renderer/     # React UI (Vite + shadcn)
│   └── viewer/               # Session viewer app
└── packages/
    ├── core/                 # @craft-agent/core - Shared types
    ├── shared/               # @craft-agent/shared - Business logic
    ├── ui/                   # @craft-agent/ui - React components
    └── mermaid/              # Mermaid diagram support
```

### Tech Stack
- **Runtime**: Bun (required for all operations)
- **AI**: @anthropic-ai/claude-agent-sdk
- **Desktop**: Electron + React 18
- **UI**: shadcn/ui + Tailwind CSS v4
- **Build**: esbuild (main/preload) + Vite (renderer)
- **State**: Jotai for React state management
- **TypeScript**: Strict mode enabled with comprehensive type checking

## Development Workflow

### Package Manager
**ALWAYS use Bun** - never use npm, yarn, or pnpm:
```bash
bun install              # Install dependencies
bun run <script>         # Run scripts
bun test                 # Run tests
```

### Development Commands
```bash
bun run electron:dev              # Hot reload development
bun run electron:start            # Build and run
bun run typecheck:all             # Type check all packages
bun run lint                      # Lint electron and shared packages
bun run lint:fix                  # Auto-fix lint issues (electron only)
```

### Before Committing
1. **Type check**: `bun run typecheck:all` must pass
2. **Lint**: `bun run lint` must pass without errors
3. **Test**: Verify changes don't break existing functionality
4. **Build**: Ensure `bun run electron:build` succeeds

## Code Style & Standards

### TypeScript Guidelines
- **Strict mode enabled**: All TypeScript strict checks are enforced
- Use explicit types for function parameters and return values
- Prefer `interface` for object shapes, `type` for unions/intersections
- Enable `noUncheckedIndexedAccess: true` - always check array/object access
- No `any` types - use `unknown` if type is truly unknown
- Use `satisfies` operator for type narrowing when appropriate

### Import Conventions
- Use workspace imports for internal packages:
  ```typescript
  import { type Session } from '@craft-agent/core'
  import { SessionManager } from '@craft-agent/shared'
  ```
- Group imports: external packages → workspace packages → relative imports
- Use `type` imports when importing only types: `import { type MyType } from '...'`

### React & Component Standards
- **Functional components only** - no class components
- Use React Hooks properly - follow rules of hooks
- Prefer `const` arrow functions for components
- Use proper TypeScript typing for props (no implicit `any`)
- Follow shadcn/ui patterns for consistent UI components
- State management: Use Jotai atoms for global state, local state for component-specific

### Naming Conventions
- **Files**: PascalCase for components (`SessionList.tsx`), camelCase for utilities (`icon-cache.ts`)
- **Components**: PascalCase (`SessionList`, `ChatDisplay`)
- **Functions**: camelCase (`createSession`, `handleSubmit`)
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase for config objects
- **Types/Interfaces**: PascalCase (`SessionConfig`, `SourceInfo`)

### Custom ESLint Rules (Electron App)
These custom rules are enforced and must be followed:

1. **craft-agent/no-direct-navigation-state** (error)
   - Use the `navigate()` function instead of directly setting navigation state
   - Ensures consistent navigation across the app

2. **craft-agent/no-localstorage** (warn)
   - Avoid using localStorage directly
   - Use the config/storage system instead for persistence

3. **craft-platform/no-direct-platform-check** (error)
   - Don't use `process.platform` checks directly
   - Use platform utility functions for cross-platform compatibility

4. **craft-paths/no-hardcoded-path-separator** (warn)
   - Never hardcode `/` or `\` in paths
   - Use `path.join()`, `path.resolve()`, or path utilities

5. **craft-links/no-direct-file-open** (error)
   - Don't bypass the in-app file preview system
   - Use the link interceptor for file operations

## File & Path Handling

### Cross-Platform Paths
- **ALWAYS** use Node's `path` module for path operations
- **NEVER** hardcode path separators (`/` or `\`)
- Use `path.join()` for combining paths
- Use `path.resolve()` for absolute paths
- Use `path.dirname()`, `path.basename()`, `path.extname()` for path manipulation

```typescript
// ❌ BAD
const filePath = `${dir}/file.txt`
const configPath = `~/.craft-agent/config.json`

// ✅ GOOD
import path from 'node:path'
const filePath = path.join(dir, 'file.txt')
const configPath = path.join(os.homedir(), '.craft-agent', 'config.json')
```

### Configuration Storage
- User config location: `~/.craft-agent/`
- Workspaces: `~/.craft-agent/workspaces/{id}/`
- Credentials: Encrypted with AES-256-GCM in `credentials.enc`
- Never use localStorage - use the config system

## Agent & Session Management

### Key Concepts
- **Sessions**: Persistent conversations stored as JSONL files
- **Workspaces**: Organizational units containing sessions, sources, skills, and statuses
- **Sources**: MCP servers, REST APIs, or local filesystem connections
- **Skills**: Specialized agent instructions stored per-workspace
- **Statuses**: Customizable workflow states (Todo, In Progress, Done, etc.)

### Permission Modes
Three levels of agent permissions:
- `safe` (Explore): Read-only, blocks all write operations
- `ask` (Ask to Edit): Prompts for approval - default mode
- `allow-all` (Auto): Auto-approves all commands

## MCP & Sources Integration

### MCP Server Types
1. **Remote MCP**: HTTP-based MCP servers
2. **Local MCP**: stdio-based local subprocesses (npx, Python scripts, binaries)
3. **REST APIs**: Direct API integrations (Google, Slack, Microsoft)
4. **Local Filesystem**: File system access and Git repos

### Security - Environment Variable Filtering
When spawning local MCP servers, sensitive env vars are automatically filtered:
- Authentication: `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`
- Cloud providers: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`
- API keys: `GITHUB_TOKEN`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`, `STRIPE_SECRET_KEY`, `NPM_TOKEN`

To explicitly pass an env var to a specific MCP server, use the `env` field in source config.

## Large Response Handling

Tool responses exceeding ~60KB are automatically summarized using Claude Haiku with intent-aware context. The `_intent` field is injected into MCP tool schemas to preserve summarization focus.

## UI & Styling

### Tailwind CSS v4
- Use Tailwind utility classes for styling
- Follow shadcn/ui component patterns
- Use CSS variables for theming (defined in theme system)
- Responsive design: mobile-first approach
- Dark mode: Managed through next-themes

### Keyboard Shortcuts
Standard shortcuts:
- `Cmd+N`: New chat
- `Cmd+1/2/3`: Focus sidebar/list/chat
- `Cmd+/`: Keyboard shortcuts dialog
- `SHIFT+TAB`: Cycle permission modes
- `Enter`: Send message
- `Shift+Enter`: New line

## Testing & Quality Assurance

### Type Checking
- Run `bun run typecheck:all` before committing
- Fix all TypeScript errors - no suppressions without justification
- Ensure no `@ts-ignore` or `@ts-expect-error` without comments explaining why

### Linting
- ESLint flat config format (ESLint 9+)
- Custom rules are enforced - respect them
- Auto-fix where possible: `bun run lint:fix` (electron only)

### Manual Testing
- Test in both light and dark mode
- Verify cross-platform path handling (macOS/Linux/Windows)
- Check permission mode behavior (safe/ask/allow-all)
- Test with multiple workspaces and sessions

## Common Patterns

### IPC Communication (Electron)
- Main process handlers in `apps/electron/src/main/ipc.ts`
- Preload context bridge in `apps/electron/src/preload/index.ts`
- Renderer invokes via `window.api.*` methods
- Always type IPC channels properly

### State Management with Jotai
- Define atoms in appropriate context/hooks files
- Use `useAtom` for read/write, `useAtomValue` for read-only, `useSetAtom` for write-only
- Derived atoms for computed values
- Atom families for dynamic collections

### Error Handling
- Use try-catch for async operations
- Log errors with electron-log in main process
- Show user-friendly error messages in UI
- Never swallow errors silently

## Deep Linking

External apps can navigate using `craftagents://` URLs:
```
craftagents://allChats                    # All chats view
craftagents://allChats/chat/session123    # Specific chat
craftagents://settings                    # Settings
craftagents://sources/source/github       # Source info
craftagents://action/new-chat             # Create new chat
```

## Environment Variables

OAuth integrations require credentials in `.env`:
```bash
MICROSOFT_OAUTH_CLIENT_ID=your-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-secret
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
SLACK_OAUTH_CLIENT_ID=your-slack-client-id
SLACK_OAUTH_CLIENT_SECRET=your-slack-client-secret
```

See `.env.example` for the template.

## Git & Version Control

### Branch Naming
- `feature/add-new-tool` - New features
- `fix/resolve-auth-issue` - Bug fixes
- `refactor/simplify-agent-loop` - Code refactoring
- `docs/update-readme` - Documentation updates

### Commit Messages
- Use clear, descriptive commit messages
- Start with verb in present tense (Add, Fix, Update, Refactor)
- Reference issue numbers when applicable
- Keep first line under 72 characters

### Pull Requests
- Title: Clear and descriptive
- Description: Explain what, why, and how
- Testing: Describe how changes were tested
- Screenshots: Include for UI changes

## License & Attribution

- **License**: Apache License 2.0
- **Third-party**: Claude Agent SDK subject to Anthropic's Commercial Terms
- **Trademark**: "Craft" and "Craft Agents" are trademarks of Craft Docs Ltd.
- See LICENSE, TRADEMARK.md, and SECURITY.md for details

## Getting Help

- Check README.md for installation and setup
- Review CONTRIBUTING.md for contribution guidelines
- Consult SECURITY.md for security considerations
- Open issues for bugs or feature requests
- Start discussions for questions or ideas

---

**Remember**: Craft Agents is built with agent-native principles. When in doubt, describe what you need and let the agent figure out how. Make changes that align with the project's philosophy of intuitive, prompt-driven workflows.
