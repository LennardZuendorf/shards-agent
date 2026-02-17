import { StarterKit } from '@tiptap/starter-kit'
import { Markdown } from '@tiptap/markdown'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import { TableKit } from '@tiptap/extension-table'
import { common, createLowlight } from 'lowlight'

const lowlight = createLowlight(common)

export const editorExtensions = [
  StarterKit.configure({
    codeBlock: false, // replaced by CodeBlockLowlight
  }),

  Markdown,

  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'plaintext',
  }),

  Placeholder.configure({
    placeholder: 'Start writing...',
  }),

  TaskList,
  TaskItem.configure({ nested: true }),
  Highlight.configure({ multicolor: true }),
  TableKit,
]
