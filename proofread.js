const piece = new URLSearchParams(window.location.search).get('piece');
const titleNode = document.querySelector('[data-title]');
const statusNode = document.querySelector('[data-status]');
const messageNode = document.querySelector('[data-message]');

function scoreUrl(path, score) {
  const url = new URL(path, window.location.href);
  const revision = score.viewer_revision || score.review_revision || score.lilypond_sha256;
  if (revision) url.searchParams.set('revision', revision);
  if (score.review_revision) url.searchParams.set('score_revision', score.review_revision);
  return url.href;
}

function fail(message) {
  statusNode.textContent = '';
  messageNode.textContent = message;
}

async function loadScores() {
  const [catalogResponse, reviewsResponse] = await Promise.all([
    fetch('catalog.json', {cache: 'no-cache'}),
    fetch('reviews.json', {cache: 'no-cache'}),
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
  statusNode.textContent = 'These scores need human proofreading. Withdrawn candidates are labelled separately.';
  const queue = document.querySelector('[data-queue]');
  for (const score of reviews) {
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `proofread.html?piece=${encodeURIComponent(score.slug)}`;
    link.textContent = `${score.composer} — ${score.title} (${score.catalogue})${score.withdrawn ? ' — withdrawn draft' : score.draft ? ' — unmerged review draft' : ''}`;
    item.append(link);
    queue.append(item);
  }
  queue.hidden = false;
  if (!reviews.length) messageNode.textContent = 'No draft scores are available for review yet.';
}

function showScore(score) {
  titleNode.textContent = `${score.composer} — ${score.title}`;
  document.title = `${score.title} — Proofread — The OPUS Project`;
  statusNode.textContent = score.withdrawn
    ? 'Withdrawn draft — needs correction and human proofreading'
    : score.draft
      ? 'Unmerged review draft — needs human proofreading'
    : score.verified_by
      ? `Human verified by @${score.verified_by}`
      : score.step === 3
        ? 'Reconciled score — needs human proofreading'
        : `Agent step ${score.step}/3 — not yet reconciled`;

  document.querySelector('[data-source-link]').href = score.source_pdf;
  const scopeNode = document.querySelector('[data-scope]');
  scopeNode.textContent = score.source_scope ? `Review scope: ${score.source_scope}` : '';
  scopeNode.hidden = !score.source_scope;
  document.querySelector('[data-source-frame]').src = score.source_pdf;
  document.querySelector('[data-library-link]').href = score.source_page;
  const crosscheck = document.querySelector('[data-crosscheck-link]');
  if (score.crosscheck_url) {
    crosscheck.href = score.crosscheck_url;
    crosscheck.textContent = score.crosscheck_name || 'High-resolution scan';
  } else {
    crosscheck.hidden = true;
  }
  document.querySelector('[data-rendered-link]').href = scoreUrl(score.pdf_url, score);
  document.querySelector('[data-rendered-frame]').src = scoreUrl(score.pdf_url, score);
  document.querySelector('[data-lilypond-link]').href = scoreUrl(score.lilypond_url, score);
  document.querySelector('[data-edition-link]').href = `pieces/${encodeURIComponent(score.slug)}/metadata.json`;
  const reviewLink = document.querySelector('[data-review-link]');
  if (score.step === 3 && score.review_notes_url) {
    reviewLink.href = scoreUrl(score.review_notes_url, score);
  } else {
    reviewLink.hidden = true;
  }
  document.querySelector('[data-revision]').textContent = score.lilypond_sha256
    ? `Transcription SHA-256: ${score.lilypond_sha256}`
    : '';

  const reportTitle = `Proofreading: ${score.composer} — ${score.title}`;
  const reportBody = `Work: ${score.composer} — ${score.title}\nResult: [no errors found / corrections needed]\nPages and measures checked:\nLilyPond SHA-256 checked: ${score.lilypond_sha256 || '[enter revision]'}\n${score.review_url ? `Review PR: ${score.review_url}\nReview commit: ${score.review_revision}\n` : ''}Details:\nSource PDF: ${score.source_pdf}\nSource PDF SHA-256: ${score.source_sha256 || '[enter source digest]'}\nRendered PDF: ${scoreUrl(score.pdf_url, score)}`;
  const params = new URLSearchParams({category: 'general', title: reportTitle, body: reportBody});
  document.querySelector('[data-feedback]').href = `https://github.com/the-opus-project/the-opus-project.github.io/discussions/new?${params}`;

  document.querySelector('[data-compare]').hidden = false;
  document.querySelector('[data-report]').hidden = false;
}

loadScores()
  .then(({catalog, reviews}) => {
    if (!piece) {
      showQueue([...catalog.filter((score) => !score.verified_by), ...reviews]);
      return;
    }
    const score = [...catalog, ...reviews].find((entry) => entry.slug === piece);
    if (score) showScore(score);
    else fail('This work is not available for proofreading.');
  })
  .catch(() => fail('The score lists could not be loaded. Please try again later.'));
