import * as React from 'react'
import { useEffect, useCallback, useState, useRef } from 'react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { FileText, Plus, FilePlus, FolderPlus } from 'lucide-react'
import { toast } from 'sonner'
import { FileNodeItem } from './FileNode'
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { RenameDialog } from '@/components/ui/rename-dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  fileTreeAtom,
  fileTreeExpandedAtom,
  currentFilePathAtom,
} from '@/atoms/editor'
import { navigate, routes } from '@/lib/navigate'
import type { FileNode } from '../../../shared/types'

/** Shared helper: refresh the file tree atom from disk */
function useRefreshTree(workspacePath: string) {
  const setFileTree = useSetAtom(fileTreeAtom)
  return useCallback(async () => {
    try {
      const tree = await window.electronAPI.notesList(workspacePath)
      setFileTree(tree)
    } catch (err) {
      console.error('Failed to refresh file tree:', err)
    }
  }, [workspacePath, setFileTree])
}

interface FileTreeProps {
  workspaceId: string
  workspacePath: string
}

export function FileTree({ workspaceId, workspacePath }: FileTreeProps) {
  const [fileTree, setFileTree] = useAtom(fileTreeAtom)
  const [expandedPaths, setExpandedPaths] = useAtom(fileTreeExpandedAtom)
  const currentFilePath = useAtomValue(currentFilePathAtom)
  const setCurrentFilePath = useSetAtom(currentFilePathAtom)

  // Rename dialog state
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const renameTargetRef = useRef<FileNode | null>(null)

  const refreshTree = useRefreshTree(workspacePath)

  // Load tree on mount or when workspace changes
  useEffect(() => {
    let cancelled = false
    async function loadTree() {
      try {
        const tree = await window.electronAPI.notesList(workspacePath)
        if (!cancelled) setFileTree(tree)
      } catch (err) {
        console.error('Failed to load file tree:', err)
      }
    }
    loadTree()
    return () => { cancelled = true }
  }, [workspacePath, setFileTree])

  const handleFileClick = useCallback((filePath: string) => {
    setCurrentFilePath(filePath)
    navigate(routes.view.note(workspaceId, filePath))
  }, [setCurrentFilePath, workspaceId])

  const handleToggleExpand = useCallback((dirPath: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(dirPath)) {
        next.delete(dirPath)
      } else {
        next.add(dirPath)
      }
      return next
    })
  }, [setExpandedPaths])

  // --- CRUD Operations ---

  // Collect sibling names in a directory (for unique name generation)
  const getSiblingNames = useCallback((parentDir: string): Set<string> => {
    const names = new Set<string>()
    const collect = (nodes: FileNode[]) => {
      for (const n of nodes) {
        if (n.path.substring(0, n.path.lastIndexOf('/')) === parentDir) {
          names.add(n.name)
        }
        if (n.children) collect(n.children)
      }
    }
    collect(fileTree)
    return names
  }, [fileTree])

  const handleNewNote = useCallback(async (parentDir: string) => {
    let name = 'Untitled.md'
    let counter = 1
    const existing = getSiblingNames(parentDir)
    while (existing.has(name)) {
      name = `Untitled ${counter}.md`
      counter++
    }

    const filePath = `${parentDir}/${name}`
    try {
      await window.electronAPI.notesCreate(filePath)
      await refreshTree()
      renameTargetRef.current = { name, path: filePath, type: 'file' }
      setRenameValue(name.replace(/\.md$/, ''))
      setRenameOpen(true)
    } catch (err) {
      toast.error('Failed to create note', { description: String(err) })
    }
  }, [getSiblingNames, refreshTree])

  const handleNewFolder = useCallback(async (parentDir: string) => {
    let name = 'Untitled'
    let counter = 1
    const existing = getSiblingNames(parentDir)
    while (existing.has(name)) {
      name = `Untitled ${counter}`
      counter++
    }

    const dirPath = `${parentDir}/${name}`
    try {
      await window.electronAPI.notesCreateDir(dirPath)
      await refreshTree()
      setExpandedPaths((prev) => new Set(prev).add(parentDir))
      renameTargetRef.current = { name, path: dirPath, type: 'directory' }
      setRenameValue(name)
      setRenameOpen(true)
    } catch (err) {
      toast.error('Failed to create folder', { description: String(err) })
    }
  }, [getSiblingNames, refreshTree, setExpandedPaths])

  const handleRename = useCallback((node: FileNode) => {
    renameTargetRef.current = node
    // Strip .md for files so user edits just the name
    setRenameValue(node.type === 'file' ? node.name.replace(/\.md$/, '') : node.name)
    setRenameOpen(true)
  }, [])

  const handleRenameSubmit = useCallback(async () => {
    const target = renameTargetRef.current
    if (!target) return

    if (!renameValue.trim()) {
      toast.error('Invalid name', { description: 'Name cannot be empty' })
      return
    }

    let newName = renameValue.trim()

    // Validate
    if (newName.includes('/') || newName.includes('\\')) {
      toast.error('Invalid name', { description: 'Name cannot contain / or \\' })
      return
    }

    // Auto-append .md for files
    if (target.type === 'file' && !newName.endsWith('.md')) {
      newName = `${newName}.md`
    }

    const parentDir = target.path.substring(0, target.path.lastIndexOf('/'))
    const newPath = `${parentDir}/${newName}`

    // Skip if name unchanged
    if (newPath === target.path) {
      setRenameOpen(false)
      return
    }

    try {
      await window.electronAPI.notesRename(target.path, newPath)
      await refreshTree()
      // If the renamed file was currently open, update the path
      if (currentFilePath === target.path) {
        setCurrentFilePath(newPath)
      }
      setRenameOpen(false)
    } catch (err) {
      toast.error('Failed to rename', { description: String(err) })
    }
  }, [renameValue, currentFilePath, setCurrentFilePath, refreshTree])

  const handleDelete = useCallback(async (node: FileNode) => {
    const confirmed = await window.electronAPI.notesDeleteConfirm(node.name)
    if (!confirmed) return

    try {
      await window.electronAPI.notesDelete(node.path)
      await refreshTree()
      // Clear editor if the deleted file was open
      if (currentFilePath === node.path) {
        setCurrentFilePath(null)
      }
    } catch (err) {
      toast.error('Failed to delete', { description: String(err) })
    }
  }, [currentFilePath, setCurrentFilePath, refreshTree])

  return (
    <>
      {fileTree.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>No notes yet</EmptyTitle>
            <EmptyDescription>
              Create a markdown file in your workspace to get started.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col overflow-y-auto px-1 py-1">
          {fileTree.map((node) => (
            <FileNodeItem
              key={node.path}
              node={node}
              depth={0}
              expandedPaths={expandedPaths}
              currentFilePath={currentFilePath}
              onFileClick={handleFileClick}
              onToggleExpand={handleToggleExpand}
              onRename={handleRename}
              onDelete={handleDelete}
              onNewNote={handleNewNote}
              onNewFolder={handleNewFolder}
            />
          ))}
        </div>
      )}
      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={renameTargetRef.current?.type === 'directory' ? 'Rename Folder' : 'Rename Note'}
        value={renameValue}
        onValueChange={setRenameValue}
        onSubmit={handleRenameSubmit}
        placeholder="Enter a name..."
      />
    </>
  )
}

