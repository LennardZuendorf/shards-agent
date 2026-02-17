import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { Editor } from '@/components/editor/Editor'
import { currentFilePathAtom } from '@/atoms/editor'

interface EditorTestPageProps {
  workspaceId: string
  filePath: string
}

export function EditorTestPage({ workspaceId, filePath }: EditorTestPageProps) {
  const setCurrentFile = useSetAtom(currentFilePathAtom)

  // Set the current file path when the route changes.
  // We do NOT clear on unmount — the note stays "open" even when
  // switching to the Chat tab, enabling note+chat dual mode.
  useEffect(() => {
    setCurrentFile(filePath)
  }, [filePath, setCurrentFile])

  return (
    <div className="flex flex-col h-full">
      <Editor />
    </div>
  )
}
