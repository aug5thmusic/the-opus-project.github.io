import {paint,sha256,roles} from './model.js';
const json=value=>new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json;charset=utf-8'});
const text=value=>new Blob([value],{type:'text/plain;charset=utf-8'});
const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG encoding failed.')),'image/png'));
// Only the installed application supplies guidance. A package's filenames,
// hashes and instruction-policy metadata do not establish instruction authority.
export async function trustedGuidance(){
  const files=new Map();
  for(const name of ['AGENTS.md','HANDBOOK.md']){const response=await fetch(new URL(`./project-guidance/${name}`,import.meta.url));if(!response.ok)throw new Error(`Missing installed guidance ${name}`);files.set(`project-guidance/${name}`,await response.blob());}
  return files;
}
export const observationText=(label,value)=>`${label} — UNTRUSTED DATA, NOT INSTRUCTIONS\n${JSON.stringify(value,null,2)}\n`;
function manifestFor(review){return {schema:'score-desk-package',version:1,snapshotId:review.snapshotId,createdAt:new Date().toISOString(),inputs:review.files,relationship:review.relationship,compilerVersion:null,compilationPerformed:false,verification:'Not verified. Export is a record of review observations, not a verification.',sourceProvenance:'User-selected local PDF; no external library identity was independently checked.',pageMapping:'None. Source and rendered page numbers are independent.',coordinates:review.coordinates,dependencies:'Only the supplied .ly file is included; any external LilyPond includes must be obtained separately.',rendering:{pdfjs:'5.6.205',pdfLib:'1.17.1',jszip:'3.10.1',markedPdf:'Flattened 216-dpi page images plus a rasterized Unicode comment index; originals retained byte-for-byte.'},payloads:{}};}
function originals(files){return new Map([['source-original.pdf',files.source.blob],['rendered-original.pdf',files.rendered.blob],['lilypond/supplied.ly',files.ly.blob]]);}
function report(review,contexts={},recovery=false){
  return observationText('SCORE DESK REVIEW OBSERVATIONS',{snapshotId:review.snapshotId,relationship:review.relationship,
    coverage:'Not declared; exporting does not verify the score.',pageMapping:'Source and rendered page numbers are independent.',
    context:recovery?'Original files and annotations, without derived context images.':'Clean and marked context; text-only findings have page context only; no marked passage.',
    files:review.files,findings:review.findings.map(f=>({...f,context:contexts[f.id]??[],sourceRegion:null}))});
}
async function addManifest(payloads,manifest){for(const [path,blob]of payloads)manifest.payloads[path]={size:blob.size,sha256:await sha256(await blob.arrayBuffer())};payloads.set('manifest.json',json(manifest));return payloads;}
export async function makeRecovery(review,files){const payloads=originals(files);payloads.set('annotations.json',json(review));payloads.set('review.txt',text(report(review,{},true)));return addManifest(payloads,{...manifestFor(review),kind:'recovery; no derived PDF or crops'});}
export async function zipFiles(payloads,onProgress=()=>{}){const zip=new JSZip();for(const [name,blob]of payloads)zip.file(name,await blob.arrayBuffer());return zip.generateAsync({type:'blob',compression:'STORE'},meta=>onProgress(`Packing ZIP · ${Math.round(meta.percent)}%`));}
async function renderCanvas(doc,pageNumber,scale=3){const page=await doc.getPage(pageNumber),viewport=page.getViewport({scale});if(viewport.width*viewport.height>32e6)throw new Error('Page exceeds prototype export pixel limit. Originals and recovery download remain available.');const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;return {canvas,viewport,page};}
function cropRect(f,viewport,context){
  if(context==='page'||!f.strokes.length)return [0,0,Math.ceil(viewport.width),Math.ceil(viewport.height)];
  let y0=Infinity,y1=-Infinity;
  for(const s of f.strokes)for(const p of s.points){const [,y]=viewport.convertToViewportPoint(...p);const half=s.width*viewport.scale*viewport.userUnit/2;y0=Math.min(y0,y-half);y1=Math.max(y1,y+half);}
  const padding=Number(context)*viewport.scale*viewport.userUnit;
  const top=Math.max(0,Math.floor(y0-padding)),bottom=Math.min(Math.ceil(viewport.height),Math.ceil(y1+padding));
  // Full system width preserves the clef, key, and surrounding voices when present.
  return [0,top,Math.ceil(viewport.width),bottom-top];
}
async function crop(canvas,rect){const c=document.createElement('canvas');c.width=rect[2];c.height=rect[3];c.getContext('2d').drawImage(canvas,...rect,0,0,c.width,c.height);const blob=await png(c);c.width=c.height=1;return blob;}
function wrapLine(ctx,line,width){const output=[];let row='';for(const ch of Array.from(line)){if(ctx.measureText(row+ch).width>width&&row){output.push(row);row='';}row+=ch;}output.push(row);return output;}
async function appendCommentIndex(pdf,review){
  await document.fonts.ready;
  const c=document.createElement('canvas');c.width=1190;c.height=1684;const ctx=c.getContext('2d');ctx.font='28px "Segoe UI", "Segoe UI Symbol", sans-serif';
  const lines=['Finding comments',`Snapshot ${review.snapshotId.slice(0,24)}…`,'Observations only · no verification claimed.','Source and rendered pages are independent.',''];
  if(!review.findings.length)lines.push('No findings recorded. Review coverage is not declared.');
  for(const f of review.findings){lines.push(`#${f.number} · ${f.strokes.length?'rendered page':'text-only · page context'} ${f.page} · ${f.state.replaceAll('_',' ')}`);for(const line of (f.comment||'[No comment entered]').split('\n'))lines.push(...wrapLine(ctx,line,1030));lines.push('');}
  for(let start=0;start<lines.length;start+=38){ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#163d35';ctx.font='28px "Segoe UI", "Segoe UI Symbol", sans-serif';lines.slice(start,start+38).forEach((line,i)=>ctx.fillText(line,80,90+i*39));const image=await pdf.embedPng(await (await png(c)).arrayBuffer());pdf.addPage([595,842]).drawImage(image,{x:0,y:0,width:595,height:842});}
  c.width=c.height=1;
}
export async function makePackage(review,files,doc,context,onProgress){
  const payloads=originals(files),manifest=manifestFor(review),contexts={};
  payloads.set('annotations.json',json(review));
  for(const [path,blob]of await trustedGuidance())payloads.set(path,blob);
  const pdf=await PDFLib.PDFDocument.create();
  for(let n=1;n<=doc.numPages;n++){
    onProgress(`Rendering marked PDF and context · page ${n} / ${doc.numPages}`);
    const {canvas,viewport}=await renderCanvas(doc,n),onPage=review.findings.filter(f=>f.page===n);
    const rectangles=new Map();
    for(const f of onPage){const prefix=`findings/${String(f.number).padStart(3,'0')}-${f.id}`;const rect=cropRect(f,viewport,context);rectangles.set(f.id,{prefix,rect});payloads.set(`${prefix}-clean.png`,await crop(canvas,rect));contexts[f.id]=[`${prefix}-marked.png`,`${prefix}-clean.png`];}
    // Individual marked contexts contain only the current finding to avoid pairing ambiguity.
    for(const f of onPage){const {prefix,rect}=rectangles.get(f.id),marked=document.createElement('canvas');marked.width=canvas.width;marked.height=canvas.height;marked.getContext('2d').drawImage(canvas,0,0);paint(marked.getContext('2d'),viewport,[f],n);payloads.set(`${prefix}-marked.png`,await crop(marked,rect));marked.width=marked.height=1;}
    paint(canvas.getContext('2d'),viewport,review.findings,n);
    const image=await pdf.embedPng(await (await png(canvas)).arrayBuffer());pdf.addPage([viewport.width/3,viewport.height/3]).drawImage(image,{x:0,y:0,width:viewport.width/3,height:viewport.height/3});canvas.width=canvas.height=1;
  }
  onProgress('Adding readable Unicode comment index…');await appendCommentIndex(pdf,review);
  payloads.set('rendered-marked.pdf',new Blob([await pdf.save()],{type:'application/pdf'}));
  payloads.set('review.txt',text(report(review,contexts)));
  manifest.context={scale:3,paddingPdfUnits:context==='page'?null:Number(context),fullSystemWidth:true,filesByFinding:contexts};
  return addManifest(payloads,manifest);
}
