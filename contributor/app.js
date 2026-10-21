import {workLinks} from './work-links.mjs';

const slug = new URLSearchParams(location.search).get('piece');
if (slug) {
  const panel = document.getElementById('selected-work');
  const status = document.getElementById('work-status');
  panel.hidden = false;
  status.textContent = 'Loading the selected work…';
  const root = new URL('../', import.meta.url);
  Promise.all(['catalog.json', 'reviews.json'].map(async path => {
    const response = await fetch(new URL(path, root));
    if (!response.ok) throw new Error('The project score lists are unavailable.');
    const data = await response.json();
    if (!Array.isArray(data.scores)) throw new Error('The project score list is invalid.');
    return data.scores;
  })).then(lists => {
    const score = lists.flat().find(item => item.slug === slug);
    if (!score) throw new Error('This work is not in the current score lists. You can still open a package below.');
    document.getElementById('selected-title').textContent = `${score.composer} — ${score.title}`;
    status.textContent = score.draft ? 'Draft candidate; not human verified.' : score.verified_by
      ? `Catalog verification credited to @${score.verified_by}. A new correction still requires review of its exact revision.`
      : 'Awaiting human review. Opening files does not verify this work.';
    const links = document.getElementById('work-links');
    for (const [label, href] of workLinks(score, root)) {
      const link = document.createElement('a');
      link.textContent = label;
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      links.append(link);
    }
  }).catch(error => { status.textContent = error.message; });
}
