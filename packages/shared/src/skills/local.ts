/**
 * Local Skills Discovery
 *
 * Scans working directory for skills in .agents/skills and .claude/skills
 */

import { existsSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { loadSkill } from './storage.ts';
import type { LoadedSkill } from './types.ts';
import { debug } from '../utils/debug.ts';

/**
 * Scan local skill directories in working directory
 * @param workingDirectory - Absolute path to working directory
 * @returns Array of LoadedSkill objects from local directories
 */
export function scanLocalSkills(workingDirectory: string): LoadedSkill[] {
  const skills: LoadedSkill[] = [];
  const seenSlugs = new Set<string>();
  
  debug('[scanLocalSkills] Scanning working directory:', workingDirectory);
  
  // Check both .agents and .claude as "workspace roots"
  // loadSkill will look for skills in {root}/skills/{slug}
  // Priority: .agents takes precedence over .claude (first wins)
  const roots = [
    join(workingDirectory, '.agents'),
    join(workingDirectory, '.claude'),
  ];

  for (const root of roots) {
    const skillsDir = join(root, 'skills');
    if (!existsSync(skillsDir)) {
      debug(`[scanLocalSkills] Skills directory does not exist: ${skillsDir}`);
      continue;
    }

    try {
      const entries = readdirSync(skillsDir, { withFileTypes: true });
      debug(`[scanLocalSkills] Found ${entries.length} entries in ${skillsDir}`);
      
      for (const entry of entries) {
        // Accept both directories and symlinks (for imported skills)
        if (!entry.isDirectory() && !entry.isSymbolicLink()) {
          debug(`[scanLocalSkills] Skipping non-directory entry: ${entry.name}`);
          continue;
        }

        // Skip if we've already seen this slug (deduplication)
        if (seenSlugs.has(entry.name)) {
          debug(`[scanLocalSkills] Skipping duplicate skill: ${entry.name}`);
          continue;
        }

        // Verify SKILL.md exists before attempting to load
        const skillPath = join(skillsDir, entry.name);
        const skillFile = join(skillPath, 'SKILL.md');
        if (!existsSync(skillFile)) {
          debug(`[scanLocalSkills] Skipping ${entry.name} - no SKILL.md found`);
          continue;
        }

        // loadSkill expects (workspaceRoot, slug) and will look in {root}/skills/{slug}
        const skill = loadSkill(root, entry.name);
        if (skill) {
          debug(`[scanLocalSkills] Loaded skill: ${skill.slug} from ${root}`);
          skills.push(skill);
          seenSlugs.add(skill.slug);
        } else {
          debug(`[scanLocalSkills] Failed to load skill: ${entry.name}`);
        }
      }
    } catch (error) {
      debug(`[scanLocalSkills] Error scanning ${skillsDir}:`, error);
      // Skip unreadable directories
    }
  }

  debug(`[scanLocalSkills] Total unique skills found: ${skills.length}`);
  return skills;
}
