import { Fragment, type ReactNode } from 'react'

/**
 * Minimal, dependency-free markdown renderer for Aiya replies.
 * Supports: **bold**, *italic* / _italic_, `code`, [text](url), bullet/numbered
 * lists, ## headings, and line breaks. Anything else renders as plain text.
 * Deliberately small (CLAUDE.md 1.17 — avoid a markdown lib for this).
 */

// Inline: bold / italic / code / links. Order matters (code first so its
// contents aren't re-parsed).
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = []
  // Combined matcher; each alternative captures a different style.
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(_[^_]+_)|(\[[^\]]+\]\([^)\s]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    const tok = m[0]
    const key = `${keyPrefix}-${i++}`
    if (tok.startsWith('`')) {
      nodes.push(<code key={key} className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[0.9em] font-mono">{tok.slice(1, -1)}</code>)
    } else if (tok.startsWith('**')) {
      nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>)
    } else if (tok.startsWith('*')) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>)
    } else if (tok.startsWith('_')) {
      nodes.push(<em key={key}>{tok.slice(1, -1)}</em>)
    } else {
      // [text](url)
      const mm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)
      if (mm) {
        nodes.push(
          <a key={key} href={mm[2]} target="_blank" rel="noopener noreferrer" className="underline text-primary break-all">{mm[1]}</a>
        )
      } else {
        nodes.push(tok)
      }
    }
    last = m.index + tok.length
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function MarkdownText({ text, className = '' }: { text: string; className?: string }) {
  const lines = text.split('\n')
  const blocks: ReactNode[] = []
  let listItems: ReactNode[] = []
  let listOrdered = false

  const flushList = (key: string) => {
    if (listItems.length === 0) return
    const items = listItems
    listItems = []
    blocks.push(
      listOrdered
        ? <ol key={key} className="list-decimal pl-5 space-y-1 my-1">{items}</ol>
        : <ul key={key} className="list-disc pl-5 space-y-1 my-1">{items}</ul>
    )
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd()
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line)
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line)
    const heading = /^\s*#{1,6}\s+(.*)$/.exec(line)

    if (bullet) {
      if (listOrdered && listItems.length) flushList(`l-${idx}`)
      listOrdered = false
      listItems.push(<li key={`li-${idx}`}>{renderInline(bullet[1], `li-${idx}`)}</li>)
    } else if (numbered) {
      if (!listOrdered && listItems.length) flushList(`l-${idx}`)
      listOrdered = true
      listItems.push(<li key={`li-${idx}`}>{renderInline(numbered[1], `li-${idx}`)}</li>)
    } else {
      flushList(`l-${idx}`)
      if (heading) {
        blocks.push(<p key={`h-${idx}`} className="font-bold mt-2 mb-1">{renderInline(heading[1], `h-${idx}`)}</p>)
      } else if (line.trim() === '') {
        blocks.push(<div key={`sp-${idx}`} className="h-2" />)
      } else {
        blocks.push(<p key={`p-${idx}`}>{renderInline(line, `p-${idx}`)}</p>)
      }
    }
  })
  flushList('l-end')

  return <div className={`leading-relaxed break-words ${className}`}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>
}
