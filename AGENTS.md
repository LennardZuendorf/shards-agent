# Shards

AI-powered second brain. Fork of [Craft Agents](https://github.com/lukilabs/craft-agents-oss) extended with a tiptap v3 markdown editor, file tree sidebar, and note-taking-first workflow. Editor-first, local-first (plain `.md` files on disk), minimal and opinionated.

## Workflow — FOLLOW THIS EXACTLY

Every session follows this loop. Do not skip steps.

### 1. Read Specs
Run `/spec` to load the plan and relevant specs. Read `.spec/plan.md` to find the current milestone and its tasks. Read the referenced product/tech branch docs as needed.

### 2. Build (Feature Dev)
Use `/feature-dev` to implement the current milestone's tasks. This runs the full feature dev workflow: codebase exploration → clarifying questions → architecture design → implementation → review. Always use `bun`/`bunx`, never `npm`/`npx`.

### 3. Simplify
After building, review the code for over-engineering. Remove unnecessary abstractions, dead code, and complexity. Keep it minimal.

### 4. Validate
After every change, tell the user exactly what to manually verify and how. Always include:
- The specific command(s) to run (e.g. `bun run electron:dev`)
- What to look for (e.g. "app launches without errors", "SCSS compiles", "editor renders")
- Any UI interactions to test (e.g. "click X, expect Y")

Do NOT mark a milestone complete until the user has confirmed validation passes or explicitly says to move on.

### 5. Update Plan
Update `.spec/plan.md` to reflect what was completed:
- Check off finished tasks (`- [x]`)
- Update the status tracking table (status, date, sessions used, notes)
- Update the "Total Sessions Used", "Last Updated", "Next Milestone", and "Status" fields at the bottom
- Note any deviations, blockers, or corrections (e.g. wrong file paths in the plan)

Then return to step 1 for the next milestone.

## Specs

Design docs live in `.spec/`. Use `/spec` before writing code or making decisions. Use `/spec update` when implementation changes a spec.

## Stack

Bun, Electron + React 18, tiptap v3, Jotai, Tailwind v4 + tiptap SCSS, TypeScript strict.

tiptap components use SCSS; app components use Tailwind. Both read `--shards-*` CSS tokens. Editor code in `components/editor/` and `components/tiptap/`. File I/O in `services/files.ts`.

## Dev Commands

```bash
bun install          # Install deps
bun run electron:dev # Hot reload dev
bun run typecheck:all
bun run lint
```

## Constraints

- One file open at a time
- Only `.md` files in the file tree
- macOS-first
- Plain files on disk, no database
- Don't re-implement anything Craft Agents provides
- Always use `bun`/`bunx` — never `npm`/`npx`/`yarn`
