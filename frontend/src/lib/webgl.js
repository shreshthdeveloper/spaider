// Can this browser draw 3D (WebGL)? Checked once, then remembered.
let has3D = null

export function canDraw3D() {
  if (has3D === null) {
    try {
      const canvas = document.createElement('canvas')
      has3D = Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
    } catch {
      has3D = false
    }
  }
  return has3D
}
