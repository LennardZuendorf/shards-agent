/**
 * Tests for skills discovery and import functionality.
 *
 * Covers:
 * - scanGlobalSkills: scanning ~/.claude/skills and ~/.agents/skills
 * - importSkill: creating symlinks from global to workspace skills
 */

import { describe, test, expect, beforeAll, beforeEach, afterAll } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync, readlinkSync, lstatSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scanGlobalSkills } from '../discovery.ts';
import { importSkill } from '../import.ts';

// Test directory structure
let testDir: string;
let claudeSkillsDir: string;
let agentsSkillsDir: string;
let workspaceRoot: string;

beforeAll(() => {
  // Create temporary test directories
  testDir = join(tmpdir(), `craft-agent-skills-test-${Date.now()}`);
  claudeSkillsDir = join(testDir, '.claude', 'skills');
  agentsSkillsDir = join(testDir, '.agents', 'skills');
  workspaceRoot = join(testDir, 'workspace');

  mkdirSync(claudeSkillsDir, { recursive: true });
  mkdirSync(agentsSkillsDir, { recursive: true });
  mkdirSync(workspaceRoot, { recursive: true });
});

beforeEach(() => {
  // Clean directories before each test to prevent state leaking
  rmSync(claudeSkillsDir, { recursive: true, force: true });
  rmSync(agentsSkillsDir, { recursive: true, force: true });
  rmSync(workspaceRoot, { recursive: true, force: true });
  mkdirSync(claudeSkillsDir, { recursive: true });
  mkdirSync(agentsSkillsDir, { recursive: true });
  mkdirSync(workspaceRoot, { recursive: true });
});

afterAll(() => {
  // Clean up test directories
  if (existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true });
  }
});

// ============================================
// Helper Functions
// ============================================

function createSkill(dir: string, slug: string, name: string, description: string, includeIcon = false) {
  const skillDir = join(dir, slug);
  mkdirSync(skillDir, { recursive: true });
  
  const content = `---
name: ${name}
description: ${description}
---

# ${name}

This is the skill content for testing.
`;
  
  writeFileSync(join(skillDir, 'SKILL.md'), content, 'utf-8');
  
  if (includeIcon) {
    writeFileSync(join(skillDir, 'icon.svg'), '<svg></svg>', 'utf-8');
  }
}

// ============================================
// scanGlobalSkills Tests
// ============================================

