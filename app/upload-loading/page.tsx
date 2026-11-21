'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trackHomeworkUpload } from '../../lib/homework-uploads';
import { useHomeworkUploads } from '../../lib/use-homework-uploads';
import styles from './upload-loading.module.css';

function UploadLoadingContent() {
  const router = useRouter();
  const homeworkId = useSearchParams().get('homeworkId');
  const uploads = useHomeworkUploads();
  const job = uploads.find(item => item.homeworkId === homeworkId);

  useEffect(() => {
    if (!localStorage.getItem('studentAccessToken')) {router.replace('/'); return;}
    if (!homeworkId || !/^\d+$/.test(homeworkId)) {router.replace('/homepage'); return;}
    trackHomeworkUpload(homeworkId);
  }, [homeworkId, router]);

  useEffect(() => {
    if (job?.status === 'success') router.replace(`/upload-success?homeworkId=${homeworkId}`);
  }, [job?.status, homeworkId, router]);

  const message = job?.status === 'error' ? job.error : job?.status === 'uploading'
    ? `ဖိုင်များ ပို့နေသည် — ${job.progress}%` : 'ဖိုင်လက်ခံပြီး၊ PDF နှင့် ပုံများကို ပြင်ဆင်သိမ်းဆည်းနေပါသည်။';
  return <div className={styles.container}><div className={styles.mobileFrame}>
    <div className={styles.centerContent} style={{padding: 24}}>
      {job?.status !== 'error' && <div className={styles.spinner} aria-hidden='true'>
        <svg viewBox='0 0 100 100'><circle cx='50' cy='50' r='36' fill='none' stroke='#b8860b' strokeWidth='6' strokeDasharray='150 80' /></svg>
      </div>}
      <p className={styles.loadingText} role={job?.status === 'error' ? 'alert' : 'status'}>{message}</p>
      {job?.status === 'uploading' && <progress max={100} value={job.progress} aria-label='ဖိုင်ပို့ပြီးစီးမှု' />}
      {job?.note && <p className={styles.loadingText}>{job.note}</p>}
      {job?.status !== 'error' && <p className={styles.loadingText}>ပင်မစာမျက်နှာသို့ ပြန်သွားနိုင်ပါသည်။ နောက်ကွယ်တွင် ဆက်လုပ်ပေးနေပါမည်။</p>}
      {job?.status === 'error' && <button type='button' className={styles.actionButton} onClick={() => router.replace(`/homework-create?${new URLSearchParams({homeworkId: homeworkId!, mode: 'upload', uploadError: job.error ?? ''})}`)}>ဖိုင်ပြန်ရွေးပြီး တင်မည်</button>}
      <button type='button' className={styles.actionButton} onClick={() => router.push('/homepage')}>ပင်မစာမျက်နှာသို့</button>
    </div>
  </div></div>;
}

export default function UploadLoadingPage() {
  return <Suspense fallback={<p>အခြေအနေ စစ်ဆေးနေသည်…</p>}><UploadLoadingContent /></Suspense>;
}
