# Design: SpAIder

How the app should look, feel and read. It applies to every new screen.

## 1. Principles

1. **Calm.** Practising for an interview is stressful enough. Warm, quiet colours, one accent, no clutter.
2. **One thing at a time.** Each screen has one main action. Rounds take the whole window; nothing else competes.
3. **Show the work.** When the AI is busy, say what it is doing ("Emily is writing a note…"), never just spin.
   Every score shows its reason: covered and missed points, the panel's notes, the X-ray.
4. **Friendly, not cute.** The spider is the app's character: it cheers, gets bored, gets angry when you
   skip days or switch tabs. It never blocks the work.
5. **Plain words.** Short sentences, everyday English, and always what happens next.

## 2. Visual language

All colours, radii and shadows are tokens in `frontend/src/styles/tokens.css`. Components never use raw colours
for anything that changes with the theme.

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | cream `#f7f4ee` | deep green `#121614` | page |
| `--panel` | white | `#1a1f1d` | cards |
| `--accent` / `--accent-fill` | teal `#2f6f62` | `#63bfa9` / `#2b8270` | links, primary buttons, focus |
| `--good`, `--warn`, `--bad` (+ `-soft`, `-ink`) | green, amber, red | lighter versions | scores, states, heatmap |
| `--text`, `--text2`, `--muted` | near-black to grey | near-white to grey | text levels |

- **Themes:** light and dark, chosen from the system or the sidebar switch, set on `<html data-theme>` before the
  first paint (no flash). Every new style is checked in both.
- **Type:** the system UI font at 15px / 1.55; a monospace token for code, keys and timers.
- **Shape:** cards with a 14px radius, a soft shadow and a 1px line; chips and pills fully rounded.
- **Icons:** one inline SVG set (`components/Icon.jsx`), 2px rounded strokes, no icon font.
- **Score colours:** 4–5 good, 3 middling, 0–2 weak, everywhere (reports, heatmap, past lists).

## 3. Layout

- **App frame:** a 260px sidebar (practice pages, insights, the pet spider, theme, backend status) and the page.
  The sidebar collapses to icons; at 860px and below it becomes a top bar.
- **Rounds take the window:** the voice call, panel call, whiteboard and coding room cover the app frame, with a
  header (back, title, tools, timer) and controls at the bottom, like a video call.
- **Focus mode:** the round goes full screen and the sidebar is hidden.
- **Setup screens:** numbered cards on the left, a sticky summary with the start button on the right.
- **No horizontal scrolling** at phone width (430px) on any screen.

## 4. Components and patterns

| Pattern | Where | Rule |
|---|---|---|
| Card | everywhere | One topic per card; title, short help line, content |
| Chips and segmented choices | setup screens | For small fixed sets (level, count, mode) |
| Dialog (`<dialog>`) | confirmations, X-ray, summaries | Esc closes; focus stays inside; destructive actions in red |
| Live steps | interview, panel | Each AI step appears with a spinner, then a tick |
| Captions | voice calls | Words appear in step with the voice; typing dots while the voice loads |
| Status pill | calls | One line: whose turn it is and which key to press |
| Empty state | lists | An icon, one sentence, one button to start |
| Loader | page loads | The spider on its thread with a label, never a bare spinner |

## 5. Key screens

- **Mock interview (text):** the question card (with Bella's greeting before question 1), the answer box with
  word count, mic and ⌘/Ctrl + Enter; live steps while grading.
- **Voice call:** the 3D interviewer in an office scene, name plate with sound bars, captions, self-view camera,
  controls (answer, pause, camera, captions, replay, skip, type, end).
- **Panel call:** a Google Meet style grid, one tile per panelist in their colour and one for you. The speaker's
  tile gets a coloured border, a ring that grows with the voice and a talking mouth; during introductions each
  tile lights up in turn. Captions sit in a strip under the tiles. "Panel notes" opens a drawer.
- **Panel report:** the decision and vote count, one card per panelist's verdict, agreed / disagreed / work on
  next, then every turn with its score and the notes the panel passed.
- **Resume grind:** the resume as a heatmap (each claim line tinted by its colour, with its score), a card with
  the share of lines defended and a start button, and the selected line's questions and answers.
- **Whiteboard and coding:** the board or editor fills the space; Bella's panel on the right; her notes appear
  on the board or beside the lines they refer to.
- **Stats:** streak, calendar, round totals, and the web, where each open task is a fly on a spoke.

## 6. The spider

- **Moods** follow the spider's health: happy (green), okay (yellow), itchy (orange, scratches), angry (red,
  shakes). Bored (heavy eyelids, tapping foot) after a few idle minutes. A cheer when you finish something.
- **Panel spiders** each have their own colour (blue, amber, purple, orange, pink) used for their tile, avatar
  and notes.
- **Focus mode:** the spider drops in on its thread when you return from another tab, crosser each time, with a
  cobweb that grows with the time you were away.

## 7. Motion

Page changes use the View Transitions API (a short fade and rise). Spinners, live dots and spider animations are
small and slow. Everything decorative stops when the system asks for reduced motion.

## 8. Accessibility

- Keyboard first: Space to talk in calls, ⌘/Ctrl + K to jump anywhere, ⌘/Ctrl + Enter to submit, Esc to close.
- Visible focus rings (`--focus`), labels on icon-only buttons, `role="status"` on live messages.
- Text on tinted backgrounds uses the matching `-ink` token for contrast.
- Captions are on by default in every voice mode.
