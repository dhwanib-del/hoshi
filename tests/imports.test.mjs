import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';

// `node --check` parses a file; it does not resolve its imports. So a panel.js
// that calls recencyOf() without importing it passes every check in CI and then
// throws "recencyOf is not defined" the moment the side panel opens, blanking
// the whole surface. That happened on 2026-11-03 and a screenshot caught it,
// which is not a thing CI can do. This closes the gap without a browser:
// every named import must be a real export of the module it names, and every
// bare identifier a module uses from its own imports must actually be imported.
const SRC=new URL('../src/',import.meta.url);

const IMPORT_RE=/import\s*\{([^}]*)\}\s*from\s*'(\.\/[^']+)'/g;

test('every named import resolves to a real export',async()=>{
 const files=(await readdir(SRC)).filter(f=>f.endsWith('.js'));
 const exportsOf=new Map();
 for(const file of files){
  const text=await readFile(new URL(file,SRC),'utf8');
  const names=new Set();
  for(const m of text.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g))names.add(m[1]);
  for(const m of text.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)/g))names.add(m[1]);
  exportsOf.set(file,names);
 }
 const problems=[];
 for(const file of files){
  const text=await readFile(new URL(file,SRC),'utf8');
  for(const m of text.matchAll(IMPORT_RE)){
   const target=path.basename(m[2]);
   if(!exportsOf.has(target)){problems.push(`${file} imports from missing module ${target}`);continue}
   for(const raw of m[1].split(',')){
    const name=raw.trim().split(/\s+as\s+/)[0].trim();
    if(!name)continue;
    if(!exportsOf.get(target).has(name))problems.push(`${file} imports {${name}} from ${target}, which does not export it`);
   }
  }
 }
 assert.deepEqual(problems,[],problems.join('\n'));
});

test('panel.js uses no helper it forgot to import',async()=>{
 const text=await readFile(new URL('panel.js',SRC),'utf8');
 const imported=new Set();
 for(const m of text.matchAll(IMPORT_RE))
  for(const raw of m[1].split(','))if(raw.trim())imported.add(raw.trim().split(/\s+as\s+/).pop().trim());
 // Everything panel.js could reach for from the engine modules.
 const available=new Set();
 for(const file of ['model.js','scoring.js','discovery.js','freshness.js']){
  const src=await readFile(new URL(file,SRC),'utf8');
  for(const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_$]+)/g))available.add(m[1]);
  for(const m of src.matchAll(/export\s+const\s+([A-Za-z0-9_$]+)/g))available.add(m[1]);
 }
 const declared=new Set();
 for(const m of text.matchAll(/(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/g))declared.add(m[1]);
 const missing=[...available].filter(name=>
  !imported.has(name)&&!declared.has(name)&&new RegExp('\\b'+name+'\\s*\\(').test(text));
 assert.deepEqual(missing,[],'panel.js calls these without importing them: '+missing.join(', '));
});