/** Header action button: [+] dropdown for creating notes/folders */
export function FileTreeHeaderActions({ workspacePath }: { workspacePath: string }) {
  const fileTree = useAtomValue(fileTreeAtom)
  const refreshTree = useRefreshTree(workspacePath)

  const handleNewNote = useCallback(async () => {
    let name = 'Untitled.md'
    let counter = 1

    const existingNames = new Set(fileTree.map(n => n.name))
    while (existingNames.has(name)) {
      name = `Untitled ${counter}.md`
      counter++
    }

    try {
      await window.electronAPI.notesCreate(`${workspacePath}/${name}`)
      await refreshTree()
    } catch (err) {
      toast.error('Failed to create note', { description: String(err) })
    }
  }, [workspacePath, fileTree, refreshTree])

  const handleNewFolder = useCallback(async () => {
    let name = 'Untitled'
    let counter = 1

    const existingNames = new Set(fileTree.filter(n => n.type === 'directory').map(n => n.name))
    while (existingNames.has(name)) {
      name = `Untitled ${counter}`
      counter++
    }

    try {
      await window.electronAPI.notesCreateDir(`${workspacePath}/${name}`)
      await refreshTree()
    } catch (err) {
      toast.error('Failed to create folder', { description: String(err) })
    }
  }, [workspacePath, fileTree, refreshTree])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground transition-colors"
        >
          <Plus className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleNewNote}>
          <FilePlus className="h-3.5 w-3.5" />
          <span>New Note</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleNewFolder}>
          <FolderPlus className="h-3.5 w-3.5" />
          <span>New Folder</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
