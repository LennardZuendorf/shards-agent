import * as React from 'react'
import { useCallback } from 'react'
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText, Pencil, Trash2, FilePlus, FolderPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import type { FileNode as FileNodeType } from '../../../shared/types'

export interface FileNodeProps {
  node: FileNodeType
  depth: number
  expandedPaths: Set<string>
  currentFilePath: string | null
  onFileClick: (filePath: string) => void
  onToggleExpand: (dirPath: string) => void
  onRename: (node: FileNodeType) => void
  onDelete: (node: FileNodeType) => void
  onNewNote: (parentDir: string) => void
  onNewFolder: (parentDir: string) => void
}

export function FileNodeItem({
  node,
  depth,
  expandedPaths,
  currentFilePath,
  onFileClick,
  onToggleExpand,
  onRename,
  onDelete,
  onNewNote,
  onNewFolder,
}: FileNodeProps) {
  const isDirectory = node.type === 'directory'
  const isExpanded = expandedPaths.has(node.path)
  const isActive = !isDirectory && node.path === currentFilePath

  const handleClick = useCallback(() => {
    if (isDirectory) {
      onToggleExpand(node.path)
    } else {
      onFileClick(node.path)
    }
  }, [isDirectory, node.path, onFileClick, onToggleExpand])

  const handleDoubleClick = useCallback(() => {
    onRename(node)
  }, [node, onRename])

  // Get the parent directory for context menu "New" actions on files
  const parentDir = isDirectory ? node.path : node.path.substring(0, node.path.lastIndexOf('/'))

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger>
          <div
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onKeyDown={(e) => { if (e.key === 'Enter') handleClick() }}
            className={cn(
              'flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm text-left cursor-default',
              'hover:bg-foreground/5 transition-colors',
              isActive && 'bg-foreground/10 text-foreground',
            )}
            style={{ paddingLeft: `${depth * 16 + 8}px` }}
          >
            {isDirectory ? (
              isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="size-3.5 shrink-0" />
            )}

            {isDirectory ? (
              isExpanded ? (
                <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <Folder className="size-4 shrink-0 text-muted-foreground" />
              )
            ) : (
              <FileText className="size-4 shrink-0 text-muted-foreground" />
            )}

            <span className="truncate">{node.name}</span>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {isDirectory && (
            <>
              <ContextMenuItem onClick={() => onNewNote(node.path)}>
                <FilePlus className="h-3.5 w-3.5" />
                <span>New Note</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onNewFolder(node.path)}>
                <FolderPlus className="h-3.5 w-3.5" />
                <span>New Folder</span>
              </ContextMenuItem>
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem onClick={() => onRename(node)}>
            <Pencil className="h-3.5 w-3.5" />
            <span>Rename</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={() => onDelete(node)}>
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {isDirectory && isExpanded && node.children && (
        node.children.map((child) => (
          <FileNodeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            expandedPaths={expandedPaths}
            currentFilePath={currentFilePath}
            onFileClick={onFileClick}
            onToggleExpand={onToggleExpand}
            onRename={onRename}
            onDelete={onDelete}
            onNewNote={onNewNote}
            onNewFolder={onNewFolder}
          />
        ))
      )}
    </>
  )
}
