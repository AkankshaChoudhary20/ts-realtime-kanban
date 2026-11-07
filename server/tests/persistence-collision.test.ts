import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import * as Y from 'yjs';
const dir=mkdtempSync(join(tmpdir(),'kanban-collision-'));process.env.KANBAN_DATA_DIR=dir;
const {loadRoom,scheduleSave}=await import('../src/persistence.js');
test('room names that sanitize identically persist independently',async()=>{
 const names=['a/b','a?b','a_b'];const docs=names.map(()=>new Y.Doc());const loaded=names.map(()=>new Y.Doc());
 try{
  names.forEach((name,i)=>{docs[i].getMap('test').set('room',name);scheduleSave(name,docs[i]);});
  await new Promise(r=>setTimeout(r,700));
  names.forEach((name,i)=>{loadRoom(name,loaded[i]);assert.equal(loaded[i].getMap('test').get('room'),name);});
 }finally{[...docs,...loaded].forEach(d=>d.destroy());rmSync(dir,{recursive:true,force:true});}
});
