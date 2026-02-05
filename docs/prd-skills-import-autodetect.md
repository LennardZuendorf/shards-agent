# PRD: Skills Import and Auto-Detection

**Status**: Draft  
**Author**: AI Agent  
**Created**: 2026-02-05  
**Target Release**: v0.4.0

## Executive Summary

Enable Craft Agents to automatically discover and import Agent Skills from standard locations (`~/.agents/skills`, `~/.claude/skills`) and project-local skill directories, providing seamless interoperability with Claude Code and other Agent Skills-compatible tools. This feature bridges the gap between global/personal skills and project-specific skills, creating a unified skills experience.

## Problem Statement

### Current Limitations
1. **Manual Skill Creation Only**: Users must create skills manually through the agent or by directly editing files in workspace directories
2. **No Global Skills**: Skills exist only per-workspace, requiring duplication across workspaces
3. **No Claude Code Interop**: Users cannot leverage their existing Claude Code skills library
4. **No Project Context Awareness**: When working with a project folder, skills defined in that project aren't automatically available
5. **No Bulk Import**: Users cannot easily migrate or share collections of skills

### User Pain Points
- "I have 20 skills in `~/.claude/skills/` from Claude Code that I want to use in Craft Agents"
- "I need to recreate the same skill in every workspace"
- "My project has `.claude/skills/` with project-specific skills, but they're not detected"
- "I want to import a skill pack from a GitHub repo"
- "When I select a folder as working directory, I expect project skills to be available"

## Goals

### Primary Goals
1. **Global Skills Discovery**: Automatically detect and make available skills from `~/.agents/skills` and `~/.claude/skills`
2. **Project Skills Auto-Detection**: When a folder is selected as working directory, detect and offer skills from `.agents/skills`, `.claude/skills`, or `skills/` within that folder
3. **Import UI**: Provide intuitive UI in Skills pane to import skills from discovered locations
4. **Claude Code Compatibility**: Full compatibility with Claude Code's skill format and structure

### Secondary Goals
1. **Skill Deduplication**: Handle conflicts when same skill exists in multiple locations
2. **Skill Versioning**: Support version metadata in skills
3. **Import Progress**: Show import progress and validation results
4. **Selective Import**: Allow users to preview and select which skills to import

## Non-Goals
1. **Automatic Skill Updates**: Skills don't auto-update from source locations (v2 feature)
2. **Cloud Skill Sync**: No cloud-based skill sharing/syncing (future consideration)
3. **Skill Marketplace Integration**: No integration with SkillsMP or other marketplaces (v2)
4. **Plugin System**: Skills remain separate from plugin architecture (different concern)

## User Stories

### US-1: Discover Global Skills
**As a** Craft Agents user who also uses Claude Code  
**I want** my global skills automatically discovered  
**So that** I don't have to recreate skills I already have

**Acceptance Criteria**:
- System scans `~/.agents/skills/` and `~/.claude/skills/` on startup
- Global skills appear in Skills pane with clear "Global" badge
- Skills can be viewed but not edited in-place (read-only reference)
- Skills can be copied/imported into current workspace

### US-2: Import Skills from Global Location
**As a** user with skills in `~/.claude/skills/`  
**I want** to import specific skills into my workspace  
**So that** I can use and customize them for my current project

**Acceptance Criteria**:
- Skills pane shows "Import Skills" button/menu
- Dialog lists all discovered global skills with preview
- User can select multiple skills to import
- Import copies skill directory to workspace skills folder
- Imported skills become editable workspace skills

### US-3: Auto-Detect Project Skills
**As a** developer working on a project with `.claude/skills/`  
**I want** those skills automatically available when I select the project folder  
**So that** project-specific skills work without manual import

**Acceptance Criteria**:
- When user sets working directory to a folder containing `.claude/skills/`, `.agents/skills/`, or `skills/`
- System detects and lists discovered skills
- Skills appear with "Project" badge in UI
- Skills are read-only (reference from project location)
- User can optionally import them into workspace for editing

### US-4: Skill Import Validation
**As a** user importing skills  
**I want** to see validation results before/during import  
**So that** I know if skills will work correctly

