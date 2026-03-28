import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import { useEffect, useState } from 'react'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Link as LinkIcon, Unlink,
} from 'lucide-react'
import styles from './RichEditor.module.css'

export default function RichEditor({ value, onChange, placeholder = 'Write something…' }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      // Treat empty paragraph as empty string
      onChange(html === '<p></p>' ? '' : html)
    },
  })

  // Sync incoming value changes (e.g. when EditVideoPage loads the video)
  useEffect(() => {
    if (!editor) return
    if (value === undefined || value === null) return
    const current = editor.getHTML()
    const incoming = value === '' ? '<p></p>' : value
    if (current !== incoming) {
      editor.commands.setContent(incoming, false)
    }
  }, [value, editor])

  const [linkPrompt, setLinkPrompt] = useState(false)
  const [linkUrl,    setLinkUrl]    = useState('')

  function openLinkPrompt() {
    const existing = editor.getAttributes('link').href
    setLinkUrl(existing || 'https://')
    setLinkPrompt(true)
  }

  function applyLink() {
    const url = linkUrl.trim()
    if (!url || url === 'https://') {
      editor.chain().focus().unsetLink().run()
    } else {
      editor.chain().focus().setLink({ href: url }).run()
    }
    setLinkPrompt(false)
    setLinkUrl('')
  }

  if (!editor) return null

  return (
    <div className={styles.wrap}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <ToolBtn
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        ><Bold size={13} /></ToolBtn>

        <ToolBtn
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        ><Italic size={13} /></ToolBtn>

        <ToolBtn
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        ><UnderlineIcon size={13} /></ToolBtn>

        <ToolBtn
          active={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title="Strikethrough"
        ><Strikethrough size={13} /></ToolBtn>

        <div className={styles.sep} />

        <ToolBtn
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet list"
        ><List size={13} /></ToolBtn>

        <ToolBtn
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered list"
        ><ListOrdered size={13} /></ToolBtn>

        <div className={styles.sep} />

        <ToolBtn
          active={editor.isActive('link')}
          onClick={openLinkPrompt}
          title="Add link"
        ><LinkIcon size={13} /></ToolBtn>

        {editor.isActive('link') && (
          <ToolBtn
            onClick={() => editor.chain().focus().unsetLink().run()}
            title="Remove link"
          ><Unlink size={13} /></ToolBtn>
        )}
      </div>

      {/* Link input */}
      {linkPrompt && (
        <div className={styles.linkBar}>
          <input
            className={styles.linkInput}
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyLink() } if (e.key === 'Escape') setLinkPrompt(false) }}
            placeholder="https://..."
            autoFocus
          />
          <button type="button" className={styles.linkApply} onClick={applyLink}>Apply</button>
          <button type="button" className={styles.linkCancel} onClick={() => setLinkPrompt(false)}>Cancel</button>
        </div>
      )}

      {/* Editor area */}
      <div className={styles.editorWrap} data-placeholder={placeholder}>
        <EditorContent editor={editor} className={styles.editor} />
      </div>
    </div>
  )
}

function ToolBtn({ children, active, onClick, title }) {
  return (
    <button
      type="button"
      className={`${styles.toolBtn} ${active ? styles.toolBtnActive : ''}`}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
    >
      {children}
    </button>
  )
}
