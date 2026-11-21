/** @format */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './upload-success.module.css';

function UploadSuccessContent() {
	const router = useRouter();
 const homeworkId = useSearchParams().get('homeworkId');
 const [verified, setVerified] = useState(false);
 const [error, setError] = useState('');
 useEffect(() => {
  if (!homeworkId || !/^\d+$/.test(homeworkId)) {router.replace('/homepage'); return;}
  const controller = new AbortController();
  const verify = async () => {
   try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'}/student-homeworks/${homeworkId}`, {
     headers: {Authorization: `Bearer ${localStorage.getItem('studentAccessToken') ?? ''}`}, cache: 'no-store', signal: controller.signal,
    });
    if (response.status === 401) {router.replace('/'); return;}
    if (!response.ok) throw new Error('အိမ်စာအခြေအနေ စစ်ဆေးမရပါ။');
    const detail = await response.json();
    if (controller.signal.aborted) return;
    if (['SUBMITTED', 'REVIEWED'].includes(detail.status) && !detail.submission?.processingError && detail.submission?.images?.length > 0) setVerified(true);
    else router.replace(`/upload-loading?homeworkId=${homeworkId}`);
   } catch {if (!controller.signal.aborted) setError('အိမ်စာအခြေအနေ စစ်ဆေးမရပါ။ ပင်မစာမျက်နှာတွင် ပြန်စစ်ပေးပါ။');}
  };
  void verify();
  return () => controller.abort();
 }, [homeworkId, router]);
 if (!verified) return <div className={styles.container}><div className={styles.mobileFrame}>
  <p role={error ? 'alert' : 'status'}>{error || 'စာမျက်နှာများ သိမ်းဆည်းပြီးကြောင်း စစ်ဆေးနေသည်…'}</p>
  <button type='button' className={styles.btnHome} onClick={() => router.replace('/homepage')}>ပင်မစာမျက်နှာသို့</button>
 </div></div>;

	return (
		<div className={styles.container}>
			<div className={styles.mobileFrame}>
				{/* Main Success Content Box */}
				<div className={styles.successBox}>
					<div className={styles.iconCircle}>
						<svg
							width='48'
							height='48'
							viewBox='0 0 24 24'
							fill='none'
							stroke='#2e7d32'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'>
							<path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'></path>
							<polyline points='22 4 12 14.01 9 11.01'></polyline>
						</svg>
					</div>

					<h1 className={styles.title}>အောင်မြင်ပါသည်</h1>
					<p className={styles.subtitle}>အိမ်စာ အောင်မြင်စွာ တင်ပြီးပါပြီ။ (Homework successfully submitted)</p>

					<button type='button' className={styles.btnHome} onClick={() => router.push('/homepage')}>
						<svg
							width='18'
							height='18'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'>
							<path d='M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'></path>
							<polyline points='9 22 9 12 15 12 15 22'></polyline>
						</svg>
						ပင်မစာမျက်နှာသို့ (Home)
					</button>
				</div>

				{/* Footer */}
				<div className={styles.footer}>O-Technique-Myanmar-2026@</div>
			</div>
		</div>
	);
}

export default function UploadSuccessPage() {
 return <Suspense fallback={<p>အခြေအနေ စစ်ဆေးနေသည်…</p>}><UploadSuccessContent /></Suspense>;
}