**Acceptance Criteria**:
- Import preview shows skill metadata (name, description)
- Validation checks for required fields, valid YAML frontmatter
- Warnings shown for missing optional elements (icons, scripts)
- Import process handles and reports errors gracefully

### US-5: Handle Skill Conflicts
**As a** user with a skill named "pdf" in both global and workspace locations  
**I want** clear indication of conflicts  
**So that** I can decide which version to use

**Acceptance Criteria**:
- UI shows skill source location (Global/Project/Workspace)
- Workspace skills take precedence over global/project skills
- Import dialog warns when importing would overwrite existing skill
- User can choose to skip, rename, or overwrite

## Functional Requirements

### FR-1: Skills Discovery Service
- **FR-1.1**: Scan `~/.agents/skills/` on app startup
- **FR-1.2**: Scan `~/.claude/skills/` on app startup  
- **FR-1.3**: Watch global skill directories for changes (live updates)
- **FR-1.4**: Scan working directory for `.agents/skills/`, `.claude/skills/`, `skills/` when set
- **FR-1.5**: Maintain in-memory registry of discovered skills with source location

### FR-2: Skills Import Mechanism
- **FR-2.1**: Copy skill directory structure preserving all files
- **FR-2.2**: Validate SKILL.md format before import
- **FR-2.3**: Handle icon downloads if icon is URL-based
- **FR-2.4**: Generate unique slug if conflict exists (e.g., `pdf` → `pdf-2`)
- **FR-2.5**: Batch import multiple skills efficiently

### FR-3: UI Integration
- **FR-3.1**: Add "Import Skills" menu item to Skills pane
- **FR-3.2**: Display discovered skills dialog with categorized sections (Global, Project)
- **FR-3.3**: Show skill badges indicating source (Global/Project/Workspace)
- **FR-3.4**: Add skill preview in import dialog
- **FR-3.5**: Show import progress with status updates

### FR-4: Skills API Extensions
- **FR-4.1**: `discoverGlobalSkills()` - Scan global skill directories
- **FR-4.2**: `discoverProjectSkills(folderPath)` - Scan project-local skills
- **FR-4.3**: `importSkill(source, workspaceRoot, options)` - Import a skill
- **FR-4.4**: `listDiscoveredSkills()` - Get all discovered skills
- **FR-4.5**: `getSkillConflicts(skillSlug)` - Check for naming conflicts

### FR-5: Skill Metadata Enhancement
- **FR-5.1**: Add `source` field to LoadedSkill type: `'workspace' | 'global' | 'project'`
- **FR-5.2**: Add `sourcePath` field: absolute path to original skill location
- **FR-5.3**: Add `version` support in YAML frontmatter (optional)
- **FR-5.4**: Add `isImported` flag to track imported vs. native workspace skills

## Technical Requirements

### TR-1: Performance
- **TR-1.1**: Skills discovery must complete within 500ms for typical library sizes (<100 skills)
- **TR-1.2**: UI must remain responsive during import operations
- **TR-1.3**: Use debounced file watchers to avoid excessive rescanning

### TR-2: Compatibility
- **TR-2.1**: Support Agent Skills standard format (SKILL.md with YAML frontmatter)
- **TR-2.2**: Support Claude Code skill directory structure
- **TR-2.3**: Handle optional subdirectories: `scripts/`, `references/`, `assets/`
- **TR-2.4**: Preserve file permissions on executable scripts

### TR-3: Error Handling
- **TR-3.1**: Gracefully handle missing/inaccessible skill directories
- **TR-3.2**: Validate YAML frontmatter and report specific errors
- **TR-3.3**: Handle filesystem errors during import (permissions, disk space)
- **TR-3.4**: Provide rollback on partial import failure

### TR-4: Security
- **TR-4.1**: Never execute scripts during discovery/preview
- **TR-4.2**: Validate skill paths to prevent directory traversal
- **TR-4.3**: Warn users about executable scripts in imported skills
- **TR-4.4**: Sandbox script execution within agent permission system

## UI/UX Requirements

