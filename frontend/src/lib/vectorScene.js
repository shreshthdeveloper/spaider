// The 3D vector map, drawn with three.js (no React here).
// Each chunk is a ball coloured by its group; each group has a soft glow and its name floating over it.
// The question is a gold diamond. Lines join it to the chunks the search found, and those get a white ring:
// a solid line = sent to the AI, a faint line = found but below the cutoff. Drag to turn, scroll to zoom.
//
// createVectorScene(box, onHover) returns:
//   setData({ points, groups, question, hits, minRelevance })
//     points    [{ id, page, text, group, xyz: [x, y, z] }]   every chunk, each number between -1 and 1
//     groups    [{ id, label, size, center: [x, y, z] }]
//     question  [x, y, z] or null                             where the question lands on the same map
//     hits      [{ id, score }]                               what the search found
//   highlight(groupId)   fades every other group (null = show all)
//   dispose()
// onHover(info) is called with { page, text, score, groupLabel, x, y, onRight } over a ball, or null.
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  GridHelper,
  HemisphereLight,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

// One colour per group. Checked with the palette validator on this dark background: all three pairs
// stay apart for colour-blind viewers too. More than 3 groups would not, so the backend makes at most 3.
export const GROUP_COLORS = ['#3987e5', '#d95926', '#199e70']

const BACKGROUND = new Color('#0c2622')
const QUESTION_COLOR = '#ffbf4d'
const DOT_SIZE = 0.04
const MAP_SIZE = 1.2 // the -1..1 map is drawn this big

// A soft round glow, used behind every group and the question.
function makeGlowTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 128
  const context = canvas.getContext('2d')
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.45, 'rgba(255, 255, 255, 0.35)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)
  return new CanvasTexture(canvas)
}

function toScene(xyz) {
  return new Vector3(xyz[0] * MAP_SIZE, xyz[1] * MAP_SIZE, xyz[2] * MAP_SIZE)
}

