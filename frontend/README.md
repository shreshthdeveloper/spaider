# Interview Coach: frontend

React + Vite, plain JavaScript. It talks to the Flask backend only through `/api`.

## Run

```bash
npm install
npm run dev        # http://localhost:5173 (the Flask backend must run on port 5001)
npm run lint       # Oxlint
npm run build      # production files in dist/
```

To use a backend on another address: `API_URL=http://localhost:5091 npm run dev`.

## Where things live

| Path | Job |
|---|---|
| `vite.config.js` | Dev server and the proxy: every `/api` call goes to Flask, so there is no CORS setup |
| `src/main.jsx` | Starts React and loads the styles |
| `src/App.jsx` | The app frame (sidebar + page) and the list of pages per route |
| `src/lib/api.js` | **Every backend call.** If a route or payload changes, edit only this file |
| `src/lib/router.js` | A tiny hash router (`#/chat`); a refresh always works |
| `src/lib/markdown.jsx` | Safe Markdown for AI replies (HTML is stripped) |
| `src/components/` | Reusable pieces: `Sidebar`, `ChatMessage`, `Composer`, `Icon` |
| `src/pages/` | One file per screen: `ChatPage` (more pages come with the backend steps) |
| `src/styles/tokens.css` | All colours, radius and shadow. Change the theme here only |
| `src/styles/base.css` | Buttons, inputs, chips, Markdown |
| `src/styles/shell.css` | Sidebar and page layout, including the phone layout |
| `src/styles/chat.css` | The chat page |

## Adding a page

1. Create `src/pages/NewPage.jsx`.
2. Add it to `PAGES` in `src/App.jsx`.
3. Add (or un-"soon") its entry in `NAV` in `src/components/Sidebar.jsx`.
4. Put its backend calls in `src/lib/api.js` and its styles in `src/styles/`.
