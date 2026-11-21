// A small, safe Markdown renderer for AI replies: paragraphs, lists, headings,
// bold, inline code, code blocks and tables. HTML tags are stripped and React
// escapes all text, so a reply can never inject a script into the page.
// Page citations like [p. 3] become small chips.

const CITATION = /^\[p\.\s?(\d+)\]$/

function inline(text, key) {
  const parts = []
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[p\.\s?\d+\]|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    const t = m[0]
    const citation = t.match(CITATION)
    if (t.startsWith('**')) parts.push(<b key={`${key}-${i++}`}>{t.slice(2, -2)}</b>)
    else if (t.startsWith('*')) parts.push(<i key={`${key}-${i++}`}>{t.slice(1, -1)}</i>)
    else if (t.startsWith('`')) parts.push(<code key={`${key}-${i++}`}>{t.slice(1, -1)}</code>)
    else if (citation) parts.push(<span key={`${key}-${i++}`} className="cite">p. {citation[1]}</span>)
    else parts.push(t.replace(/\[([^\]]+)\]\([^)]+\)/, '$1'))
    last = m.index + t.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

const LIST = /^\s*([-*]|\d+\.) /

export function Markdown({ text }) {
  const lines = (text || '').replace(/<[^>]+>/g, '').split('\n')
  const blocks = []
  let i = 0
  let k = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      blocks.push(<pre key={k++} className="md-code">{code.join('\n')}</pre>)
      continue
    }

    if (LIST.test(line)) {
      const ordered = /^\s*\d+\. /.test(line)
      const items = []
      while (i < lines.length && LIST.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(LIST, ''), `li${i}`)}</li>)
        i++
      }
      blocks.push(ordered ? <ol key={k++}>{items}</ol> : <ul key={k++}>{items}</ul>)
      continue
    }

    if (/^#{1,6} /.test(line)) {
      blocks.push(<h4 key={k++}>{inline(line.replace(/^#+ /, ''), `h${i}`)}</h4>)
      i++
      continue
    }

    if (line.trim().startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) {
          rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()))
        }
        i++
      }
      blocks.push(
        <table key={k++} className="md-table">
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri}>
                {r.map((c, ci) => (ri === 0 ? <th key={ci}>{inline(c, `t${ri}${ci}`)}</th> : <td key={ci}>{inline(c, `t${ri}${ci}`)}</td>))}
              </tr>
            ))}
          </tbody>
        </table>,
      )
      continue
    }

    if (!line.trim()) {
      i++
      continue
    }

    const para = []
    while (i < lines.length && lines[i].trim() && !/^(```|#{1,6} |\s*\|)/.test(lines[i]) && !LIST.test(lines[i])) {
      para.push(lines[i++])
    }
    blocks.push(<p key={k++}>{inline(para.join(' '), `p${k}`)}</p>)
  }

  return <div className="md">{blocks}</div>
}
