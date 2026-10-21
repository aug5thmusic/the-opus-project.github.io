import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {candidateIdentity,bookmark,savedLocation,validateLocations,comparisonContext} from '../comparison-model.js';
import {identify,newReview,sha256} from '../model.js';
import {fixtureBlob} from './fixtures.js';
globalThis.crypto??=webcrypto;
const files={source:{name:'source.pdf',blob:await fixtureBlob('source.pdf')},rendered:{name:'after.pdf',blob:await fixtureBlob('rendered.pdf')},ly:{name:'input.ly',blob:await fixtureBlob('score.ly')}};
const {identity,snapshotId}=await identify(files),review=newReview(identity,snapshotId,[{page:1,view:[12,24,592,764],rotation:90,userUnit:1}]);
const position={page:1,point:[110,420],zoom:1.5};
test('location identity checks code, PDF and snapshot independently and accepts old packages without locations',()=>{
  const location=bookmark('f',review,position);assert(savedLocation(location,'f',review));
  for(const key of Object.keys(candidateIdentity(review)))assert.equal(savedLocation({...location,candidate:{...location.candidate,[key]:'0'.repeat(64)}},'f',review),null);
  assert.equal(savedLocation(location,'another-finding',review),null);
  assert.deepEqual(validateLocations(undefined,{reported:[{id:'f'}]},review),{});
  assert.throws(()=>validateLocations({g:location},{reported:[{id:'f'}]},review));
  assert.throws(()=>bookmark('f',review,{...position,page:2}));
  assert.throws(()=>bookmark('f',review,{...position,point:[0,0]}));
  assert.throws(()=>bookmark('f',review,{...position,point:[NaN,0]}));
  assert.throws(()=>bookmark('f',review,{...position,zoom:10000}));
});
test('an unavailable or mismatched earlier PDF never receives historical coordinates',async()=>{
  const old=await fixtureBlob('multipage.pdf'),hash=await sha256(await old.arrayBuffer());
  const finding={id:'f',number:1,page:null,comment:'Earlier report',historicalContext:{renderSha256:hash,page:4,marked:'marked.png',clean:'clean.png',originalFiles:{rendered:{path:'old.pdf',sha256:hash}}}};
  const issued={files,review,task:{version:2,baseline:{renderSha256:review.files.rendered.sha256},findings:[finding]},payloads:new Map([['old.pdf',files.rendered.blob],['marked.png',new Blob(['crop'])]])};
  let context=await comparisonContext(issued,finding);assert(context.earlier);assert.equal(context.original,null);assert.equal(context.baseline.blob,files.rendered.blob);assert.equal(context.crops.length,2);
  issued.payloads.set('old.pdf',old);issued.payloads.set('wrong.json',new Blob([JSON.stringify(review)]));finding.historicalContext.annotations='wrong.json';
  await assert.rejects(comparisonContext(issued,finding),/do not match/);
});
test('AI location hints do not produce confirmed bookmarks or baseline coordinates',async()=>{
  const finding={id:'f',number:1,page:1,comment:'Text only',location:{position},candidateLocation:position,agent:{location:position}};
  const issued={files,review,task:{version:1,baseline:{renderSha256:review.files.rendered.sha256},findings:[finding]},payloads:new Map()};
  const context=await comparisonContext(issued,finding);assert.deepEqual(context.baseline.marks,[]);assert.equal(context.page,1);assert.equal(savedLocation(finding.location,'f',review),null);
});
