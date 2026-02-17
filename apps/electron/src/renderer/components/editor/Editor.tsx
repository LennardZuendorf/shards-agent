import { useEffect, useRef, useCallback } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { editorExtensions } from './extensions'
import {
  currentFilePathAtom,
  frontmatterAtom,
  isDirtyAtom,
  editorWindowTitleAtom,
} from '../../atoms/editor'

// Editor styles
import './editor.css'

// Import tiptap node styles from scaffolded template
import '../tiptap/tiptap-node/blockquote-node/blockquote-node.css'
import '../tiptap/tiptap-node/code-block-node/code-block-node.css'
import '../tiptap/tiptap-node/heading-node/heading-node.css'
import '../tiptap/tiptap-node/list-node/list-node.css'
import '../tiptap/tiptap-node/paragraph-node/paragraph-node.css'
import '../tiptap/tiptap-node/horizontal-rule-node/horizontal-rule-node.css'

const AUTO_SAVE_DELAY = 1500

export const Editor = () => {
  const [currentFile, setCurrentFile] = useAtom(currentFilePathAtom)
  const [frontmatter, setFrontmatter] = useAtom(frontmatterAtom)
  const [isDirty, setDirty] = useAtom(isDirtyAtom)
  const windowTitle = useAtomValue(editorWindowTitleAtom)
  const isLoadingFile = useRef(false)
  const isSaving = useRef(false)

  const editor = useEditor({
    extensions: editorExtensions,
    content: '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'shards-editor',
        'aria-label': 'Note editor',
      },
    },
    onUpdate: () => {
      if (!isLoadingFile.current) {
        setDirty(true)
      }
    },
  })

  // Save handler (with concurrent-save guard)
  const save = useCallback(async () => {
    if (!editor || !currentFile || isSaving.current) return
    isSaving.current = true
    const markdown = (editor.storage.markdown as any)?.getMarkdown?.() ?? ''
    try {
      await window.electronAPI.notesSave(currentFile, markdown, frontmatter)
      setDirty(false)
    } catch (error) {
      console.error('Failed to save note:', error)
    } finally {
      isSaving.current = false
    }
  }, [editor, currentFile, frontmatter, setDirty])

  // Auto-save: debounced 1.5s
  useEffect(() => {
    if (!isDirty) return

    const timerId = setTimeout(() => {
      save()
    }, AUTO_SAVE_DELAY)

    return () => clearTimeout(timerId)
  }, [isDirty, save])

  // Auto-save on blur
  useEffect(() => {
    const handleBlur = () => {
      if (isDirty) save()
    }
    window.addEventListener('blur', handleBlur)
    return () => window.removeEventListener('blur', handleBlur)
  }, [isDirty, save])

  // Cmd+S handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        save()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [save])

  // Load file when currentFile changes
  useEffect(() => {
    if (!editor || !currentFile) {
      if (editor) {
        isLoadingFile.current = true
        editor.commands.setContent('')
        isLoadingFile.current = false
      }
      setFrontmatter('')
      setDirty(false)
      return
    }

    const loadFile = async () => {
      isLoadingFile.current = true
      try {
        const result = await window.electronAPI.notesOpen(currentFile)
        setFrontmatter(result.frontmatter)
        editor.commands.setContent(result.content, { contentType: 'markdown' })
        setDirty(false)
      } catch (error) {
        console.error('Failed to load note:', error)
        editor.commands.setContent('')
        setFrontmatter('')
      } finally {
        isLoadingFile.current = false
      }
    }

    loadFile()
  }, [editor, currentFile, setFrontmatter, setDirty])

  // Update document title
  useEffect(() => {
    document.title = windowTitle
  }, [windowTitle])

  if (!editor) return null

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full">
      {/* File info bar */}
      {currentFile && (
        <div className="flex items-center gap-2 px-4 py-2 text-xs text-foreground/50 border-b border-border/50">
          <span className="truncate">{currentFile.split('/').pop()}</span>
          {isDirty && <span className="text-foreground/30">•</span>}
        </div>
      )}

      {/* Editor content */}
      <div className="flex-1 overflow-auto">
        <EditorContent
          editor={editor}
          className="shards-editor-content"
        />
      </div>
    </div>
  )
}
