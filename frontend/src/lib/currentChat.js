// The backend stores every chat in MongoDB. The browser only remembers which chat is open,
// so #/chat (and a page refresh) can bring that conversation back.
const KEY = 'interview-coach.chat-session'

export function loadCurrentChatId() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function saveCurrentChatId(id) {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch {
    // Storage can be blocked (private mode). The chat still works; it just won't survive a refresh.
  }
}
