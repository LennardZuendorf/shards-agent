import { atom } from 'jotai'
import type { FileNode, MiddlePanelMode } from '../../shared/types'

// Current open file (the note being viewed)
export const currentFilePathAtom = atom<string | null>(null)
export const frontmatterAtom = atom('')        // preserved frontmatter string
export const isDirtyAtom = atom(false)         // unsaved changes flag

// File tree
export const fileTreeAtom = atom<FileNode[]>([])
export const fileTreeExpandedAtom = atom<Set<string>>(new Set<string>())

// Layout: what the middle panel shows (filetree vs sessions)
export const middlePanelModeAtom = atom<MiddlePanelMode>('filetree')

// Derived: window title
export const editorWindowTitleAtom = atom((get) => {
  const path = get(currentFilePathAtom)
  const dirty = get(isDirtyAtom)
  if (!path) return 'Shards'
  const name = path.split('/').pop() ?? 'Untitled'
  return `${dirty ? '* ' : ''}${name} — Shards`
})

