// What your spider says in each mood. The backend picks the mood from her health
// (services/stats/health.py); her colour for each mood is in styles/stats.css (.mood-*).
export const MOODS = {
  happy: { name: 'Happy', line: 'Your web is in good shape.' },
  okay: { name: 'Okay', line: 'A round today would cheer me up.' },
  itchy: { name: 'Itchy', line: 'You missed a day. I’m getting itchy!' },
  angry: { name: 'Angry', line: 'You skipped days. My web is a mess!' },
}

// When you sit on a page for a while without doing anything.
export const BORED_LINE = 'Bored… shall we do something?'
