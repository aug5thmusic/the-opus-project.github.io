import assert from 'node:assert/strict';
import {githubEvidence,githubInstructions,REPOSITORY} from '../github-handoff.js';
const root='1'.repeat(64),middle='2'.repeat(64),desired='3'.repeat(64);
const scene={returned:{taskId:'new'},review:{files:{ly:{sha256:desired}}},files:{ly:{name:'supplied.ly'}}};
const entries=new Map([
  ['new',{kind:'task',task:{id:'new',version:2,baseline:{codeSha256:middle},parent:{taskId:'original'}}}],
  ['original',{kind:'task',task:{id:'original',version:1,baseline:{codeSha256:root}}}],
]);
const lookup=async id=>entries.get(id);
const record={id:'completed',revision:{id:'reviewed'},scope:'partial',scopeNote:'First page only',reviewer:null,totals:{unresolved:2,missingDecisions:1},hashes:{ly:desired,source:'4'.repeat(64),rendered:'5'.repeat(64),annotations:'6'.repeat(64),state:'7'.repeat(64)}};
const full=await githubEvidence(scene,lookup);
assert.equal(full.originalBaseline,root);assert.equal(full.immediateBaseline,middle);assert.equal(full.desiredCode,desired);
assert.equal(full.repositoryPath,'Unknown');assert.equal(full.repositoryCommit,'Unknown');
const prompt=await githubInstructions(scene,record,lookup);
for(const evidence of [REPOSITORY,root,middle,desired,record.id,record.revision.id,'First page only','Unresolved findings: 2','Reported findings without decisions: 1'])assert.ok(prompt.includes(evidence));
for(const rule of ['missing, stale or ambiguous','do not blindly overwrite','a Git object ID is not this SHA-256','Ask the contributor for a work/title only','no code change','Preserve transcription step and models','not permission to claim human verification','renewed review','Never commit PDFs, PNGs, ZIPs','actual PR link'])assert.ok(prompt.includes(rule),rule);
entries.delete('original');assert.equal((await githubEvidence(scene,lookup)).originalBaseline,null,'missing earlier task cannot be presented as an original baseline');
const missing=await githubInstructions(scene,record,lookup);assert.ok(missing.includes('Original baseline LilyPond SHA-256: Unknown'));assert.ok(missing.includes('Immediate correction-task baseline SHA-256: '+middle));
assert.equal((await githubEvidence({...scene,returned:null},lookup)).immediateBaseline,null,'ordinary input has no inferred task baseline');
entries.get('new').task.parent.taskId='new';assert.equal((await githubEvidence(scene,lookup)).originalBaseline,null,'a cycle is incomplete evidence, not a new baseline');
assert.equal((await githubEvidence(scene,async()=>{throw new Error('Unavailable history');})).originalBaseline,null,'unavailable history leaves baseline explicitly unknown');
console.log('GitHub handoff evidence and safe-target guidance checks passed.');
