// Only catalog-selected references become links. A URL query never supplies a URL.
export function publicLink(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function pieceLink(value, extension, siteRoot) {
  if (typeof value !== 'string' || !['pdf', 'ly'].includes(extension)) return null;
  if (!new RegExp('^pieces/[a-z0-9][a-z0-9-]*/(?:score|attempts/[0-9]{2})\\.' + extension + '$').test(value)) return null;
  const root = new URL(siteRoot);
  if (!['http:', 'https:'].includes(root.protocol) || !root.pathname.endsWith('/')) return null;
  return new URL(value, root).href;
}

export function workLinks(score, siteRoot) {
  return [
    ['Original printed PDF', publicLink(score.source_pdf)],
    ['Library record', publicLink(score.source_page)],
    ['Rendered PDF', pieceLink(score.pdf_url, 'pdf', siteRoot)],
    ['LilyPond file', pieceLink(score.lilypond_url, 'ly', siteRoot)],
  ].filter(([, url]) => url !== null);
}
