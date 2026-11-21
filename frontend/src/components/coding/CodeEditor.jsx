import { indentWithTab } from '@codemirror/commands'
import { python } from '@codemirror/lang-python'
import { lintGutter, setDiagnostics } from '@codemirror/lint'
import { Compartment, EditorState } from '@codemirror/state'
import { oneDark } from '@codemirror/theme-one-dark'
import { EditorView, keymap } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { memo, useEffect, useRef } from 'react'
import { useTheme } from '../../lib/theme'

// Holds the editor's colours, so they can change with the app's theme without rebuilding the editor.
const colours = new Compartment()

function coloursFor(theme) {
  return theme === 'dark' ? oneDark : []
}

// The code editor: CodeMirror (MIT) with Python colours. Loaded only on the coding screen.
//   initialCode     the code it starts with (later changes come from typing, not from this prop)
//   notes           Bella's notes [{ line, text }], shown as marks on those lines (hover to read them)
//   readOnly
//   onReady(editor) hands the page { jumpTo(line) }
//   onChange(code)
function CodeEditor({ initialCode, notes, readOnly = false, onReady, onChange }) {
  const boxRef = useRef(null)
  const viewRef = useRef(null)
  const onChangeRef = useRef(onChange) // always the latest onChange, without rebuilding the editor
  const { theme } = useTheme()
  const firstProps = useRef({ initialCode, readOnly, onReady, theme }) // the editor is built once, from these

  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    const { initialCode, readOnly, onReady, theme } = firstProps.current
    const view = new EditorView({
      parent: boxRef.current,
      state: EditorState.create({
        doc: initialCode,
        extensions: [
          basicSetup,
          python(),
          keymap.of([indentWithTab]), // Tab indents, like in a normal code editor
          lintGutter(),
          colours.of(coloursFor(theme)),
          EditorState.readOnly.of(readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current?.(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    onReady?.({
      jumpTo(lineNumber) {
        const line = view.state.doc.line(Math.min(Math.max(1, lineNumber), view.state.doc.lines))
        view.dispatch({ selection: { anchor: line.from }, scrollIntoView: true })
        view.focus()
      },
    })
    return () => view.destroy()
  }, [])

  // The app's theme changed: swap the editor's colours (dark: One Dark; light: CodeMirror's own).
  useEffect(() => {
    viewRef.current?.dispatch({ effects: colours.reconfigure(coloursFor(theme)) })
  }, [theme])

  // Bella's notes become marks on their lines (CodeMirror keeps them on the right line as you type).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const doc = view.state.doc
    const marks = []
    for (const note of notes || []) {
      if (note.line < 1 || note.line > doc.lines) continue
      const line = doc.line(note.line)
      marks.push({ from: line.from, to: line.to, severity: 'info', source: 'Bella', message: note.text })
    }
    view.dispatch(setDiagnostics(view.state, marks))
  }, [notes])

  return <div className="code-editor" ref={boxRef} />
}

export default memo(CodeEditor)