describe('scanGlobalSkills', () => {
  test('returns empty array when no skills exist', async () => {
    const skills = scanGlobalSkills(testDir);
    expect(skills).toEqual([]);
  });

  test('scans skills from ~/.claude/skills', async () => {
    createSkill(claudeSkillsDir, 'test-skill-1', 'Test Skill 1', 'A test skill from Claude');
    
    const skills = scanGlobalSkills(testDir);
    
    expect(skills.length).toBe(1);
    const skill = skills[0];
    expect(skill).toBeDefined();
    expect(skill?.slug).toBe('test-skill-1');
    expect(skill?.metadata.name).toBe('Test Skill 1');
    expect(skill?.metadata.description).toBe('A test skill from Claude');
    expect(skill?.path).toBe(join(claudeSkillsDir, 'test-skill-1'));
  });

  test('scans skills from ~/.agents/skills', async () => {
    createSkill(agentsSkillsDir, 'test-skill-2', 'Test Skill 2', 'A test skill from Agents');
    
    const skills = scanGlobalSkills(testDir);
    
    expect(skills.length).toBe(1);
    const skill = skills[0];
    expect(skill).toBeDefined();
    expect(skill?.slug).toBe('test-skill-2');
    expect(skill?.metadata.name).toBe('Test Skill 2');
    expect(skill?.metadata.description).toBe('A test skill from Agents');
    expect(skill?.path).toBe(join(agentsSkillsDir, 'test-skill-2'));
  });

  test('scans skills from both directories', async () => {
    createSkill(claudeSkillsDir, 'claude-skill', 'Claude Skill', 'From Claude');
    createSkill(agentsSkillsDir, 'agents-skill', 'Agents Skill', 'From Agents');
    
    const skills = scanGlobalSkills(testDir);
    
    expect(skills.length).toBe(2);
    
    const claudeSkill = skills.find(s => s.slug === 'claude-skill');
    const agentsSkill = skills.find(s => s.slug === 'agents-skill');
    
    expect(claudeSkill).toBeDefined();
    expect(agentsSkill).toBeDefined();
    expect(claudeSkill?.metadata.name).toBe('Claude Skill');
    expect(agentsSkill?.metadata.name).toBe('Agents Skill');
  });

  test('handles skills with icons', async () => {
    createSkill(claudeSkillsDir, 'skill-with-icon', 'Skill With Icon', 'Has an icon', true);
    
    const skills = scanGlobalSkills(testDir);
    
    expect(skills.length).toBe(1);
    expect(skills[0]?.iconPath).toBe(join(claudeSkillsDir, 'skill-with-icon', 'icon.svg'));
  });

  test('skips directories without SKILL.md', async () => {
    // Create directory without SKILL.md
    mkdirSync(join(claudeSkillsDir, 'invalid-skill'), { recursive: true });
    writeFileSync(join(claudeSkillsDir, 'invalid-skill', 'README.md'), 'No SKILL.md', 'utf-8');
    
    const skills = scanGlobalSkills(testDir);
    
    expect(skills.length).toBe(0);
  });

  test('skips skills with invalid frontmatter', async () => {
    const skillDir = join(claudeSkillsDir, 'invalid-frontmatter');
    mkdirSync(skillDir, { recursive: true });
    
    // Missing required fields
    writeFileSync(join(skillDir, 'SKILL.md'), `---
name: Only Name
---
Content`, 'utf-8');
    
    const skills = scanGlobalSkills(testDir);
    
    expect(skills.length).toBe(0);
  });

  test('handles multiple skills with different configurations', async () => {
    createSkill(claudeSkillsDir, 'skill-1', 'Skill One', 'First skill', false);
    createSkill(claudeSkillsDir, 'skill-2', 'Skill Two', 'Second skill', true);
    createSkill(agentsSkillsDir, 'skill-3', 'Skill Three', 'Third skill', false);
    
    const skills = scanGlobalSkills(testDir);
    
    expect(skills.length).toBe(3);
    expect(skills.map(s => s.slug).sort()).toEqual(['skill-1', 'skill-2', 'skill-3']);
  });
});

// ============================================
// importSkill Tests
// ============================================

