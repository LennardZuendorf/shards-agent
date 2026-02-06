import { useState, useEffect } from 'react';
import type { LoadedSkill } from '../../shared/types';

export interface UseLocalSkillsResult {
  localSkills: LoadedSkill[];
  conflicts: string[];
}

/**
 * Hook for discovering local skills from working directory
 * Filters out conflicting skills (workspace skills take precedence)
 */
export function useLocalSkills(
  workingDirectory: string | null | undefined,
  workspaceSkills: LoadedSkill[]
): UseLocalSkillsResult {
  const [localSkills, setLocalSkills] = useState<LoadedSkill[]>([]);
  const [conflicts, setConflicts] = useState<string[]>([]);

  useEffect(() => {
    // Reset if no working directory
    if (!workingDirectory) {
      setLocalSkills([]);
      setConflicts([]);
      return;
    }

    // Scan for local skills
    window.electronAPI.scanLocalSkills(workingDirectory).then((skills: LoadedSkill[]) => {
      // Filter out conflicts - workspace skills take precedence
      const workspaceSlugs = new Set(workspaceSkills.map((s: LoadedSkill) => s.slug));
      const nonConflicting = skills.filter((s: LoadedSkill) => !workspaceSlugs.has(s.slug));
      const conflicting = skills.filter((s: LoadedSkill) => workspaceSlugs.has(s.slug)).map((s: LoadedSkill) => s.slug);

      setLocalSkills(nonConflicting);
      setConflicts(conflicting);
    }).catch((err: unknown) => {
      console.error('[useLocalSkills] Failed to scan:', err);
      setLocalSkills([]);
      setConflicts([]);
    });
  }, [workingDirectory, workspaceSkills]);

  return { localSkills, conflicts };
}