### UX-1: Skills Pane Enhancements
```
┌─────────────────────────────────┐
│ Skills                  [+] [...│
├─────────────────────────────────┤
│ [🌐] pdf (Global)              │ <- Badge indicates source
│ [📁] brand-guidelines (Project)│
│      api-testing (Workspace)   │ <- No badge for workspace
├─────────────────────────────────┤
│ [...] More Menu:                │
│   • Add Skill                   │
│   • Import Skills...         ⭐│ <- New option
│   • Show in Finder             │
└─────────────────────────────────┘
```

### UX-2: Import Dialog
```
┌─────────────────────────────────────────────────┐
│ Import Skills                             [×]   │
├─────────────────────────────────────────────────┤
│ Select skills to import into workspace:         │
│                                                  │
│ Global Skills (~/.claude/skills/)               │
│ ☑ pdf - Extract and analyze PDF documents       │
│ ☑ xlsx - Work with Excel spreadsheets           │
│ ☐ docx - Create and edit Word documents         │
│                                                  │
│ Project Skills (/path/to/project/.claude/...)   │
│ ☑ brand-guidelines - Apply brand standards      │
│ ⚠ api-testing - Already exists in workspace     │
│                                                  │
│               [Cancel] [Import Selected (3)]    │
└─────────────────────────────────────────────────┘
```

### UX-3: Skill Source Indicators
- **Global**: 🌐 globe icon + "Global" label
- **Project**: 📁 folder icon + "Project" label  
- **Workspace**: No icon (default/native)
- Tooltip shows full source path

## Success Criteria

### Launch Criteria
1. ✅ Users can import skills from `~/.claude/skills/` in <3 clicks
2. ✅ Project skills auto-detected when working directory is set
3. ✅ Skills UI clearly indicates skill source
4. ✅ Import validates and reports errors before copying
5. ✅ 95% of Claude Code skills import successfully

### Success Metrics
- **Adoption**: 50%+ of users import at least 1 skill in first week
- **Interoperability**: 90%+ of Claude Code skills work without modification
- **Performance**: Skills discovery completes in <500ms for 100 skills
- **Quality**: <5% of imported skills require manual fixes

## Open Questions

1. **Q**: Should global skills be usable directly or only after import?
   **A**: Show in UI for reference, require import for usage (avoids unexpected modifications to global skills)

2. **Q**: How to handle skills with same name in multiple locations?
   **A**: Precedence: Workspace > Project > Global. Show all in import dialog with source.

3. **Q**: Should project skills auto-import or remain references?
   **A**: Keep as references (read-only). Explicit import to workspace for customization.

4. **Q**: Support for nested `.claude/skills/` in monorepos?
   **A**: v2 feature. Start with single-level detection from working directory root.

## Future Enhancements (v2)

1. **Auto-sync**: Optional auto-sync of global skills to workspaces
2. **Skill Marketplace**: Integration with SkillsMP or similar
3. **Skill Updates**: Check for and apply updates to imported skills
4. **Nested Discovery**: Support monorepo nested skill directories
5. **Skill Dependencies**: Skills can reference other skills
6. **Export Workspace Skills**: Export workspace skills to global location
7. **Skill Collections**: Import entire repositories as skill collections

## References

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills)
- [Agent Skills Standard](https://agentskills.io)
- [Anthropic Skills Repository](https://github.com/anthropics/skills)
- [SkillsMP Marketplace](https://skillsmp.com)
- Internal: `packages/shared/src/skills/` implementation

## Appendix: Agent Skills Format Reference

### Directory Structure
```
my-skill/
├── SKILL.md              # Required: Main instructions
├── scripts/              # Optional: Executable scripts
│   └── process.py
├── references/           # Optional: Documentation
│   └── api-spec.md
└── assets/              # Optional: Templates, binaries
    └── template.html
```

### SKILL.md Format
```markdown
---
name: skill-name
description: When to use this skill
version: 1.0.0           # Optional
globs: ["*.pdf"]         # Optional: file patterns
alwaysAllow: ["read"]    # Optional: auto-allow tools
icon: "📄"               # Optional: emoji or URL
---

# Skill Instructions

Main skill content and instructions go here...
```
