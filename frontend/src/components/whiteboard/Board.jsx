import { convertToExcalidrawElements, Excalidraw, exportToBlob } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { memo, useRef } from 'react'
import { useTheme } from '../../lib/theme'

// The whiteboard: Excalidraw (MIT), loaded only on this page because it is large.
//
// Through onReady it hands the page a few actions:
//   shapes()          everything on the board, to save
//   picture()         a PNG of YOUR shapes (not Bella's notes), as a data URL, or null if the board is empty
//   showNotes(notes)  pins Bella's notes [{ target: <element id or "">, text }], replacing her old ones
//   clearNotes()      removes Bella's notes
// onYourChange() is called when you add, move, edit or delete one of your shapes (Bella's notes don't count).

const NOTE_WIDTH = 240

function isFromBella(element) {
  return element.customData?.by === 'ai'
}

function yourShapes(elements) {
  return elements.filter((element) => !element.isDeleted && !isFromBella(element))
}

// The box around all your shapes, to find empty space for a general note.
function boundsOf(elements) {
  if (elements.length === 0) return { minY: 0, maxX: 0 }
  return {
    minY: Math.min(...elements.map((e) => e.y)),
    maxX: Math.max(...elements.map((e) => e.x + (e.width || 0))),
  }
}

// Bella's notes as board shapes: a yellow sticky note beside the box it is about, and a dashed orange
// circle around that box. All of them are tagged as hers, so her reviews skip them.
function noteShapes(notes, mine) {
  const shapes = []
  const bounds = boundsOf(mine)
  const notesPerBox = {}
  notes.forEach((note, i) => {
    const target = mine.find((element) => element.id === note.target)
    let x = bounds.maxX + 80
    let y = bounds.minY + i * 100
    if (target) {
      const already = notesPerBox[target.id] || 0
      notesPerBox[target.id] = already + 1
      x = target.x + target.width + 40
      y = target.y - 10 + already * 90
      shapes.push({
        type: 'ellipse',
        x: target.x - 18,
        y: target.y - 18,
        width: target.width + 36,
        height: target.height + 36,
        strokeColor: '#e8590c',
        strokeStyle: 'dashed',
        strokeWidth: 2,
        backgroundColor: 'transparent',
      })
    }
    shapes.push({
      type: 'rectangle',
      x,
      y,
      width: NOTE_WIDTH,
      height: 70,
      strokeColor: '#f08c00',
      backgroundColor: '#fff3bf',
      fillStyle: 'solid',
      roundness: { type: 3 },
      label: { text: `Bella: ${note.text}`, fontSize: 16, strokeColor: '#5c3d00' },
    })
  })
  return convertToExcalidrawElements(shapes).map((element) => ({ ...element, customData: { by: 'ai' } }))
}

// Is every one of these shapes inside the part of the board you can see right now?
function allInView(api, elements) {
  const { scrollX, scrollY, zoom, width, height } = api.getAppState()
  const left = -scrollX
  const top = -scrollY
  const right = left + width / zoom.value
  const bottom = top + height / zoom.value
  return elements.every((e) => e.x >= left && e.y >= top && e.x + e.width <= right && e.y + e.height <= bottom)
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function Board({ initialShapes, readOnly = false, onReady, onYourChange }) {
  const lastSeen = useRef(null) // a fingerprint of your shapes, to notice real changes
  const { theme } = useTheme() // the board follows the app's theme (the picture Bella sees is always light)

  function handleApi(api) {
    if (!api) return
    onReady?.({
      shapes: () => api.getSceneElements(),
      async picture() {
        const mine = yourShapes(api.getSceneElements())
        if (mine.length === 0) return null
        const blob = await exportToBlob({
          elements: mine,
          appState: { exportBackground: true, viewBackgroundColor: '#ffffff', exportWithDarkMode: false },
          files: api.getFiles(),
          mimeType: 'image/png',
          maxWidthOrHeight: 1200, // big enough to read the labels, small enough to keep the request light
        })
        return blobToDataUrl(blob)
      },
      showNotes(notes) {
        const mine = yourShapes(api.getSceneElements())
        const added = noteShapes(notes, mine)
        api.updateScene({ elements: [...mine, ...added] })
        // If a note landed outside the visible part of the board, zoom out so you can see it.
        if (added.length > 0 && !allInView(api, added)) {
          api.scrollToContent([...mine, ...added], { fitToContent: true, animate: true })
        }
      },
      clearNotes() {
        api.updateScene({ elements: yourShapes(api.getSceneElements()) })
      },
    })
  }

  // Excalidraw calls onChange for everything (even moving the mouse), so compare a fingerprint of your shapes.
  function handleChange(elements) {
    const fingerprint = yourShapes(elements)
      .map((element) => `${element.id}:${element.version}`)
      .join('|')
    if (lastSeen.current === null) {
      lastSeen.current = fingerprint // the first call is just the board loading
      return
    }
    if (fingerprint !== lastSeen.current) {
      lastSeen.current = fingerprint
      onYourChange?.()
    }
  }

  return (
    <div className="board">
      <Excalidraw
        initialData={{ elements: initialShapes, appState: { viewBackgroundColor: '#ffffff' }, scrollToContent: true }}
        excalidrawAPI={handleApi}
        onChange={handleChange}
        viewModeEnabled={readOnly}
        theme={theme}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false, toggleTheme: false, export: false } }}
      />
    </div>
  )
}

// The page re-renders every second (for its countdown). memo keeps the board from re-rendering with it.
export default memo(Board)
