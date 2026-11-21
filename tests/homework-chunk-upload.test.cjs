const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const id = 'a'.repeat(64);
const response = (value, status = 200) => new Response(JSON.stringify(value), {status});
function load(fetch) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '../lib/homework-chunk-upload.ts'), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {
    exports, fetch, FormData, AbortSignal, DOMException, Error,
    setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 1)), clearTimeout,
  });
  return exports.sendHomeworkChunks;
}
function input() {
  return {api:'https://example.invalid',homeworkId:'1',attemptId:'one',token:'test',files:[new File([Buffer.alloc(300000)],'a.jpg',{type:'image/jpeg'})],retainedImageIds:[],signal:new AbortController().signal,progress:()=>{}};
}

test('a lost chunk acknowledgement retries only that chunk; lost commit response retries the same receipt', async () => {
  const calls = [], chunks = [];
  let failedChunk = false, failedCommit = false;
  const send = load(async (url, options) => {
    calls.push(url);
    assert.equal(options.headers.Authorization, 'Bearer test');
    if (url.endsWith('/uploads')) {
      assert.equal(options.headers['Content-Type'], 'application/json');
      assert.equal(JSON.parse(options.body).attemptId, 'one');
      return response({uploadId:id,chunkBytes:262144});
    }
    if (options.method === 'PUT') {
      chunks.push((await options.body.get('chunk').arrayBuffer()).byteLength);
      if (!failedChunk) {failedChunk = true; throw new Error('ack lost');}
      return response({received:true});
    }
    if (!failedCommit) {failedCommit = true; throw new Error('receipt lost');}
    return response({status:'PROCESSING'});
  });
  assert.equal((await send(input())).status, 'PROCESSING');
  assert.deepEqual(chunks, [262144,262144,37856]);
  assert.equal(calls.filter(x=>x.endsWith('/0/0')).length,2);
  assert.equal(calls.filter(x=>x.endsWith('/0/1')).length,1);
  assert.equal(calls.filter(x=>x.endsWith('/commit')).length,2);
});

test('a permanent validation error is not retried', async () => {
  let count = 0;
  const send = load(async () => {count++;return response({message:'File rejected'},400);});
  await assert.rejects(send(input()), /File rejected/);
  assert.equal(count,1);
});

test('cancelling after a chunk stops all remaining chunks and commit', async () => {
  const controller = new AbortController(), calls = [];
  const send = load(async (url) => {
    calls.push(url);
    return response(url.endsWith('/uploads') ? {uploadId:id,chunkBytes:262144} : {received:true});
  });
  await assert.rejects(send({...input(),signal:controller.signal,progress:()=>controller.abort()}));
  assert.equal(calls.length,2);
  assert.equal(calls.some(x=>x.endsWith('/commit')),false);
});