describe('importSkill', () => {
  test('successfully imports a skill via symlink', async () => {
    createSkill(claudeSkillsDir, 'import-test-1', 'Import Test 1', 'Test import');
    
    const sourcePath = join(claudeSkillsDir, 'import-test-1');
    const result = await importSkill(sourcePath, 'import-test-1', workspaceRoot);
    
    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    
    const targetPath = join(workspaceRoot, 'skills', 'import-test-1');
    expect(existsSync(targetPath)).toBe(true);
    
    // Verify it's a symlink
    const stats = lstatSync(targetPath);
    expect(stats.isSymbolicLink()).toBe(true);
    
    // Verify symlink points to correct source
    const linkTarget = readlinkSync(targetPath);
    expect(linkTarget).toBe(sourcePath);
  });

  test('creates skills directory if it does not exist', async () => {
    const tempWorkspace = join(testDir, 'workspace-no-skills');
    mkdirSync(tempWorkspace, { recursive: true });
    
    createSkill(claudeSkillsDir, 'import-test-2', 'Import Test 2', 'Test directory creation');
    
    const sourcePath = join(claudeSkillsDir, 'import-test-2');
    const result = await importSkill(sourcePath, 'import-test-2', tempWorkspace);
    
    expect(result.success).toBe(true);
    expect(existsSync(join(tempWorkspace, 'skills'))).toBe(true);
    expect(existsSync(join(tempWorkspace, 'skills', 'import-test-2'))).toBe(true);
  });

  test('fails when source directory does not exist', async () => {
    const nonExistentPath = join(claudeSkillsDir, 'non-existent-skill');
    const result = await importSkill(nonExistentPath, 'non-existent', workspaceRoot);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Source directory does not exist');
  });

  test('fails when skill already exists in workspace', async () => {
    createSkill(claudeSkillsDir, 'duplicate-skill', 'Duplicate Skill', 'Test duplicate');
    
    const sourcePath = join(claudeSkillsDir, 'duplicate-skill');
    
    // First import should succeed
    const result1 = await importSkill(sourcePath, 'duplicate-skill', workspaceRoot);
    expect(result1.success).toBe(true);
    
    // Second import should fail
    const result2 = await importSkill(sourcePath, 'duplicate-skill', workspaceRoot);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('already exists');
  });

  test('imports skill with different slug than directory name', async () => {
    createSkill(claudeSkillsDir, 'original-name', 'Original Name', 'Test rename');
    
    const sourcePath = join(claudeSkillsDir, 'original-name');
    const result = await importSkill(sourcePath, 'new-slug-name', workspaceRoot);
    
    expect(result.success).toBe(true);
    
    const targetPath = join(workspaceRoot, 'skills', 'new-slug-name');
    expect(existsSync(targetPath)).toBe(true);
    
    // Verify symlink points to original directory
    const linkTarget = readlinkSync(targetPath);
    expect(linkTarget).toBe(sourcePath);
  });

  test('handles special characters in skill slug', async () => {
    createSkill(claudeSkillsDir, 'special-chars', 'Special Chars', 'Test special chars');
    
    const sourcePath = join(claudeSkillsDir, 'special-chars');
    const result = await importSkill(sourcePath, 'my-special_skill.v1', workspaceRoot);
    
    expect(result.success).toBe(true);
    expect(existsSync(join(workspaceRoot, 'skills', 'my-special_skill.v1'))).toBe(true);
  });

  test('imported skill is readable through symlink', async () => {
    createSkill(claudeSkillsDir, 'readable-test', 'Readable Test', 'Test readability');
    
    const sourcePath = join(claudeSkillsDir, 'readable-test');
    await importSkill(sourcePath, 'readable-test', workspaceRoot);
    
    const targetPath = join(workspaceRoot, 'skills', 'readable-test', 'SKILL.md');
    expect(existsSync(targetPath)).toBe(true);
    
    const { readFileSync } = await import('fs');
    const content = readFileSync(targetPath, 'utf-8');
    expect(content).toContain('Readable Test');
    expect(content).toContain('Test readability');
  });
});

// ============================================
// Integration Tests
// ============================================

describe('integration: scan and import', () => {
  test('scans global skills and imports one to workspace', async () => {
    // Create global skills
    createSkill(claudeSkillsDir, 'integration-1', 'Integration 1', 'First integration skill');
    createSkill(claudeSkillsDir, 'integration-2', 'Integration 2', 'Second integration skill');
    
    // Scan global skills
    const globalSkills = scanGlobalSkills(testDir);
    expect(globalSkills.length).toBe(2);
    
    // Import one skill
    const skillToImport = globalSkills[0];
    const result = await importSkill(skillToImport.path, skillToImport.slug, workspaceRoot);
    
    expect(result.success).toBe(true);
    
    // Verify workspace has the imported skill
    const workspaceSkillPath = join(workspaceRoot, 'skills', skillToImport.slug);
    expect(existsSync(workspaceSkillPath)).toBe(true);
    expect(lstatSync(workspaceSkillPath).isSymbolicLink()).toBe(true);
  });

  test('imports all global skills to workspace', async () => {
    // Create multiple global skills
    createSkill(claudeSkillsDir, 'bulk-1', 'Bulk 1', 'Bulk import test 1');
    createSkill(claudeSkillsDir, 'bulk-2', 'Bulk 2', 'Bulk import test 2');
    createSkill(agentsSkillsDir, 'bulk-3', 'Bulk 3', 'Bulk import test 3');
    
    // Scan and import all
    const globalSkills = scanGlobalSkills(testDir);
    expect(globalSkills.length).toBe(3);
    
    const results = await Promise.all(
      globalSkills.map(skill => importSkill(skill.path, skill.slug, workspaceRoot))
    );
    
    // All imports should succeed
    expect(results.every(r => r.success)).toBe(true);
    
    // Verify all skills are in workspace
    const workspaceSkillsDir = join(workspaceRoot, 'skills');
    expect(existsSync(join(workspaceSkillsDir, 'bulk-1'))).toBe(true);
    expect(existsSync(join(workspaceSkillsDir, 'bulk-2'))).toBe(true);
    expect(existsSync(join(workspaceSkillsDir, 'bulk-3'))).toBe(true);
  });
});
