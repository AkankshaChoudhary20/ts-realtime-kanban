import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {WebSocket} from 'ws';
const directory=mkdtempSync(join(tmpdir(),'kanban-tests-'));
process.env.KANBAN_DATA_DIR=directory;
const encoding=await import('lib0/encoding.js');
const syncProtocol=await import('y-protocols/sync.js');
const {Room}=await import('../src/room.js');
class Client extends EventEmitter {readyState=1; code=0; messages:Uint8Array[]=[]; send(message:Uint8Array){this.messages.push(message);} close(code=1000){this.code=code;this.readyState=3;this.emit('close');}}
test('malformed sync messages close only the offending connection',()=>{
  const room=new Room('malformed'),bad=new Client(),healthy=new Client();
  room.join(bad as unknown as WebSocket);room.join(healthy as unknown as WebSocket);
  try {
    assert.doesNotThrow(()=>bad.emit('message',Buffer.from([0])));
    assert.equal(bad.code,1003);assert.equal(healthy.readyState,1);assert.equal(room.conns.size,1);
    const request=encoding.createEncoder();encoding.writeVarUint(request,0);syncProtocol.writeSyncStep1(request,room.doc);
    const before=healthy.messages.length;
    healthy.emit('message',Buffer.from(encoding.toUint8Array(request)));
    assert.equal(healthy.messages.length,before+1);assert.equal(healthy.readyState,1);
    assert.doesNotThrow(()=>healthy.emit('message',Buffer.from([99])));
    assert.equal(healthy.code,1003);
  }finally{room.awareness.destroy();room.doc.destroy();rmSync(directory,{recursive:true,force:true});}
});
