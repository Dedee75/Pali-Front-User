export type HomeworkUpload = {
  homeworkId: string;
  attemptId: string;
  title: string;
  status: 'uploading' | 'processing' | 'success' | 'error';
  progress: number;
  pageCount: number;
  startedAt: number;
  recovering?: boolean;
  error?: string;
  note?: string;
};

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const STORAGE_KEY = 'homeworkUploads:v1';
const EMPTY: readonly HomeworkUpload[] = [];
let snapshot: readonly HomeworkUpload[] = EMPTY;
let owner: string | null = null;
let attemptSequence = 0;
const listeners = new Set<() => void>();
const requests = new Map<string, XMLHttpRequest>();
const checking = new Set<string>();

function account(): string | null {
  if (!localStorage.getItem('studentAccessToken')) return null;
  try {
    const student = JSON.parse(localStorage.getItem('student') ?? 'null');
    return student?.id == null ? null : String(student.id);
  } catch { return null; }
}

function publish(statusChanged = true) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify({owner, uploads: snapshot})); } catch { /* Uploads keep running when browser storage is unavailable. */ }
  for (const listener of listeners) listener();
  if (statusChanged) window.dispatchEvent(new CustomEvent('homework-upload-state'));
}

export function syncHomeworkUploadAccount() {
  const nextOwner = account();
  if (owner === nextOwner) return;
  // Clear the previous account before aborting, so old callbacks cannot update a new session.
  owner = nextOwner;
  snapshot = EMPTY;
  for (const request of requests.values()) request.abort();
  requests.clear();
  checking.clear();
  if (owner) {
    try {
      const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
      if (stored?.owner === owner && Array.isArray(stored.uploads)) {
        snapshot = stored.uploads.filter((job: HomeworkUpload) => /^\d+$/.test(job.homeworkId) && typeof job.attemptId === 'string')
          .map((job: HomeworkUpload) => job.status === 'uploading'
            ? {...job, status: 'processing', recovering: true, note: 'ယခင်တင်ထားသော ဖိုင်များ၏ အခြေအနေကို ပြန်စစ်နေပါသည်။'}
            : job);
      }
    } catch { snapshot = EMPTY; }
  }
  publish();
}

export const subscribeHomeworkUploads = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
export const getHomeworkUploads = () => snapshot;
export const getServerHomeworkUploads = () => EMPTY;
export const isActiveUpload = (job: HomeworkUpload) => job.status === 'uploading' || job.status === 'processing';

function current(homeworkId: string, attemptId: string) {
  return owner === account() ? snapshot.find(job => job.homeworkId === homeworkId && job.attemptId === attemptId) : undefined;
}

function update(homeworkId: string, attemptId: string, change: Partial<HomeworkUpload>) {
  const existing = current(homeworkId, attemptId);
  if (!existing) return;
  snapshot = snapshot.map(job => job === existing ? {...job, ...change} : job);
  publish(change.status !== undefined && change.status !== existing.status);
}

function errorMessage(result: unknown) {
  const message = result && typeof result === 'object' && 'message' in result ? result.message : undefined;
  if (Array.isArray(message)) return message.join(', ');
  return typeof message === 'string' ? message : 'အိမ်စာတင်မရပါ။ ဖိုင်များ ပြန်ရွေးပြီး တင်ပေးပါ။';
}

export function startHomeworkUpload(input: {homeworkId: string; title: string; files: File[]; retainedImageIds: number[]; pageCount: number}) {
  syncHomeworkUploadAccount();
  const token = localStorage.getItem('studentAccessToken');
  if (!owner || !token) throw new Error('ပြန်လည် Login ဝင်ပေးပါ။');
  if (!/^\d+$/.test(input.homeworkId)) throw new Error('Invalid homework ID');
  const active = snapshot.find(job => job.homeworkId === input.homeworkId && isActiveUpload(job));
  if (active) return active;

  const body = new FormData();
  body.append('retainedImageIds', JSON.stringify(input.retainedImageIds));
  for (const file of input.files) body.append('images', file);
  const job: HomeworkUpload = {
    homeworkId: input.homeworkId, attemptId: `${Date.now()}-${++attemptSequence}`,
    title: input.title, status: 'uploading', progress: 0, pageCount: input.pageCount, startedAt: Date.now(),
  };
  const request = new XMLHttpRequest();
  snapshot = [...snapshot.filter(item => item.homeworkId !== job.homeworkId), job];
  requests.set(job.homeworkId, request);
  const fail = (message: string) => {
    if (requests.get(job.homeworkId) === request) requests.delete(job.homeworkId);
    update(job.homeworkId, job.attemptId, {status: 'error', error: message, note: undefined});
  };
  request.upload.onprogress = event => {
    if (event.lengthComputable) update(job.homeworkId, job.attemptId, {progress: Math.min(99, Math.round(event.loaded / event.total * 100))});
  };
  request.upload.onload = () => update(job.homeworkId, job.attemptId, {progress: 100, note: 'ဖိုင်များ ပို့ပြီး၊ server လက်ခံမှုကို စောင့်နေပါသည်။'});
  request.onload = () => {
    if (!current(job.homeworkId, job.attemptId)) return;
    requests.delete(job.homeworkId);
    let result: unknown;
    try { result = JSON.parse(request.responseText); } catch { fail('Server အဖြေကို ဖတ်မရပါ။ အိမ်စာအခြေအနေကို ပြန်စစ်ပေးပါ။'); return; }
    if (request.status < 200 || request.status >= 300) {
      fail(request.status === 401 ? 'Login သက်တမ်းကုန်နေပါသည်။ ပြန်လည် Login ဝင်ပေးပါ။' : errorMessage(result));
      return;
    }
    update(job.homeworkId, job.attemptId, {status: 'processing', progress: 100, note: undefined});
    void checkHomeworkUpload(job.homeworkId);
  };
  request.onerror = () => fail('ချိတ်ဆက်မှု ပြတ်သွားသဖြင့် ဖိုင်တင်မှု မအောင်မြင်ပါ။ အိမ်စာအခြေအနေကို စစ်ပြီး ပြန်တင်ပေးပါ။');
  request.ontimeout = () => fail('ဖိုင်တင်ရန် အချိန်ကြာသွားပါသည်။ ချိတ်ဆက်မှုကို စစ်ပြီး ပြန်တင်ပေးပါ။');
  request.onabort = () => fail('ဖိုင်တင်မှု ရပ်သွားပါသည်။ ဖိုင်များ ပြန်ရွေးပြီး တင်ပေးပါ။');
  publish();
  try {
    request.open('POST', `${API_URL}/student-homeworks/${job.homeworkId}/submit`);
    request.setRequestHeader('Authorization', `Bearer ${token.trim()}`);
    request.send(body);
  } catch { fail('ဖိုင်တင်မရပါ။ ချိတ်ဆက်မှုကို စစ်ပြီး ပြန်တင်ပေးပါ။'); }
  return job;
}

