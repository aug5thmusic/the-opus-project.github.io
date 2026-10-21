import assert from 'node:assert/strict';
import {publicLink, pieceLink, workLinks} from '../work-links.mjs';

assert.equal(pieceLink('pieces/example/score.pdf', 'pdf', 'https://example.org/project/'), 'https://example.org/project/pieces/example/score.pdf');
assert.equal(pieceLink('pieces/example/attempts/01.ly', 'ly', 'http://127.0.0.1:9999/preview/'), 'http://127.0.0.1:9999/preview/pieces/example/attempts/01.ly');
for (const path of ['../secret.pdf', '/pieces/example/score.pdf', 'https://evil.example/score.pdf', 'pieces/x/../../secret.pdf', 'pieces/x/%2e%2e/score.pdf', 'pieces/x/score.pdf?redirect=evil', 'pieces/x/score.ly']) {
  assert.equal(pieceLink(path, 'pdf', 'https://example.org/project/'), null, path);
}
for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'https://name:password@example.org/file', '//example.org/file', null]) assert.equal(publicLink(url), null);
assert.equal(publicLink('https://library.example/scan.pdf'), 'https://library.example/scan.pdf');
assert.deepEqual(workLinks({source_pdf:'javascript:alert(1)',source_page:'https://library.example/work',pdf_url:'pieces/example/score.pdf',lilypond_url:'../hidden'}, 'https://example.org/project/'), [
  ['Library record','https://library.example/work'],['Rendered PDF','https://example.org/project/pieces/example/score.pdf']
]);
console.log('Work links: prefix hosting, canonical files and untrusted URLs passed.');
