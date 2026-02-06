/**
 * Skills Discovery
 *
 * Scans global skill directories (~/.claude/skills, ~/.agents/skills)
 * and returns parsed skills ready for import.
 */

import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import matter from 'gray-matter';
import type { LoadedSkill } from './types';
import { validateIconValue, findIconFile } from '../utils/icon';

/**
 * Get global skills directories
 * @param customHomeDir - Optional custom home directory for testing
 */
function getGlobalDirs(customHomeDir?: string): string[] {
  const home = customHomeDir || homedir();
  return [
    join(home, '.claude', 'skills'),
    join(home, '.agents', 'skills'),
  ];
}

/**
 * Scan global skills directories and return list of skills
 * @param customHomeDir - Optional custom home directory for testing
 * @returns Array of LoadedSkill objects from global directories
 */
export function scanGlobalSkills(customHomeDir?: string): LoadedSkill[] {
  const skills: LoadedSkill[] = [];
  const globalDirs = getGlobalDirs(customHomeDir);

  for (const dir of globalDirs) {
    if (!existsSync(dir)) continue;

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (!entry.isDirectory() && !entry.isSymbolicLink()) continue;

        const skillPath = join(dir, entry.name);
        const skillFile = join(skillPath, 'SKILL.md');
        
        if (!existsSync(skillFile)) continue;

        try {
          // Parse SKILL.md
          const content = readFileSync(skillFile, 'utf-8');
          const parsed = matter(content);

          // Use fallbacks for missing required fields
          let name = parsed.data.name as string | undefined;
          let description = parsed.data.description as string | undefined;
          let hasBrokenFrontmatter = false;

          if (!name) {
            // Fallback: use slug as name (convert kebab-case to Title Case)
            name = entry.name.split('-').map(word =>
              word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
            hasBrokenFrontmatter = true;
          }

          if (!description) {
            // Fallback: use generic description
            description = `Skill instructions for ${name}`;
            hasBrokenFrontmatter = true;
          }

          // Validate and extract optional icon field
          const icon = validateIconValue(parsed.data.icon, 'Skills');

          skills.push({
            slug: entry.name,
            metadata: {
              name,
              description,
              globs: parsed.data.globs as string[] | undefined,
              alwaysAllow: parsed.data.alwaysAllow as string[] | undefined,
              icon,
            },
            content: parsed.content,
            iconPath: findIconFile(skillPath),
            path: skillPath,
            hasBrokenFrontmatter,
          });
        } catch {
          // Skip skills with parsing errors
          continue;
        }
      }
    } catch {
      // Skip unreadable directories
    }
  }

  return skills;
}