export function trackHomeworkUpload(homeworkId: string) {
  syncHomeworkUploadAccount();
  if (!owner || !/^\d+$/.test(homeworkId) || snapshot.some(job => job.homeworkId === homeworkId)) return;
  snapshot = [...snapshot, {homeworkId, attemptId: `restore-${++attemptSequence}`, title: `အိမ်စာ #${homeworkId}`, status: 'processing', progress: 100, pageCount: 0, startedAt: 0}];
  publish();
  void checkHomeworkUpload(homeworkId);
}

export async function checkHomeworkUpload(homeworkId: string) {
  const job = snapshot.find(item => item.homeworkId === homeworkId);
  if (!job || job.status !== 'processing' || checking.has(job.attemptId)) return;
  const token = localStorage.getItem('studentAccessToken');
  if (!token || !current(homeworkId, job.attemptId)) return;
  checking.add(job.attemptId);
  try {
    const response = await fetch(`${API_URL}/student-homeworks/${homeworkId}`, {headers: {Authorization: `Bearer ${token.trim()}`}, cache: 'no-store'});
    if (response.status === 401) {
      update(homeworkId, job.attemptId, {status: 'error', error: 'Login သက်တမ်းကုန်နေပါသည်။ ပြန်လည် Login ဝင်ပေးပါ။'});
      return;
    }
    if (!response.ok) throw new Error('Status request failed');
    const detail = await response.json();
    if (!current(homeworkId, job.attemptId)) return;
    const processing = detail.submission?.processingJob;
    if (detail.status === 'PROCESSING' || ['QUEUED', 'PROCESSING'].includes(processing?.status)) {
      const note = processing?.status === 'QUEUED' && processing.attempts > 0
        ? `ယာယီပြတ်တောက်မှုကြောင့် ပြန်ကြိုးစားရန် စောင့်နေပါသည်။ ပြီးခဲ့သောကြိုးစားမှု ${processing.attempts} ကြိမ်။` : undefined;
      update(homeworkId, job.attemptId, {recovering: false, note});
    } else if (detail.submission?.processingError) {
      update(homeworkId, job.attemptId, {status: 'error', error: detail.submission.processingError, note: undefined});
    } else if (['SUBMITTED', 'REVIEWED'].includes(detail.status) && detail.submission?.images?.length > 0 &&
      (!job.recovering || !job.startedAt || new Date(detail.submission.submittedAt).getTime() >= job.startedAt - 1000)) {
      update(homeworkId, job.attemptId, {status: 'success', note: undefined});
    } else {
      update(homeworkId, job.attemptId, {status: 'error', error: 'ဖိုင်အသစ်များ သိမ်းဆည်းပြီးကြောင်း အတည်မပြုနိုင်ပါ။ အိမ်စာအခြေအနေကို စစ်ပြီး ဖိုင်များ ပြန်ရွေးပေးပါ။', note: undefined});
    }
  } catch {
    update(homeworkId, job.attemptId, {note: 'ချိတ်ဆက်မှုကြောင့် အခြေအနေ စစ်မရသေးပါ။ အလိုအလျောက် ပြန်စစ်နေပါသည်။'});
  } finally { checking.delete(job.attemptId); }
}

export function checkProcessingHomeworkUploads() {
  syncHomeworkUploadAccount();
  for (const job of snapshot) if (job.status === 'processing') void checkHomeworkUpload(job.homeworkId);
}

export function dismissHomeworkUpload(homeworkId: string) {
  snapshot = snapshot.filter(job => job.homeworkId !== homeworkId || isActiveUpload(job));
  publish(false);
}