export function createVectorScene(box, onHover) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  box.appendChild(renderer.domElement)

  const scene = new Scene()
  const camera = new PerspectiveCamera(45, 1, 0.1, 50)
  camera.position.set(2.3, 1.5, 2.7)

  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.enablePan = false
  controls.minDistance = 1.2
  controls.maxDistance = 7
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.7
  controls.addEventListener('start', () => (controls.autoRotate = false)) // the user takes over

  // Soft light from above, so the balls look round.
  scene.add(new HemisphereLight('#ffffff', '#1d3d37', 2.4))
  const sun = new DirectionalLight('#ffffff', 1.4)
  sun.position.set(2, 3, 2)
  scene.add(sun)

  // A faint floor grid gives depth.
  const grid = new GridHelper(MAP_SIZE * 2.4, 12, '#2f5c54', '#21433d')
  grid.position.y = -MAP_SIZE * 1.15
  scene.add(grid)

  const glowTexture = makeGlowTexture()
  const dotGeometry = new SphereGeometry(DOT_SIZE, 20, 14)
  const dotMaterial = new MeshLambertMaterial({ color: '#ffffff' })
  const ringGeometry = new SphereGeometry(DOT_SIZE * 1.55, 20, 14)
  const ringMaterial = new MeshBasicMaterial({ color: '#ffffff', side: BackSide }) // shows as a white outline

  const question = new Mesh(new OctahedronGeometry(0.08), new MeshBasicMaterial({ color: QUESTION_COLOR }))
  const questionGlow = new Sprite(
    new SpriteMaterial({
      map: glowTexture,
      color: QUESTION_COLOR,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
  )
  questionGlow.scale.setScalar(0.45)
  question.add(questionGlow)
  question.visible = false
  scene.add(question)

  const keptLines = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 }))
  const belowLines = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.22 }))
  scene.add(keptLines, belowLines)

  // Everything below is rebuilt by setData().
  let dots = null // one InstancedMesh for all the chunks
  let rings = null // white outlines around the chunks the search found
  let shown = [] // what each ball is: { page, text, score, group, groupLabel }
  let halos = [] // one glow per group
  let labels = [] // one floating name per group: { element, group, position }
  let focusGroup = null

  function clear() {
    for (const mesh of [dots, rings]) {
      if (mesh) {
        scene.remove(mesh)
        mesh.dispose()
      }
    }
    for (const halo of halos) {
      scene.remove(halo)
      halo.material.dispose()
    }
    for (const label of labels) label.element.remove()
    dots = null
    rings = null
    halos = []
    labels = []
  }

  function setLines(lines, positions) {
    lines.geometry.dispose()
    lines.geometry = new BufferGeometry()
    lines.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  }

  function setData({ points, groups, question: questionXyz, hits, minRelevance }) {
    clear()
    const scoreById = new Map(hits.map((hit) => [hit.id, hit.score]))
    const labelOf = new Map(groups.map((group) => [group.id, group.label]))
    const found = points.filter((point) => scoreById.has(point.id))

    // The balls, coloured by group (see highlight), and a white ring around each one the search found.
    dots = new InstancedMesh(dotGeometry, dotMaterial, Math.max(points.length, 1))
    dots.count = points.length
    rings = new InstancedMesh(ringGeometry, ringMaterial, Math.max(found.length, 1))
    rings.count = found.length

    const matrix = new Matrix4()
    let ringIndex = 0
    shown = points.map((point, i) => {
      const isFound = scoreById.has(point.id)
      const size = isFound ? 1.5 : 1
      matrix.makeScale(size, size, size).setPosition(toScene(point.xyz))
      dots.setMatrixAt(i, matrix)
      if (isFound) rings.setMatrixAt(ringIndex++, matrix)
      return {
        page: point.page,
        text: point.text,
        score: scoreById.get(point.id),
        group: point.group,
        groupLabel: labelOf.get(point.group),
      }
    })
    dots.instanceMatrix.needsUpdate = true
    rings.instanceMatrix.needsUpdate = true
    scene.add(rings, dots)

    // A glow and a floating name for each group.
    for (const group of groups) {
      const color = GROUP_COLORS[group.id % GROUP_COLORS.length]
      const center = toScene(group.center)
      const distances = points.filter((point) => point.group === group.id).map((point) => toScene(point.xyz).distanceTo(center))
      const spread = Math.max(0.25, ...distances)

      const halo = new Sprite(
        new SpriteMaterial({ map: glowTexture, color, transparent: true, opacity: 0.3, depthWrite: false, blending: AdditiveBlending }),
      )
      halo.position.copy(center)
      halo.scale.setScalar(spread * 2.4)
      halo.userData.group = group.id
      scene.add(halo)
      halos.push(halo)

      if (groups.length > 1) {
        const element = document.createElement('div')
        element.className = 'map-label'
        const swatch = document.createElement('i')
        swatch.style.background = color
        const name = document.createElement('span')
        name.textContent = group.label
        element.append(swatch, name)
        box.appendChild(element)
        labels.push({ element, group: group.id, position: center.clone().add(new Vector3(0, spread * 0.55 + 0.12, 0)) })
      }
    }

    // The question, with lines to the chunks the search found.
    const kept = []
    const below = []
    question.visible = Boolean(questionXyz)
    if (questionXyz) {
      const from = toScene(questionXyz)
      question.position.copy(from)
      for (const point of found) {
        const to = toScene(point.xyz)
        const list = scoreById.get(point.id) >= minRelevance ? kept : below
        list.push(from.x, from.y, from.z, to.x, to.y, to.z)
      }
    }
    setLines(keptLines, kept)
    setLines(belowLines, below)

    highlight(focusGroup)
  }

  // Fade every group except one (or show all again with null).
  function highlight(groupId) {
    focusGroup = groupId
    if (!dots) return
    shown.forEach((ball, i) => {
      const color = new Color(GROUP_COLORS[ball.group % GROUP_COLORS.length])
      if (groupId !== null && ball.group !== groupId) color.lerp(BACKGROUND, 0.75)
      dots.setColorAt(i, color)
    })
    if (dots.instanceColor) dots.instanceColor.needsUpdate = true
    for (const halo of halos) halo.material.opacity = groupId === null || halo.userData.group === groupId ? 0.3 : 0.05
    for (const label of labels) label.element.classList.toggle('faded', groupId !== null && label.group !== groupId)
  }

  // Which ball is under the mouse?
  const raycaster = new Raycaster()
  const mouse = new Vector2()
  function onPointerMove(e) {
    if (!dots) return
    const rect = renderer.domElement.getBoundingClientRect()
    mouse.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    raycaster.setFromCamera(mouse, camera)
    const hit = raycaster.intersectObject(dots)[0]
    if (hit && hit.instanceId !== undefined) {
      const x = e.clientX - rect.left
      onHover({ ...shown[hit.instanceId], x, y: e.clientY - rect.top, onRight: x > rect.width / 2 })
    } else {
      onHover(null)
    }
  }
  const onPointerLeave = () => onHover(null)
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerleave', onPointerLeave)

  function resize() {
    const width = box.clientWidth || 1
    const height = box.clientHeight || 1
    renderer.setSize(width, height)
    camera.aspect = width / height
    camera.updateProjectionMatrix()
  }
  const observer = new ResizeObserver(resize)
  observer.observe(box)
  resize()

  // Keep each group's name over its group as the map turns, without letting it go past the edges.
  const onScreen = new Vector3()
  function placeLabels() {
    const width = box.clientWidth
    const height = box.clientHeight
    for (const label of labels) {
      onScreen.copy(label.position).project(camera)
      label.element.style.display = onScreen.z > 1 ? 'none' : '' // behind the camera
      const half = label.element.offsetWidth / 2 + 6
      const x = Math.min(width - half, Math.max(half, ((onScreen.x + 1) / 2) * width))
      const y = Math.min(height - 6, Math.max(label.element.offsetHeight + 6, ((1 - onScreen.y) / 2) * height))
      label.element.style.left = `${x}px`
      label.element.style.top = `${y}px`
    }
  }

  renderer.setAnimationLoop((ms) => {
    question.rotation.y = ms / 600
    question.scale.setScalar(1 + Math.sin(ms / 300) * 0.12)
    controls.update()
    placeLabels()
    renderer.render(scene, camera)
  })

  return {
    setData,
    highlight,
    dispose() {
      renderer.setAnimationLoop(null)
      observer.disconnect()
      controls.dispose()
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerleave', onPointerLeave)
      clear()
      for (const thing of [dotGeometry, dotMaterial, ringGeometry, ringMaterial, glowTexture, grid]) thing.dispose()
      question.geometry.dispose()
      question.material.dispose()
      questionGlow.material.dispose()
      for (const lines of [keptLines, belowLines]) {
        lines.geometry.dispose()
        lines.material.dispose()
      }
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    },
  }
}
