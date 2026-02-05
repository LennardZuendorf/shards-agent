# Simple Skills Import Implementation Plan

**Goal**: Add "Import" tab to "Add Skill" prompt window to import skills from `~/.claude/skills` and `~/.agents/skills`

**Approach**: Symlink by default with disclaimer

## Architecture

```
Add Skill Button
      │
      ▼
EditPopover Component (Modified)
      │
      ├──> Tab: "New" (existing)
      │         └──> Opens chat session (current behavior)
      │
      └──> Tab: "Import" (NEW)
                └──> Shows list of global skills
                     └──> Select & Import (symlink)
```

## Implementation Steps

### Step 1: Scan Global Skills
**File**: `packages/shared/src/skills/discovery.ts` (NEW)

```typescript
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import matter from 'gray-matter';
import type { LoadedSkill } from './types';

const GLOBAL_DIRS = [
  join(homedir(), '.claude', 'skills'),
  join(homedir(), '.agents', 'skills'),
];

export function scanGlobalSkills(): LoadedSkill[] {
  const skills: LoadedSkill[] = [];

  for (const dir of GLOBAL_DIRS) {
    if (!existsSync(dir)) continue;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(dir, entry.name);
        const skillFile = join(skillPath, 'SKILL.md');
        
        if (!existsSync(skillFile)) continue;

        // Parse SKILL.md
        const content = readFileSync(skillFile, 'utf-8');
        const parsed = matter(content);

        if (parsed.data.name && parsed.data.description) {
          skills.push({
            slug: entry.name,
            metadata: {
              name: parsed.data.name,
              description: parsed.data.description,
              globs: parsed.data.globs,
              alwaysAllow: parsed.data.alwaysAllow,
              icon: parsed.data.icon,
            },
            content: parsed.content,
            path: skillPath,
          });
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  return skills;
}
```

### Step 2: Import Function (Symlink)
**File**: `packages/shared/src/skills/import.ts` (NEW)

```typescript
import { symlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { getWorkspaceSkillsPath } from '../workspaces/storage';

export interface ImportResult {
  success: boolean;
  slug: string;
  error?: string;
}

export function importSkill(
  sourcePath: string,
  slug: string,
  workspaceRoot: string
): ImportResult {
  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  const targetPath = join(skillsDir, slug);

  // Check if already exists
  if (existsSync(targetPath)) {
    return {
      success: false,
      slug,
      error: 'Skill already exists',
    };
  }

  try {
    // Create symlink
    symlinkSync(sourcePath, targetPath, 'dir');

    return {
      success: true,
      slug,
    };
  } catch (error) {
    return {
      success: false,
      slug,
      error: error instanceof Error ? error.message : 'Import failed',
    };
  }
}
```

### Step 3: Add IPC Handlers
**File**: `apps/electron/src/main/ipc.ts`

Add these handlers:

```typescript
// Scan global skills
ipcMain.handle('skills:scanGlobal', async () => {
  const { scanGlobalSkills } = await import('@craft-agent/shared/skills/discovery');
  return scanGlobalSkills();
});

// Import skill (symlink)
ipcMain.handle('skills:import', async (event, sourcePath: string, slug: string, workspaceId: string) => {
  const { importSkill } = await import('@craft-agent/shared/skills/import');
  const workspaceRoot = getWorkspacePath(workspaceId);
  return importSkill(sourcePath, slug, workspaceRoot);
});
```

### Step 4: Update Preload API
**File**: `apps/electron/src/preload/index.ts`

```typescript
electronAPI: {
  // ... existing
  scanGlobalSkills: () => ipcRenderer.invoke('skills:scanGlobal'),
  importSkill: (sourcePath: string, slug: string, workspaceId: string) => 
    ipcRenderer.invoke('skills:import', sourcePath, slug, workspaceId),
}
```

### Step 5: Modify EditPopover Component
**File**: `apps/electron/src/renderer/components/ui/EditPopover.tsx`

Add state and tab switching:

```typescript
// Inside EditPopover component, add:
const [activeTab, setActiveTab] = useState<'new' | 'import'>('new');
const [globalSkills, setGlobalSkills] = useState<LoadedSkill[]>([]);
const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set());
const [importing, setImporting] = useState(false);

// When popover opens and context is 'add-skill'
useEffect(() => {
  if (open && context.label === 'Add Skill') {
    // Load global skills
    window.electronAPI.scanGlobalSkills().then(setGlobalSkills);
  }
}, [open, context.label]);

// Import handler
async function handleImport() {
  setImporting(true);
  const workspaceId = useActiveWorkspace(); // Get from context
  
  for (const slug of selectedSkills) {
    const skill = globalSkills.find(s => s.slug === slug);
    if (skill) {
      await window.electronAPI.importSkill(skill.path, slug, workspaceId);
    }
  }
  
  setImporting(false);
  onOpenChange(false);
  // Refresh skills list
}
```

