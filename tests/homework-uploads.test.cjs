const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function environment(saved) {
  const local = new Map([['studentAccessToken', 'student-token'], ['student', JSON.stringify({id: 1})]]);
  const session = new Map(saved);
  const xhrs = [];
  const events = [];
  const responses = [];
  class Request {
    upload = {};
    status = 0;
    responseText = '';
    aborted = false;
    constructor() {xhrs.push(this);}
    open(method, url) {this.method = method; this.url = url;}
    setRequestHeader(name, value) {this.header = [name, value];}
    send(body) {this.body = body;}
    abort() {this.aborted = true; this.onabort?.();}
    complete(status, result) {this.status = status; this.responseText = JSON.stringify(result); this.onload();}
  }
  const exports = {};
  const context = {
    exports, process: {env: {}}, console, Date, FormData, XMLHttpRequest: Request,
    localStorage: {getItem: key => local.get(key) ?? null},
    sessionStorage: {getItem: key => session.get(key) ?? null, setItem: (key, value) => session.set(key, value)},
    CustomEvent: class {constructor(type) {this.type = type;}},
    window: {dispatchEvent: event => events.push(event.type)},
    fetch: async () => {
      const response = responses.shift() ?? {status: 'PROCESSING'};
      if (response instanceof Error) throw response;
      return {ok: true, status: 200, json: async () => response};
    },
  };
  const source = fs.readFileSync(path.resolve(__dirname, '../lib/homework-uploads.ts'), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(compiled, context);
  return {store: exports, xhrs, local, session, events, responses};
}

const input = () => ({homeworkId: '3', title: 'အိမ်စာ ၃', files: [new File(['photo'], 'photo.jpg', {type: 'image/jpeg'})], retainedImageIds: [10], pageCount: 2});
const completed = () => ({status: 'SUBMITTED', submission: {submittedAt: new Date().toISOString(), images: [{id: 11}]}});
const tick = () => new Promise(resolve => setImmediate(resolve));

test('Back navigation and page unsubscribe keep the upload alive through processing and success', async () => {
  const {store, xhrs, responses} = environment();
  const leaveCreatePage = store.subscribeHomeworkUploads(() => {});
  store.startHomeworkUpload(input());
  leaveCreatePage();
  store.syncHomeworkUploadAccount(); // The persistent root layout observes a route change.
  xhrs[0].upload.onprogress({lengthComputable: true, loaded: 50, total: 100});
  assert.equal(store.getHomeworkUploads()[0].progress, 50);
  assert.equal(xhrs[0].aborted, false);
  const leaveHomepage = store.subscribeHomeworkUploads(() => {});
  xhrs[0].complete(201, {status: 'PROCESSING'});
  await tick();
  assert.equal(store.getHomeworkUploads()[0].status, 'processing');
  leaveHomepage();
  responses.push(completed());
  await store.checkHomeworkUpload('3');
  assert.equal(store.getHomeworkUploads()[0].status, 'success');
  assert.equal(xhrs[0].aborted, false);
  assert.equal(xhrs[0].body.getAll('images').length, 1);
  assert.equal(xhrs[0].body.get('retainedImageIds'), '[10]');
});

test('revisiting a page and double-clicking cannot start a second upload for the same homework', () => {
  const {store, xhrs} = environment();
  const original = store.startHomeworkUpload(input());
  assert.equal(store.startHomeworkUpload(input()).attemptId, original.attemptId);
  store.trackHomeworkUpload('3');
  assert.equal(xhrs.length, 1);
  assert.equal(xhrs[0].aborted, false);
});

test('the server accepting files does not count as successfully saved images', async () => {
  const {store, xhrs} = environment();
  store.startHomeworkUpload(input());
  xhrs[0].upload.onload();
  assert.equal(store.getHomeworkUploads()[0].status, 'uploading');
  xhrs[0].complete(201, {status: 'PROCESSING'});
  await tick();
  assert.equal(store.getHomeworkUploads()[0].status, 'processing');
});

test('processing failures remain visible after the initiating page has unmounted', async () => {
  const {store, xhrs, responses} = environment();
  const unsubscribe = store.subscribeHomeworkUploads(() => {});
  store.startHomeworkUpload(input());
  unsubscribe();
  responses.push({status: 'NOT_SUBMITTED', submission: {processingError: 'PDF cannot be read'}});
  xhrs[0].complete(201, {status: 'PROCESSING'});
  await tick();
  assert.equal(store.getHomeworkUploads()[0].status, 'error');
  assert.equal(store.getHomeworkUploads()[0].error, 'PDF cannot be read');
});

test('network failures and server validation errors survive navigation', () => {
  const {store, xhrs} = environment();
  store.startHomeworkUpload(input());
  xhrs[0].onerror();
  assert.equal(store.getHomeworkUploads()[0].status, 'error');
  store.startHomeworkUpload(input());
  xhrs[1].complete(400, {message: 'Maximum 30 pages'});
  assert.equal(store.getHomeworkUploads()[0].error, 'Maximum 30 pages');
});

test('temporary polling failures retry without losing the server job', async () => {
  const {store, xhrs, responses} = environment();
  store.startHomeworkUpload(input());
  responses.push(new Error('offline'));
  xhrs[0].complete(201, {status: 'PROCESSING'});
  await tick();
  assert.equal(store.getHomeworkUploads()[0].status, 'processing');
  assert.ok(store.getHomeworkUploads()[0].note);
  responses.push(completed());
  await store.checkHomeworkUpload('3');
  assert.equal(store.getHomeworkUploads()[0].status, 'success');
});

test('a restored transfer checks the server instead of waiting forever on a missing browser request', async () => {
  const original = environment();
  original.store.startHomeworkUpload(input());
  const restored = environment(original.session);
  restored.store.syncHomeworkUploadAccount();
  assert.equal(restored.store.getHomeworkUploads()[0].status, 'processing');
  restored.responses.push(completed());
  await restored.store.checkHomeworkUpload('3');
  assert.equal(restored.store.getHomeworkUploads()[0].status, 'success');
});

test('restoring an interrupted update never mistakes the previous submission for the new upload', async () => {
  const original = environment();
  original.store.startHomeworkUpload(input());
  const restored = environment(original.session);
  restored.store.syncHomeworkUploadAccount();
  restored.responses.push({status: 'SUBMITTED', submission: {submittedAt: '2020-01-01T00:00:00Z', images: [{id: 1}]}});
  await restored.store.checkHomeworkUpload('3');
  assert.equal(restored.store.getHomeworkUploads()[0].status, 'error');
});

test('a late response from an older attempt cannot overwrite a retry', () => {
  const {store, xhrs} = environment();
  store.startHomeworkUpload(input());
  xhrs[0].onerror();
  const retry = store.startHomeworkUpload(input());
  xhrs[0].complete(400, {message: 'old error'});
  assert.equal(store.getHomeworkUploads()[0].attemptId, retry.attemptId);
  assert.equal(store.getHomeworkUploads()[0].status, 'uploading');
});

test('switching accounts clears personal upload state and ignores the old request callbacks', () => {
  const {store, xhrs, local} = environment();
  store.startHomeworkUpload(input());
  local.set('student', JSON.stringify({id: 2}));
  local.set('studentAccessToken', 'other-token');
  store.syncHomeworkUploadAccount();
  assert.equal(xhrs[0].aborted, true);
  assert.equal(store.getHomeworkUploads().length, 0);
  xhrs[0].complete(201, {status: 'PROCESSING'});
  assert.equal(store.getHomeworkUploads().length, 0);
});


test('a confirmed server upload tolerates a client clock that is ahead of the server', async () => {
  const {store, xhrs, responses} = environment();
  store.startHomeworkUpload(input());
  responses.push({status: 'SUBMITTED', submission: {submittedAt: '2020-01-01T00:00:00Z', images: [{id: 1}]}});
  xhrs[0].complete(201, {status: 'PROCESSING'});
  await tick();
  assert.equal(store.getHomeworkUploads()[0].status, 'success');
});


test('scheduled server retries stay in processing and show an explanation', async () => {
  const {store, xhrs, responses} = environment();
  store.startHomeworkUpload(input());
  responses.push({status: 'PROCESSING', submission: {processingJob: {status: 'QUEUED', attempts: 1}}});
  xhrs[0].complete(201, {status: 'PROCESSING'});
  await tick();
  assert.equal(store.getHomeworkUploads()[0].status, 'processing');
  assert.ok(store.getHomeworkUploads()[0].note.includes('1'));
});

test('an older saved submission cannot mark an active retry as complete', async () => {
  const {store, xhrs, responses} = environment();
  store.startHomeworkUpload(input());
  responses.push({status: 'SUBMITTED', submission: {images: [{id: 1}], processingJob: {status: 'QUEUED', attempts: 2}}});
  xhrs[0].complete(201, {status: 'PROCESSING'});
  await tick();
  assert.equal(store.getHomeworkUploads()[0].status, 'processing');
});
