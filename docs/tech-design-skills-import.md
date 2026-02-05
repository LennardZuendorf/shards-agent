# Technical Design Specifications: Skills Import & Auto-Detection

**Version**: 1.0  
**Date**: 2026-02-05  
**Status**: Draft

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Structures](#data-structures)
3. [API Design](#api-design)
4. [File System Operations](#file-system-operations)
5. [UI Component Specifications](#ui-component-specifications)
6. [State Management](#state-management)
7. [Error Handling](#error-handling)
8. [Performance Considerations](#performance-considerations)
9. [Security](#security)
10. [Testing Strategy](#testing-strategy)

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────┐
│                    Electron Main Process                 │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐        ┌──────────────────┐      │
│  │ Skills Discovery │        │  Skills Import   │      │
│  │    Service       │───────>│     Service      │      │
│  └──────────────────┘        └──────────────────┘      │
│           │                            │                 │
│           │                            │                 │
│  ┌────────▼────────────────────────────▼──────────┐    │
│  │         IPC Handlers (ipc.ts)                   │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────────┘
                     │ IPC Bridge
┌────────────────────▼────────────────────────────────────┐
│              Electron Renderer Process                   │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────────┐        ┌──────────────────┐      │
│  │ Skills Context   │───────>│  Import Dialog   │      │
│  │   Provider       │        │   Component      │      │
│  └──────────────────┘        └──────────────────┘      │
│           │                            │                 │
│  ┌────────▼────────────────────────────▼──────────┐    │
│  │      Skills List Panel (Enhanced)              │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  Shared Package Layer                    │
├─────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │  discovery.ts│  │   import.ts  │  │ validation.ts│ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │  storage.ts  │  │    cache.ts  │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### Discovery Flow

```
User Opens App / Changes Working Dir
           │
           ▼
┌──────────────────────┐
│ Trigger Discovery    │
└──────────┬───────────┘
           │
           ├──────────────────┐
           │                  │
           ▼                  ▼
  ┌─────────────────┐  ┌──────────────────┐
  │ Scan Global     │  │ Scan Project     │
  │ ~/.agents/skills│  │ {cwd}/.claude/   │
  │ ~/.claude/skills│  │      skills/     │
  └────────┬────────┘  └────────┬─────────┘
           │                    │
           └─────────┬──────────┘
                     ▼
           ┌─────────────────┐
           │ Parse SKILL.md  │
           │ Extract Metadata│
           └────────┬────────┘
                    ▼
           ┌─────────────────┐
           │ Build Discovery │
           │    Registry     │
           └────────┬────────┘
                    ▼
           ┌─────────────────┐
           │ Update UI State │
           └─────────────────┘
```

### Import Flow

```
User Selects Skills to Import
           │
           ▼
┌──────────────────────┐
│ Validate Selection   │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Check Conflicts      │
└──────────┬───────────┘
           │
           ├─── Conflicts? ──> Show Warning Dialog
           │                           │
           ▼                           ▼
┌──────────────────────┐      User Chooses Action
│ Copy Skill Directory │      (Skip/Rename/Overwrite)
└──────────┬───────────┘              │
           │                           │
           │<──────────────────────────┘
           ▼
┌──────────────────────┐
│ Validate SKILL.md    │
└──────────┬───────────┘
           │
           ├─── Invalid? ──> Show Error, Skip
           │
           ▼
┌──────────────────────┐
│ Copy Files           │
│ Preserve Permissions │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Add to Workspace     │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Refresh Skills List  │
└──────────────────────┘
```

## Data Structures

### Core Types

```typescript
// packages/shared/src/skills/types.ts

/**
 * Skill source location
 */
export type SkillSource = 'workspace' | 'global' | 'project';

/**
 * Extended skill metadata with version support
 */
export interface SkillMetadata {
  name: string;
  description: string;
  globs?: string[];
  alwaysAllow?: string[];
  icon?: string;
  version?: string; // NEW: Semantic version (e.g., "1.0.0")
}

/**
 * Loaded skill with optional discovery metadata
 */
export interface LoadedSkill {
  slug: string;
  metadata: SkillMetadata;
  content: string;
  iconPath?: string;
  path: string;
  // NEW: Discovery metadata
  source?: SkillSource;
  sourcePath?: string;
  isImported?: boolean;
}

/**
 * Discovered skill (extends LoadedSkill with required discovery fields)
 */
export interface DiscoveredSkill extends LoadedSkill {
  source: SkillSource;
  sourcePath: string;
  isImported?: boolean;
}

/**
 * Skill conflict information
 */
export interface SkillConflict {
  slug: string;
  existingSource: SkillSource;
  existingPath: string;
  newSource: SkillSource;
  newPath: string;
}

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  line?: number;
  severity: 'error' | 'warning';
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Import options
 */
export interface ImportOptions {
  overwrite?: boolean;
  rename?: string;
  preservePermissions?: boolean;
}

/**
 * Import result
 */
export interface ImportResult {
  success: boolean;
  slug: string;
  originalSlug?: string;
  errors?: string[];
  warnings?: string[];
  path?: string;
}

/**
 * Discovery result
 */
export interface DiscoveryResult {
  globalSkills: DiscoveredSkill[];
  projectSkills: DiscoveredSkill[];
  errors: Array<{
    path: string;
    error: string;
  }>;
}
```

### Discovery Registry

```typescript
// packages/shared/src/skills/discovery.ts

/**
 * In-memory registry of discovered skills
 */
class SkillDiscoveryRegistry {
  private globalSkills: Map<string, DiscoveredSkill> = new Map();
  private projectSkills: Map<string, DiscoveredSkill> = new Map();
  private lastGlobalScan: number = 0;
  private lastProjectScan: Map<string, number> = new Map();

  /**
   * Add discovered skill to registry
   */
  addSkill(skill: DiscoveredSkill): void {
    const key = `${skill.source}:${skill.slug}`;
    
    if (skill.source === 'global') {
      this.globalSkills.set(key, skill);
    } else if (skill.source === 'project') {
      this.projectSkills.set(key, skill);
    }
  }

  /**
   * Get all discovered skills
   */
  getAllSkills(): DiscoveredSkill[] {
    return [
      ...Array.from(this.globalSkills.values()),
      ...Array.from(this.projectSkills.values()),
    ];
  }

  /**
   * Check if skill exists
   */
  hasSkill(slug: string, source: SkillSource): boolean {
    const key = `${source}:${slug}`;
    return this.globalSkills.has(key) || this.projectSkills.has(key);
  }

  /**
   * Clear registry for a specific source
   */
  clearSource(source: SkillSource): void {
    if (source === 'global') {
      this.globalSkills.clear();
    } else if (source === 'project') {
      this.projectSkills.clear();
    }
  }

  /**
   * Get skills needing refresh
   */
  needsRefresh(source: SkillSource, path?: string): boolean {
    const now = Date.now();
    const REFRESH_INTERVAL = 60000; // 1 minute

    if (source === 'global') {
      return now - this.lastGlobalScan > REFRESH_INTERVAL;
    } else if (source === 'project' && path) {
      const lastScan = this.lastProjectScan.get(path) || 0;
      return now - lastScan > REFRESH_INTERVAL;
    }

    return true;
  }

  /**
   * Update last scan time
   */
  updateScanTime(source: SkillSource, path?: string): void {
    const now = Date.now();
    
    if (source === 'global') {
      this.lastGlobalScan = now;
    } else if (source === 'project' && path) {
      this.lastProjectScan.set(path, now);
    }
  }
}
```

## API Design

### Discovery API

```typescript
// packages/shared/src/skills/discovery.ts

/**
 * Global skill directory locations
 */
const GLOBAL_SKILL_DIRS = [
  join(homedir(), '.agents', 'skills'),
  join(homedir(), '.claude', 'skills'),
];

/**
 * Project-local skill directory names to search
 */
const PROJECT_SKILL_DIRS = [
  '.agents/skills',
  '.claude/skills',
  'skills',
];

/**
 * Discover skills from global directories
 * @returns Array of discovered skills with 'global' source
 */
export async function discoverGlobalSkills(): Promise<DiscoveredSkill[]> {
  const discovered: DiscoveredSkill[] = [];
  const errors: Array<{ path: string; error: string }> = [];

  for (const baseDir of GLOBAL_SKILL_DIRS) {
    if (!existsSync(baseDir)) continue;

    try {
      const entries = readdirSync(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(baseDir, entry.name);
        const skill = await loadSkillWithMetadata(skillPath, 'global');

        if (skill) {
          discovered.push(skill);
        }
      }
    } catch (error) {
      errors.push({
        path: baseDir,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return discovered;
}

/**
 * Discover skills from project directory
 * @param projectPath - Absolute path to project root
 * @returns Array of discovered skills with 'project' source
 */
export async function discoverProjectSkills(
  projectPath: string
): Promise<DiscoveredSkill[]> {
  const discovered: DiscoveredSkill[] = [];

  for (const relativeDir of PROJECT_SKILL_DIRS) {
    const skillsDir = join(projectPath, relativeDir);

    if (!existsSync(skillsDir)) continue;

    try {
      const entries = readdirSync(skillsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(skillsDir, entry.name);
        const skill = await loadSkillWithMetadata(skillPath, 'project');

        if (skill) {
          discovered.push(skill);
        }
      }
    } catch (error) {
      // Skip directories we can't read
      continue;
    }
  }

  return discovered;
}

/**
 * Load skill with discovery metadata
 */
async function loadSkillWithMetadata(
  skillPath: string,
  source: SkillSource
): Promise<DiscoveredSkill | null> {
  const skillFile = join(skillPath, 'SKILL.md');

  if (!existsSync(skillFile)) {
    return null;
  }

  try {
    const content = readFileSync(skillFile, 'utf-8');
    const parsed = matter(content);

    if (!parsed.data.name || !parsed.data.description) {
      return null;
    }

    const slug = basename(skillPath);
    const icon = validateIconValue(parsed.data.icon, 'Skills');

    return {
      slug,
      metadata: {
        name: parsed.data.name as string,
        description: parsed.data.description as string,
        globs: parsed.data.globs as string[] | undefined,
        alwaysAllow: parsed.data.alwaysAllow as string[] | undefined,
        icon,
        version: parsed.data.version as string | undefined,
      },
      content: parsed.content,
      iconPath: findIconFile(skillPath),
      path: skillPath,
      source,
      sourcePath: skillPath,
      isImported: false,
    };
  } catch {
    return null;
  }
}

/**
 * Watch global skill directories for changes
 * @param callback - Called when skills change
 * @returns Cleanup function to stop watching
 */
export function watchGlobalSkills(
  callback: (skills: DiscoveredSkill[]) => void
): () => void {
  const watchers: FSWatcher[] = [];
  let debounceTimer: NodeJS.Timeout | null = null;

  const triggerUpdate = () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      const skills = await discoverGlobalSkills();
      callback(skills);
    }, 500);
  };

  for (const dir of GLOBAL_SKILL_DIRS) {
    if (!existsSync(dir)) continue;

    try {
      const watcher = watch(dir, { recursive: true }, triggerUpdate);
      watchers.push(watcher);
    } catch {
      // Ignore watch errors
    }
  }

  return () => {
    watchers.forEach((w) => w.close());
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
  };
}
```

### Import API

```typescript
// packages/shared/src/skills/import.ts

/**
 * Import a skill into workspace
 */
export async function importSkill(
  sourceSkill: DiscoveredSkill,
  workspaceRoot: string,
  options: ImportOptions = {}
): Promise<ImportResult> {
  const { overwrite = false, rename, preservePermissions = true } = options;

  // Determine target slug
  let targetSlug = rename || sourceSkill.slug;
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  const targetPath = join(skillsDir, targetSlug);

  // Check for conflicts
  if (!overwrite && existsSync(targetPath)) {
    // Generate unique slug
    targetSlug = generateUniqueSlug(targetSlug, workspaceRoot);
  }

  const finalTargetPath = join(skillsDir, targetSlug);

  // Validate before import
  const validation = validateSkillImport(sourceSkill);
  if (!validation.valid) {
    return {
      success: false,
      slug: targetSlug,
      originalSlug: sourceSkill.slug,
      errors: validation.errors.map((e) => e.message),
      warnings: validation.warnings.map((w) => w.message),
    };
  }

  // Ensure skills directory exists
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  try {
    // Copy skill directory
    await copySkillDirectory(
      sourceSkill.sourcePath,
      finalTargetPath,
      preservePermissions
    );

    return {
      success: true,
      slug: targetSlug,
      originalSlug: sourceSkill.slug !== targetSlug ? sourceSkill.slug : undefined,
      path: finalTargetPath,
      warnings: validation.warnings.map((w) => w.message),
    };
  } catch (error) {
    return {
      success: false,
      slug: targetSlug,
      originalSlug: sourceSkill.slug,
      errors: [error instanceof Error ? error.message : 'Import failed'],
    };
  }
}

/**
 * Copy skill directory with all contents
 */
async function copySkillDirectory(
  sourcePath: string,
  targetPath: string,
  preservePermissions: boolean
): Promise<void> {
  // Create target directory
  if (!existsSync(targetPath)) {
    mkdirSync(targetPath, { recursive: true });
  }

  // Read source directory
  const entries = readdirSync(sourcePath, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(sourcePath, entry.name);
    const destPath = join(targetPath, entry.name);

    if (entry.isDirectory()) {
      // Recursively copy subdirectories
      await copySkillDirectory(srcPath, destPath, preservePermissions);
    } else {
      // Copy file
      copyFileSync(srcPath, destPath);

      // Preserve permissions if requested
      if (preservePermissions) {
        try {
          const stats = statSync(srcPath);
          chmodSync(destPath, stats.mode);
        } catch {
          // Ignore permission errors
        }
      }
    }
  }
}

/**
 * Generate unique slug by appending number
 */
export function generateUniqueSlug(
  baseSlug: string,
  workspaceRoot: string
): string {
  let counter = 2;
  let newSlug = `${baseSlug}-${counter}`;
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);

  while (existsSync(join(skillsDir, newSlug))) {
    counter++;
    newSlug = `${baseSlug}-${counter}`;
  }

  return newSlug;
}

/**
 * Get conflicts for a skill slug
 */
export function getImportConflicts(
  slug: string,
  workspaceRoot: string
): SkillConflict[] {
  const conflicts: SkillConflict[] = [];
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  const workspacePath = join(skillsDir, slug);

  if (existsSync(workspacePath)) {
    conflicts.push({
      slug,
      existingSource: 'workspace',
      existingPath: workspacePath,
      newSource: 'global', // or 'project'
      newPath: '', // Will be filled by caller
    });
  }

  return conflicts;
}

/**
 * Batch import multiple skills
 */
export async function importSkills(
  skills: DiscoveredSkill[],
  workspaceRoot: string,
  options: ImportOptions = {}
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const skill of skills) {
    const result = await importSkill(skill, workspaceRoot, options);
    results.push(result);
  }

  return results;
}
```

### Validation API

```typescript
// packages/shared/src/skills/validation.ts

/**
 * Validate skill for import
 */
export function validateSkillImport(skill: DiscoveredSkill): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validate slug format
  if (!/^[a-z0-9-]+$/.test(skill.slug)) {
    errors.push({
      field: 'slug',
      message: 'Slug must contain only lowercase letters, numbers, and hyphens',
      severity: 'error',
    });
  }

  // Validate required metadata fields
  if (!skill.metadata.name) {
    errors.push({
      field: 'metadata.name',
      message: 'Skill name is required',
      severity: 'error',
    });
  }

  if (!skill.metadata.description) {
    errors.push({
      field: 'metadata.description',
      message: 'Skill description is required',
      severity: 'error',
    });
  }

  // Validate version format if present
  if (skill.metadata.version && !/^\d+\.\d+\.\d+$/.test(skill.metadata.version)) {
    warnings.push({
      field: 'metadata.version',
      message: 'Version should follow semantic versioning (e.g., 1.0.0)',
      severity: 'warning',
    });
  }

  // Check for SKILL.md
  const skillFile = join(skill.path, 'SKILL.md');
  if (!existsSync(skillFile)) {
    errors.push({
      field: 'SKILL.md',
      message: 'SKILL.md file is required',
      severity: 'error',
    });
  }

  // Warn about executable scripts
  const scriptsDir = join(skill.path, 'scripts');
  if (existsSync(scriptsDir)) {
    try {
      const scripts = readdirSync(scriptsDir);
      if (scripts.length > 0) {
        warnings.push({
          field: 'scripts',
          message: `Skill contains ${scripts.length} executable script(s). Review before using.`,
          severity: 'warning',
        });
      }
    } catch {
      // Ignore
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
```

## File System Operations

### Directory Structure

```
~/.agents/skills/              # Global skills (Craft Agents)
~/.claude/skills/              # Global skills (Claude Code compat)

{project}/.agents/skills/      # Project skills (Craft Agents)
{project}/.claude/skills/      # Project skills (Claude Code compat)
{project}/skills/              # Project skills (generic)

{workspace}/skills/            # Workspace skills (current implementation)
```

### Path Resolution

```typescript
// packages/shared/src/skills/paths.ts

import { homedir } from 'os';
import { join } from 'path';

/**
 * Get global skill directory paths
 */
export function getGlobalSkillDirs(): string[] {
  return [
    join(homedir(), '.agents', 'skills'),
    join(homedir(), '.claude', 'skills'),
  ];
}

/**
 * Get project skill directory names (relative)
 */
export function getProjectSkillDirNames(): string[] {
  return ['.agents/skills', '.claude/skills', 'skills'];
}

/**
 * Resolve project skill directories for a given path
 */
export function resolveProjectSkillDirs(projectPath: string): string[] {
  return getProjectSkillDirNames().map((dir) => join(projectPath, dir));
}

/**
 * Check if path is a valid skill directory
 */
export function isValidSkillDirectory(path: string): boolean {
  const skillFile = join(path, 'SKILL.md');
  return existsSync(path) && existsSync(skillFile);
}
```

## UI Component Specifications

### Import Skills Dialog

```typescript
// apps/electron/src/renderer/components/skills/ImportSkillsDialog.tsx

interface ImportSkillsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceRoot: string;
  onImportComplete: () => void;
}

interface SkillSelection {
  skill: DiscoveredSkill;
  selected: boolean;
  conflict: boolean;
  validation?: ValidationResult;
}

export function ImportSkillsDialog(props: ImportSkillsDialogProps) {
  const [globalSkills, setGlobalSkills] = useState<DiscoveredSkill[]>([]);
  const [projectSkills, setProjectSkills] = useState<DiscoveredSkill[]>([]);
  const [selections, setSelections] = useState<Map<string, SkillSelection>>(new Map());
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [searchQuery, setSearchQuery] = useState('');

  // Load discovered skills
  useEffect(() => {
    if (props.open) {
      loadDiscoveredSkills();
    }
  }, [props.open]);

  async function loadDiscoveredSkills() {
    const [global, project] = await Promise.all([
      window.electronAPI.discoverGlobalSkills(),
      window.electronAPI.discoverProjectSkills(props.workspaceRoot),
    ]);

    setGlobalSkills(global);
    setProjectSkills(project);

    // Initialize selections
    const allSkills = [...global, ...project];
    const newSelections = new Map<string, SkillSelection>();

    for (const skill of allSkills) {
      const validation = await window.electronAPI.validateSkillImport(skill);
      const conflict = await checkConflict(skill);

      newSelections.set(skill.slug, {
        skill,
        selected: false,
        conflict,
        validation,
      });
    }

    setSelections(newSelections);
  }

  async function handleImport() {
    const selected = Array.from(selections.values())
      .filter((s) => s.selected)
      .map((s) => s.skill);

    setImporting(true);
    setProgress({ current: 0, total: selected.length });

    const results: ImportResult[] = [];

    for (let i = 0; i < selected.length; i++) {
      const skill = selected[i];
      setProgress({ current: i + 1, total: selected.length });

      const result = await window.electronAPI.importSkill(
        skill,
        props.workspaceId,
        {}
      );

      results.push(result);
    }

    setImporting(false);
    props.onImportComplete();
    props.onOpenChange(false);

    // Show results toast
    showImportResults(results);
  }

  const filteredGlobalSkills = globalSkills.filter((s) =>
    matchesSearch(s, searchQuery)
  );
  const filteredProjectSkills = projectSkills.filter((s) =>
    matchesSearch(s, searchQuery)
  );

  const selectedCount = Array.from(selections.values()).filter(
    (s) => s.selected
  ).length;

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Skills</DialogTitle>
          <DialogDescription>
            Select skills to import into your workspace
          </DialogDescription>
        </DialogHeader>

        {/* Search */}
        <Input
          placeholder="Search skills..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Skills List */}
        <ScrollArea className="h-[400px]">
          {/* Global Skills Section */}
          {filteredGlobalSkills.length > 0 && (
            <SkillSection
              title="Global Skills"
              subtitle={`~/.claude/skills/, ~/.agents/skills/`}
              skills={filteredGlobalSkills}
              selections={selections}
              onToggle={toggleSelection}
            />
          )}

          {/* Project Skills Section */}
          {filteredProjectSkills.length > 0 && (
            <SkillSection
              title="Project Skills"
              subtitle={props.workspaceRoot}
              skills={filteredProjectSkills}
              selections={selections}
              onToggle={toggleSelection}
            />
          )}

          {/* Empty State */}
          {filteredGlobalSkills.length === 0 &&
            filteredProjectSkills.length === 0 && (
              <EmptyState message="No skills found" />
            )}
        </ScrollArea>

        {/* Import Progress */}
        {importing && (
          <ImportProgress
            current={progress.current}
            total={progress.total}
          />
        )}

        {/* Actions */}
        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={selectedCount === 0 || importing}
          >
            Import Selected ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### Skills Context Provider

```typescript
// apps/electron/src/renderer/context/SkillsContext.tsx

interface SkillsContextValue {
  workspaceSkills: LoadedSkill[];
  globalSkills: DiscoveredSkill[];
  projectSkills: DiscoveredSkill[];
  allSkills: DiscoveredSkill[];
  loading: boolean;
  importSkill: (skill: DiscoveredSkill) => Promise<ImportResult>;
  importSkills: (skills: DiscoveredSkill[]) => Promise<ImportResult[]>;
  refreshDiscovery: () => Promise<void>;
}

export function SkillsProvider({ children, workspaceId, workspaceRoot }: Props) {
  const [workspaceSkills, setWorkspaceSkills] = useState<LoadedSkill[]>([]);
  const [globalSkills, setGlobalSkills] = useState<DiscoveredSkill[]>([]);
  const [projectSkills, setProjectSkills] = useState<DiscoveredSkill[]>([]);
  const [loading, setLoading] = useState(true);

  // Load workspace skills
  useEffect(() => {
    loadWorkspaceSkills();
  }, [workspaceId]);

  // Discover global skills
  useEffect(() => {
    discoverGlobal();
  }, []);

  // Discover project skills when workspace root changes
  useEffect(() => {
    if (workspaceRoot) {
      discoverProject();
    }
  }, [workspaceRoot]);

  // Watch for global skill changes
  useEffect(() => {
    const cleanup = window.electronAPI.watchGlobalSkills(() => {
      discoverGlobal();
    });

    return cleanup;
  }, []);

  async function loadWorkspaceSkills() {
    const skills = await window.electronAPI.loadSkills(workspaceId);
    setWorkspaceSkills(skills);
  }

  async function discoverGlobal() {
    const skills = await window.electronAPI.discoverGlobalSkills();
    setGlobalSkills(skills);
  }

  async function discoverProject() {
    const skills = await window.electronAPI.discoverProjectSkills(workspaceRoot);
    setProjectSkills(skills);
  }

  const allSkills = useMemo(() => {
    // Deduplicate: workspace > project > global
    const map = new Map<string, DiscoveredSkill>();

    for (const skill of globalSkills) {
      map.set(skill.slug, skill);
    }

    for (const skill of projectSkills) {
      map.set(skill.slug, skill);
    }

    for (const skill of workspaceSkills) {
      map.set(skill.slug, { ...skill, source: 'workspace' as const });
    }

    return Array.from(map.values());
  }, [workspaceSkills, globalSkills, projectSkills]);

  const value: SkillsContextValue = {
    workspaceSkills,
    globalSkills,
    projectSkills,
    allSkills,
    loading,
    importSkill: async (skill) => {
      const result = await window.electronAPI.importSkill(skill, workspaceId, {});
      if (result.success) {
        await loadWorkspaceSkills();
      }
      return result;
    },
    importSkills: async (skills) => {
      const results = await Promise.all(
        skills.map((s) => window.electronAPI.importSkill(s, workspaceId, {}))
      );
      await loadWorkspaceSkills();
      return results;
    },
    refreshDiscovery: async () => {
      await Promise.all([discoverGlobal(), discoverProject()]);
    },
  };

  return (
    <SkillsContext.Provider value={value}>
      {children}
    </SkillsContext.Provider>
  );
}
```

## State Management

### Discovery State

```typescript
// Managed in SkillsContext
interface DiscoveryState {
  globalSkills: DiscoveredSkill[];
  projectSkills: DiscoveredSkill[];
  lastGlobalScan: number;
  lastProjectScan: number;
  scanning: boolean;
}
```

### Import State

```typescript
// Managed in ImportSkillsDialog
interface ImportState {
  selections: Map<string, SkillSelection>;
  importing: boolean;
  progress: { current: number; total: number };
  results: ImportResult[];
}
```

## Error Handling

### Error Types

```typescript
export class SkillImportError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'SkillImportError';
  }
}

export const SkillErrorCodes = {
  INVALID_PATH: 'INVALID_PATH',
  INVALID_SKILL: 'INVALID_SKILL',
  CONFLICT: 'CONFLICT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  DISK_FULL: 'DISK_FULL',
  COPY_FAILED: 'COPY_FAILED',
} as const;
```

### Error Recovery

```typescript
async function importSkillWithRecovery(
  skill: DiscoveredSkill,
  workspace: string
): Promise<ImportResult> {
  const tempPath = join(workspace, `skills/.temp-${skill.slug}`);

  try {
    // Copy to temp location first
    await copySkillDirectory(skill.sourcePath, tempPath, true);

    // Validate
    const validation = validateSkillImport({ ...skill, path: tempPath });
    if (!validation.valid) {
      throw new SkillImportError(
        'Validation failed',
        SkillErrorCodes.INVALID_SKILL,
        validation.errors
      );
    }

    // Move to final location
    const finalPath = join(workspace, `skills/${skill.slug}`);
    renameSync(tempPath, finalPath);

    return { success: true, slug: skill.slug, path: finalPath };
  } catch (error) {
    // Rollback: remove temp directory
    if (existsSync(tempPath)) {
      rmSync(tempPath, { recursive: true, force: true });
    }

    return {
      success: false,
      slug: skill.slug,
      errors: [error instanceof Error ? error.message : 'Import failed'],
    };
  }
}
```

## Performance Considerations

### Caching Strategy

```typescript
// LRU cache for discovered skills
const skillCache = new LRUCache<string, DiscoveredSkill[]>({
  max: 100,
  ttl: 60000, // 1 minute
});

export async function discoverGlobalSkillsCached(): Promise<DiscoveredSkill[]> {
  const cacheKey = 'global-skills';
  const cached = skillCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const skills = await discoverGlobalSkills();
  skillCache.set(cacheKey, skills);

  return skills;
}
```

### Batching

```typescript
// Batch filesystem operations
async function importSkillsBatch(
  skills: DiscoveredSkill[],
  workspace: string
): Promise<ImportResult[]> {
  const BATCH_SIZE = 5;
  const results: ImportResult[] = [];

  for (let i = 0; i < skills.length; i += BATCH_SIZE) {
    const batch = skills.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((skill) => importSkill(skill, workspace, {}))
    );
    results.push(...batchResults);
  }

  return results;
}
```

## Security

### Path Validation

```typescript
/**
 * Validate skill path to prevent directory traversal
 */
function validateSkillPath(skillPath: string): boolean {
  const normalized = resolve(skillPath);
  const allowedDirs = [
    ...getGlobalSkillDirs(),
    // Add workspace dirs dynamically
  ];

  return allowedDirs.some((dir) => normalized.startsWith(resolve(dir)));
}
```

### Script Execution

```typescript
/**
 * Warn about executable scripts
 */
function checkExecutableScripts(skillPath: string): string[] {
  const scriptsDir = join(skillPath, 'scripts');
  const executables: string[] = [];

  if (!existsSync(scriptsDir)) return executables;

  const files = readdirSync(scriptsDir);

  for (const file of files) {
    const filePath = join(scriptsDir, file);
    try {
      const stats = statSync(filePath);
      // Check if executable (Unix systems)
      if (stats.mode & 0o111) {
        executables.push(file);
      }
    } catch {
      // Ignore
    }
  }

  return executables;
}
```

## Testing Strategy

### Unit Tests

```typescript
// packages/shared/src/skills/__tests__/discovery.test.ts

describe('discoverGlobalSkills', () => {
  it('should discover skills from ~/.agents/skills', async () => {
    // Mock filesystem
    const skills = await discoverGlobalSkills();
    expect(skills).toHaveLength(2);
  });

  it('should handle missing directories gracefully', async () => {
    // Mock non-existent directory
    const skills = await discoverGlobalSkills();
    expect(skills).toEqual([]);
  });

  it('should parse skill metadata correctly', async () => {
    const skills = await discoverGlobalSkills();
    expect(skills[0].metadata.name).toBe('PDF Processor');
  });
});
```

### Integration Tests

```typescript
// apps/electron/src/__tests__/skills-import.test.ts

describe('Skills Import Integration', () => {
  it('should import skill from global to workspace', async () => {
    const skill = await window.electronAPI.discoverGlobalSkills();
    const result = await window.electronAPI.importSkill(
      skill[0],
      'workspace-id',
      {}
    );

    expect(result.success).toBe(true);
    expect(result.slug).toBe('pdf-processor');
  });

  it('should handle conflicts correctly', async () => {
    // Import once
    await window.electronAPI.importSkill(skill, 'workspace-id', {});

    // Import again
    const result = await window.electronAPI.importSkill(
      skill,
      'workspace-id',
      {}
    );

    expect(result.slug).toBe('pdf-processor-2');
  });
});
```

## Implementation Checklist

- [ ] Create `packages/shared/src/skills/discovery.ts`
- [ ] Create `packages/shared/src/skills/import.ts`
- [ ] Create `packages/shared/src/skills/validation.ts`
- [ ] Create `packages/shared/src/skills/cache.ts`
- [ ] Update `packages/shared/src/skills/types.ts`
- [ ] Add IPC handlers in `apps/electron/src/main/ipc.ts`
- [ ] Update preload API in `apps/electron/src/preload/index.ts`
- [ ] Create `apps/electron/src/renderer/components/skills/ImportSkillsDialog.tsx`
- [ ] Create `apps/electron/src/renderer/context/SkillsContext.tsx`
- [ ] Update `apps/electron/src/renderer/components/app-shell/SkillsListPanel.tsx`
- [ ] Add file watching in `apps/electron/src/main/lib/config-watcher.ts`
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation
