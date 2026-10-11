const catalogNode = document.querySelector('[data-catalog]');
const searchNode = document.querySelector('[data-search]');
let scores = [];

function addText(parent, tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  parent.append(node);
  return node;
}

function render(query = '') {
  const needle = query.trim().toLocaleLowerCase();
  const visible = scores.filter((score) =>
    [score.composer, score.title, score.catalogue]
      .join(' ')
      .toLocaleLowerCase()
      .includes(needle)
  );

  catalogNode.replaceChildren();
  if (!visible.length) {
    const message = scores.length
      ? 'No scores match that search.'
      : 'No scores are ready to show yet.';
    addText(catalogNode, 'p', 'empty', message);
    return;
  }

  const noun = visible.length === 1 ? 'work' : 'works';
  addText(catalogNode, 'p', 'catalog-summary', `${visible.length} ${noun}`);

  for (const score of visible) {
    const row = document.createElement('article');
    row.className = 'score-row';
    addText(row, 'p', 'composer', score.composer);
    addText(row, 'p', 'work', score.title);
    addText(row, 'p', 'catalog-meta', score.catalogue);
    const status = score.verified_by
      ? 'Human verified'
      : score.step === 3
        ? 'Needs proofreading'
        : `Step ${score.step}/3`;
    addText(row, 'span', 'badge', status);

    const links = document.createElement('div');
    links.className = 'score-links';
    const lilypond = addText(links, 'a', '', 'LilyPond');
    lilypond.href = score.lilypond_url;
    const pdf = addText(links, 'a', '', 'PDF');
    pdf.href = score.pdf_url;
    const compare = addText(links, 'a', '', 'Compare PDFs');
    compare.href = `proofread.html?piece=${encodeURIComponent(score.slug)}`;
    row.append(links);
    catalogNode.append(row);
  }
}

fetch('catalog.json')
  .then((response) => {
    if (!response.ok) throw new Error('HTTP ' + response.status);
    return response.json();
  })
  .then((data) => {
    scores = data.scores.sort((left, right) =>
      Number(Boolean(right.verified_by)) - Number(Boolean(left.verified_by)) ||
      right.step - left.step ||
      left.composer.localeCompare(right.composer) ||
      left.title.localeCompare(right.title)
    );
    render();
  })
  .catch(() => {
    catalogNode.replaceChildren();
    addText(catalogNode, 'p', 'empty', 'The catalog could not be loaded.');
  });

searchNode.addEventListener('input', (event) => render(event.target.value));
