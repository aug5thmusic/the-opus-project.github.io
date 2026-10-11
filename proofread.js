const piece = new URLSearchParams(window.location.search).get('piece');
const titleNode = document.querySelector('[data-title]');
const statusNode = document.querySelector('[data-status]');
const messageNode = document.querySelector('[data-message]');

function fail(message) {
  statusNode.textContent = '';
  messageNode.textContent = message;
}

async function loadScores() {
  const [catalogResponse, reviewsResponse] = await Promise.all([
    fetch('catalog.json'),
    fetch('reviews.json'),
  ]);
  if (!catalogResponse.ok || !reviewsResponse.ok) throw new Error('Score lists unavailable');
  const [catalog, reviews] = await Promise.all([
    catalogResponse.json(),
    reviewsResponse.json(),
  ]);
  return {catalog: catalog.scores, reviews: reviews.scores};
}

function showQueue(reviews) {
  titleNode.textContent = 'Scores for proofreading';
  statusNode.textContent = 'Drafts are separate from the catalog and are not human verified.';
  const queue = document.querySelector('[data-queue]');
  for (const score of reviews) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `proofread.html?piece=${encodeURIComponent(score.slug)}`;
    link.textContent = `${score.composer} — ${score.title} (${score.catalogue})`;
    item.append(link);
    queue.append(item);
  }
  queue.hidden = false;
  if (!reviews.length) messageNode.textContent = 'No draft scores are available for review yet.';
}

function showScore(score) {
  titleNode.textContent = `${score.composer} — ${score.title}`;
  document.title = `${score.title} — Proofread — The OPUS Project`;
  statusNode.textContent = score.draft
    ? 'Draft candidate — not in the catalog or human verified'
    : score.verified_by
      ? `Human verified by @${score.verified_by}`
      : score.step === 3
        ? 'Reconciled score — needs human proofreading'
        : `Agent step ${score.step}/3 — not yet reconciled`;

  document.querySelector('[data-source-link]').href = score.source_pdf;
  document.querySelector('[data-source-frame]').src = score.source_pdf;
  document.querySelector('[data-library-link]').href = score.source_page;
  const crosscheck = document.querySelector('[data-crosscheck-link]');
  if (score.crosscheck_url) {
    crosscheck.href = score.crosscheck_url;
    crosscheck.textContent = score.crosscheck_name || 'High-resolution scan';
  } else {
    crosscheck.hidden = true;
  }
  document.querySelector('[data-rendered-link]').href = score.pdf_url;
  document.querySelector('[data-rendered-frame]').src = score.pdf_url;
  document.querySelector('[data-lilypond-link]').href = score.lilypond_url;

  const reportTitle = `Proofreading: ${score.composer} — ${score.title}`;
  const reportBody = `Work: ${score.composer} — ${score.title}\nResult: [no errors found / corrections needed]\nPages and measures checked:\nRevision checked:\nDetails:\nSource PDF: ${score.source_pdf}\nRendered PDF: ${new URL(score.pdf_url, window.location.href).href}`;
  const params = new URLSearchParams({category: 'general', title: reportTitle, body: reportBody});
  document.querySelector('[data-feedback]').href = `https://github.com/dhruv9saini/the-opus-project/discussions/new?${params}`;

  const discussionNode = document.querySelector('[data-discussion]');
  window.addEventListener('message', (event) => {
    if (event.origin !== 'https://giscus.app') return;
    if (event.source !== discussionNode.querySelector('iframe')?.contentWindow) return;
    if (typeof event.data?.giscus?.error === 'string') discussionNode.hidden = true;
  });

  const discussionScript = document.createElement('script');
  discussionScript.src = 'https://giscus.app/client.js';
  discussionScript.async = true;
  discussionScript.crossOrigin = 'anonymous';
  const discussionOptions = {
    repo: 'dhruv9saini/the-opus-project',
    'repo-id': 'R_kgDOUtZHyQ',
    category: 'General',
    'category-id': 'DIC_kwDOUtZHyc4DGioB',
    mapping: 'specific',
    term: `Score reports: ${score.slug}`,
    strict: '1',
    'reactions-enabled': '0',
    'emit-metadata': '0',
    'input-position': 'top',
    theme: 'preferred_color_scheme',
    lang: 'en',
  };
  for (const [key, value] of Object.entries(discussionOptions)) {
    discussionScript.setAttribute(`data-${key}`, value);
  }
  discussionNode.append(discussionScript);

  document.querySelector('[data-compare]').hidden = false;
  document.querySelector('[data-report]').hidden = false;
}

loadScores()
  .then(({catalog, reviews}) => {
    if (!piece) {
      showQueue(reviews);
      return;
    }
    const score = [...catalog, ...reviews].find((entry) => entry.slug === piece);
    if (score) showScore(score);
    else fail('This work is not available for proofreading.');
  })
  .catch(() => fail('The score lists could not be loaded. Please try again later.'));
