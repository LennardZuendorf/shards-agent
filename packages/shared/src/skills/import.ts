/**
 * Skills Import
 *
 * Imports skills from global directories into workspace via symlinks.
 */

import { symlinkSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getWorkspaceSkillsPath } from '../workspaces/storage';

export interface ImportResult {
  success: boolean;
  slug: string;
  error?: string;
}

/**
 * Import a skill by creating a symlink from source to workspace skills directory
 * @param sourcePath - Absolute path to the source skill directory
 * @param slug - Skill slug (directory name)
 * @param workspaceRoot - Absolute path to workspace root
 * @returns ImportResult with success status and optional error message
 */
export function importSkill(
  sourcePath: string,
  slug: string,
  workspaceRoot: string
): ImportResult {
  // Check if source exists
  if (!existsSync(sourcePath)) {
    return {
      success: false,
      slug,
      error: 'Source directory does not exist',
    };
  }

  const skillsDir = getWorkspaceSkillsPath(workspaceRoot);
  const targetPath = join(skillsDir, slug);

  // Ensure skills directory exists
  if (!existsSync(skillsDir)) {
    mkdirSync(skillsDir, { recursive: true });
  }

  // Check if already exists
  if (existsSync(targetPath)) {
    return {
      success: false,
      slug,
      error: 'Skill already exists',
    };
  }

  try {
    // Create symlink (directory symlink)
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
