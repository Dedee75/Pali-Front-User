'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { checkProcessingHomeworkUploads, dismissHomeworkUpload, syncHomeworkUploadAccount } from '../lib/homework-uploads';
import { useHomeworkUploads } from '../lib/use-homework-uploads';
import styles from './homework-upload-activity.module.css';

export default function HomeworkUploadActivity() {
  const pathname = usePathname();
  const uploads = useHomeworkUploads();
  const sending = uploads.some(job => job.status === 'uploading');

  useEffect(() => {
    syncHomeworkUploadAccount();
    checkProcessingHomeworkUploads();
    const timer = window.setInterval(checkProcessingHomeworkUploads, 2000);
    const refresh = () => checkProcessingHomeworkUploads();
    window.addEventListener('focus', refresh);
    return () => {window.clearInterval(timer); window.removeEventListener('focus', refresh);};
    // Page navigation never aborts a transport. The app-level store owns it.
  }, []);

  useEffect(() => {syncHomeworkUploadAccount();}, [pathname]);

  useEffect(() => {
    if (!sending) return;
    const protectUpload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    // Internal Back/Link navigation keeps the document alive. A full refresh or
    // tab close cannot keep an in-memory upload alive, so warn only then.
    window.addEventListener('beforeunload', protectUpload);
    return () => window.removeEventListener('beforeunload', protectUpload);
  }, [sending]);

  if (!uploads.length || pathname === '/upload-loading' || pathname === '/' || pathname === '/register') return null;
  return <aside className={styles.tray} aria-label='အိမ်စာတင်မှု အခြေအနေ'>
    {uploads.map(job => <section key={job.attemptId} className={styles.item}>
      <strong>{job.title}</strong>
      <p role={job.status === 'error' ? 'alert' : 'status'}>
        {job.status === 'uploading' ? `ဖိုင်များ ပို့နေသည် — ${job.progress}%` :
          job.status === 'processing' ? 'ဖိုင်လက်ခံပြီး၊ စာမျက်နှာများ ပြင်ဆင်သိမ်းဆည်းနေပါသည်။' :
          job.status === 'success' ? 'အိမ်စာ သိမ်းဆည်းပြီးပါပြီ။' : job.error}
      </p>
      {job.status === 'uploading' && <progress max={100} value={job.progress} aria-label='ဖိုင်ပို့ပြီးစီးမှု' />}
      {job.note && <small>{job.note}</small>}
      <div className={styles.actions}>
        <Link href={job.status === 'success' ? `/homework-submitted?homeworkId=${job.homeworkId}` :
          job.status === 'error' ? `/homework-create?${new URLSearchParams({homeworkId: job.homeworkId, mode: 'upload', uploadError: job.error ?? ''})}` :
          `/upload-loading?homeworkId=${job.homeworkId}`}>
          {job.status === 'error' ? 'ဖိုင်ပြန်ရွေးမည်' : job.status === 'success' ? 'အိမ်စာကြည့်ရန်' : 'အခြေအနေကြည့်ရန်'}
        </Link>
        {['error', 'success'].includes(job.status) && <button type='button' onClick={() => dismissHomeworkUpload(job.homeworkId)}>ပိတ်မည်</button>}
      </div>
    </section>)}
  </aside>;
}