### Step 6: Add Import Tab UI
**In EditPopover component, modify the content area:**

```tsx
{context.label === 'Add Skill' && (
  <div className="flex flex-col gap-3">
    {/* Tabs */}
    <div className="flex gap-2 border-b">
      <button
        onClick={() => setActiveTab('new')}
        className={cn(
          "px-3 py-2 text-sm font-medium",
          activeTab === 'new' ? "border-b-2 border-foreground" : "text-muted-foreground"
        )}
      >
        New
      </button>
      <button
        onClick={() => setActiveTab('import')}
        className={cn(
          "px-3 py-2 text-sm font-medium",
          activeTab === 'import' ? "border-b-2 border-foreground" : "text-muted-foreground"
        )}
      >
        Import
      </button>
    </div>

    {/* Tab Content */}
    {activeTab === 'new' ? (
      // Existing chat input UI
      <ExistingChatInput />
    ) : (
      // Import UI
      <div className="flex flex-col gap-3">
        {/* Disclaimer */}
        <div className="text-xs text-muted-foreground bg-foreground/5 p-2 rounded">
          Skills will be symlinked from global folders. Changes to originals will reflect here.
        </div>

        {/* Skills List */}
        <ScrollArea className="h-[300px]">
          {globalSkills.map(skill => (
            <label key={skill.slug} className="flex items-start gap-3 p-2 hover:bg-foreground/5 rounded cursor-pointer">
              <input
                type="checkbox"
                checked={selectedSkills.has(skill.slug)}
                onChange={(e) => {
                  const newSet = new Set(selectedSkills);
                  if (e.target.checked) {
                    newSet.add(skill.slug);
                  } else {
                    newSet.delete(skill.slug);
                  }
                  setSelectedSkills(newSet);
                }}
                className="mt-1"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{skill.metadata.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {skill.metadata.description}
                </div>
              </div>
            </label>
          ))}

          {globalSkills.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              No skills found in ~/.claude/skills or ~/.agents/skills
            </div>
          )}
        </ScrollArea>

        {/* Import Button */}
        <Button
          onClick={handleImport}
          disabled={selectedSkills.size === 0 || importing}
          className="w-full"
        >
          {importing ? 'Importing...' : `Import ${selectedSkills.size} skill(s)`}
        </Button>
      </div>
    )}
  </div>
)}
```

## Files to Modify/Create

### New Files
1. `packages/shared/src/skills/discovery.ts` - Scan global skills
2. `packages/shared/src/skills/import.ts` - Import (symlink) function

### Modified Files
1. `packages/shared/src/skills/index.ts` - Export new functions
2. `apps/electron/src/main/ipc.ts` - Add IPC handlers
3. `apps/electron/src/preload/index.ts` - Add API methods
4. `apps/electron/src/renderer/components/ui/EditPopover.tsx` - Add tabs + import UI

## Implementation Order

1. [ ] Create `discovery.ts` - scan function
2. [ ] Create `import.ts` - symlink function
3. [ ] Export from `skills/index.ts`
4. [ ] Add IPC handlers
5. [ ] Update preload API
6. [ ] Modify EditPopover - add tabs
7. [ ] Add import UI to EditPopover
8. [ ] Test with sample skills
9. [ ] Handle edge cases (no skills, already exists)
10. [ ] Update skills list after import

## Testing

```bash
# Create test skills
mkdir -p ~/.claude/skills/test-skill
cat > ~/.claude/skills/test-skill/SKILL.md << 'EOF'
---
name: Test Skill
description: A test skill for import
---

Test instructions here
EOF

# Run app, click Add Skill, go to Import tab
# Should see "Test Skill" listed
# Select and import - should create symlink
```

## Edge Cases

1. **Skill already exists**: Show error, don't overwrite
2. **No global skills**: Show empty state message
3. **Invalid SKILL.md**: Skip that skill silently
4. **Symlink permission error**: Show error message
5. **Duplicate skill names**: Import all (different slugs)

## Future Enhancements (Later)

- Add search/filter for skills list
- Show skill source path in tooltip
- Option to copy instead of symlink
- Batch import all button
- Show preview of skill content

---

**KISS Principles Applied**:
- ✅ No auto-scanning on startup
- ✅ No file watching
- ✅ No caching/registry
- ✅ Scan only when Import tab opened
- ✅ Symlink by default (fast, simple)
- ✅ Reuse existing EditPopover UI
- ✅ Minimal state management
