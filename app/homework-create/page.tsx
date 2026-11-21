/** @format */

'use client';

import { PrivateImage, PrivateFileLink } from '@/lib/private-files';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmAction } from '../../lib/dialog';
import styles from './homework-create.module.css';
import { isActiveUpload, startHomeworkUpload } from '../../lib/homework-uploads';
import { useHomeworkUploads } from '../../lib/use-homework-uploads';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const MIN_IMAGES = 1;
const MAX_IMAGES = 30;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type StudentProfile = {
	id: number;
	studentCode: string;
	name: string;
	batchId: number;
};

type SelectedImage = {
	id: string;
	file?: File;
	existingId?: number;
	previewUrl: string;
};

type HomeworkDetail = {
 uploadLimits?: {maxPages: number; maxFiles: number; maxFileBytes: number};
 canEdit?: boolean;
 submission?: {processingError?: string | null; images: {id:number; image:string}[] } | null;
	attachment?: string | null;
	attachmentName?: string | null;
	id: number;
	title: string;
	description: string;
	dueDate: string;
	status: 'NOT_SUBMITTED' | 'PROCESSING' | 'SUBMITTED' | 'REVIEWED';
	batch: {
		id: number;
		name: string;
	};
};

function getErrorMessage(result: unknown): string {
	if (result && typeof result === 'object' && 'message' in result) {
		const message = (
			result as {
				message?: unknown;
			}
		).message;

		if (Array.isArray(message)) {
			return message.join(', ');
		}

		if (typeof message === 'string') {
			return message;
		}
	}

	return 'Homework upload failed.';
}

function HomeworkCreateContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const homeworkId = searchParams.get('homeworkId');
	const isReupload = searchParams.get('mode') === 'upload';

	const [student, setStudent] = useState<StudentProfile | null>(null);
	const [homework, setHomework] = useState<HomeworkDetail | null>(null);
	const [images, setImages] = useState<SelectedImage[]>([]);
 const imageRefs = useRef<SelectedImage[]>([]);
 useEffect(() => { imageRefs.current = images; }, [images]);
	const [loading, setLoading] = useState(true);
	const uploads = useHomeworkUploads();
 const uploading = uploads.some(job => job.homeworkId === homeworkId && isActiveUpload(job));
	const [error, setError] = useState('');
 const [inspection, setInspection] = useState<{key: string; pageCount?: number; error?: string}>({key: ''});
 const maxPages = homework?.uploadLimits?.maxPages ?? MAX_IMAGES;
 const maxFiles = homework?.uploadLimits?.maxFiles ?? MAX_IMAGES;
 const maxFileBytes = homework?.uploadLimits?.maxFileBytes ?? MAX_FILE_SIZE;
 const selectionKey = images.map(image => image.id).join('|');
 const checkingPages = images.length > 0 && inspection.key !== selectionKey;
 const pageError = inspection.key === selectionKey ? inspection.error : undefined;

 useEffect(() => {
  if (uploading && homeworkId) router.replace(`/upload-loading?homeworkId=${homeworkId}`);
 }, [uploading, homeworkId, router]);

	const remainingSlots = useMemo(() => maxFiles - images.length, [images.length, maxFiles]);

	useEffect(() => {
		const token = localStorage.getItem('studentAccessToken');
		const storedStudent = localStorage.getItem('student');

		if (!token || !storedStudent) {
			router.replace('/');
			return;
		}

		if (!homeworkId || !/^\d+$/.test(homeworkId)) {
			setError('Invalid homework ID.');
			setLoading(false);
			return;
		}

		try {
			setStudent(JSON.parse(storedStudent) as StudentProfile);
		} catch {
			localStorage.removeItem('studentAccessToken');
			localStorage.removeItem('student');
			router.replace('/');
			return;
		}

		const loadHomework = async () => {
			try {
				const response = await fetch(`${API_URL}/student-homeworks/${homeworkId}`, {
					headers: {
						Accept: 'application/json',
						Authorization: `Bearer ${token.trim()}`,
					},
					cache: 'no-store',
				});

				const result = await response.json().catch(() => null);

				if (response.status === 401) {
					localStorage.removeItem('studentAccessToken');
					localStorage.removeItem('student');
					router.replace('/');
					return;
				}

				if (!response.ok) {
					throw new Error(getErrorMessage(result));
				}

				if (result.status === 'PROCESSING') {
					router.replace(`/upload-loading?homeworkId=${homeworkId}`);
					return;
				}

				if (result.status === 'REVIEWED' || result.canEdit === false) {
					router.replace(`/homework-submitted?homeworkId=${homeworkId}`);
					return;
				}

				setHomework(result as HomeworkDetail);
                setError(searchParams.get('uploadError') || result.submission?.processingError || '');
                const removed = new URLSearchParams(window.location.search).get('removedImageIds')?.split(',').map(Number) ?? [];
                setImages((result.submission?.images ?? []).filter((image: {id:number}) => !removed.includes(image.id)).map((image: {id:number; image:string}) => ({
                    id: `existing-${image.id}`, existingId: image.id,
                    previewUrl: /^https?:/.test(image.image) ? image.image : `${API_URL.replace(/\/$/, '')}/${image.image.replace(/^\//, '')}`,
                })));
			} catch (requestError) {
				setError(requestError instanceof Error ? requestError.message : 'Failed to load homework.');
			} finally {
				setLoading(false);
			}
		};

		void loadHomework();
	}, [homeworkId, router, searchParams]);

	useEffect(() => {
		return () => {
			for (const image of imageRefs.current) {
				URL.revokeObjectURL(image.previewUrl);
			}
		};
	}, []);

 useEffect(() => {
  if (loading || !homeworkId || !images.length) return;
  const controller = new AbortController();
  const timer = window.setTimeout(async () => {
   try {
    const pdfs = images.filter(image => image.file?.type === 'application/pdf');
    let pageCount = images.length;
    if (pdfs.length) {
     const body = new FormData();
     body.append('imageCount', String(images.length - pdfs.length));
     for (const pdf of pdfs) body.append('images', pdf.file!);
     const response = await fetch(`${API_URL}/student-homeworks/${homeworkId}/validate-upload`, {
      method: 'POST', headers: {Authorization: `Bearer ${localStorage.getItem('studentAccessToken') ?? ''}`},
      body, signal: controller.signal,
     });
     const result = await response.json().catch(() => null);
     if (!response.ok) throw new Error(getErrorMessage(result));
     pageCount = result.pageCount;
    }
    if (pageCount > maxPages) throw new Error(`စုစုပေါင်း ${pageCount} မျက်နှာ ဖြစ်နေပါတယ်။ အများဆုံး ${maxPages} မျက်နှာသာ ခွင့်ပြုပါတယ်။ ဖိုင်အချို့ကို ဖယ်ပေးပါ။`);
    if (!controller.signal.aborted) setInspection({key: selectionKey, pageCount});
   } catch (error) {
    if (!controller.signal.aborted) setInspection({key: selectionKey, error: error instanceof Error ? error.message : 'PDF စစ်ဆေးမရပါ။ ဖိုင်ပြန်ရွေးပေးပါ။'});
   }
  }, 400);
  return () => {window.clearTimeout(timer); controller.abort();};
 }, [images, selectionKey, loading, homeworkId, maxPages]);

	const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const selectedFiles = Array.from(event.target.files ?? []);

		event.target.value = '';

		if (selectedFiles.length === 0) {
			return;
		}

		setError('');

		const acceptedFiles: File[] = [];

		for (const file of selectedFiles) {
			if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
				setError('Only JPG, PNG, WebP and PDF files are allowed.');
				continue;
			}

			if (file.size > maxFileBytes) {
				setError(`${file.name} is larger than ${maxFileBytes / (1024 * 1024)} MB.`);
				continue;
			}

			const duplicate =
				images.some(
					(image) =>
						image.file?.name === file.name &&
						image.file.size === file.size &&
						image.file.lastModified === file.lastModified,
				) ||
				acceptedFiles.some(
					(accepted) =>
						accepted.name === file.name && accepted.size === file.size && accepted.lastModified === file.lastModified,
				);

			if (!duplicate) {
				acceptedFiles.push(file);
			}
		}

		const allowedFiles = acceptedFiles.slice(0, remainingSlots);

		if (acceptedFiles.length > remainingSlots) {
			setError(`Only ${remainingSlots} more file(s) can be added. Maximum is ${maxFiles}.`);
		}

		const newImages = allowedFiles.map((file) => ({
			id: `${file.name}-${file.size}-${file.lastModified}`,
			file,
			previewUrl: URL.createObjectURL(file),
		}));

		setImages((current) => [...current, ...newImages]);
	};

	const handleRemoveImage = async (imageId: string) => {
		if (!(await confirmAction('delete', 'this selected photo'))) {
			return;
		}

		setImages((current) => {
			const removed = current.find((image) => image.id === imageId);

			if (removed) {
				URL.revokeObjectURL(removed.previewUrl);
			}

			return current.filter((image) => image.id !== imageId);
		});

		setError('');
	};

	const handleUpload = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (uploading || checkingPages || pageError || !homeworkId) {
			return;
		}

		if (images.length < MIN_IMAGES) {
			setError(`Please select at least ${MIN_IMAGES} image or PDF file.`);
			return;
		}

		if (images.length > maxFiles) {
			setError(`You can upload a maximum of ${maxFiles} image or PDF files.`);
			return;
		}

		const token = localStorage.getItem('studentAccessToken');

		if (!token) {
			router.replace('/');
			return;
		}

        setError('');
        try {
            startHomeworkUpload({
                homeworkId,
                title: homework?.title ?? `အိမ်စာ #${homeworkId}`,
                files: images.flatMap(image => image.file ? [image.file] : []),
                retainedImageIds: images.flatMap(image => image.existingId === undefined ? [] : [image.existingId]),
                pageCount: inspection.pageCount ?? images.length,
            });
            router.replace(`/upload-loading?homeworkId=${homeworkId}`);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'ဖိုင်တင်မရပါ။ ပြန်ကြိုးစားပေးပါ။');
        }
	};

	if (loading) {
		return (
			<div className={styles.container}>
				<div className={styles.mobileFrame}>
					<div className={styles.loading}>Loading homework...</div>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<div className={styles.mobileFrame}>
				<div className={styles.userCard}>
					<h1 className={styles.greeting}>မင်္ဂလာပါ, {student?.name ?? 'Student'}</h1>

					<div className={styles.studentMeta}>
						<div className={styles.metaRow}>
							<span className={styles.metaLabel}>Student ID</span>

							<span className={styles.metaValue}>{student?.studentCode ?? '-'}</span>
						</div>

						<div className={styles.metaRow}>
							<span className={styles.metaLabel}>Batch</span>

							<span className={styles.metaValue}>{homework?.batch.name ?? `Batch ${student?.batchId ?? ''}`}</span>
						</div>
					</div>
				</div>

				<div className={styles.formBox}>
					<form onSubmit={handleUpload}>
						{(error || pageError) && <div className={styles.errorBox} role='alert'>{pageError || error}</div>}

						{/* Homework Information */}

						<div className={styles.homeworkSection}>
							<div className={styles.homeworkTitle}>
								<span>Homework</span>

								<strong>- {homework?.title ?? '-'}</strong>
							</div>

							{homework?.attachment && (
								<PrivateFileLink
									className={styles.attachmentLink}
									href={`${API_URL.replace(/\/$/, '')}${homework.attachment}`}
									target='_blank'
									rel='noopener noreferrer'>
									<span aria-hidden='true'>📎</span> အိမ်စာကြည့်ရန်
								</PrivateFileLink>
							)}
						</div>

						{/* Upload Section */}

						<div className={styles.formGroup}>
							{/* Note */}

							<div className={styles.uploadNote}>
								<span className={styles.noteTitle}>Note:</span>

								<span>အိမ်စာကို ပြီးအောင်လုပ်ပြီး ကြည်လင်ပြတ်သားတဲ့ ဓာတ်ပုံများကို တင်ပေးပါ။</span>
							</div>

							<label className={styles.label}>
								Homework Images / PDF ({MIN_IMAGES} - {maxFiles})
							</label>

							{/* Choose File */}

							<div className={styles.fileInputWrapper}>
								<input
									type='file'
									accept='image/jpeg,image/png,image/webp,application/pdf,.pdf'
									multiple
									onChange={handleFileChange}
									className={styles.fileInput}
									disabled={uploading || images.length >= maxFiles}
								/>
							</div>

							<p className={styles.fileHelp}>
								ပုံနှင့် PDF ရောတင်နိုင်ပါသည်။ ဖိုင်တစ်ခုလျှင် {maxFileBytes / (1024 * 1024)} MB အထိ။ ပုံနှင့် PDF စာမျက်နှာ စုစုပေါင်း {maxPages} မျက်နှာအထိ။<br />
                                ရွေးထားသောဖိုင်: {images.length} / {maxFiles} · {checkingPages ? 'PDF စာမျက်နှာများ စစ်ဆေးနေသည်…' : inspection.key === selectionKey && inspection.pageCount !== undefined ? `စုစုပေါင်း ${inspection.pageCount} မျက်နှာ` : 'ဖိုင်များ ရွေးပေးပါ။'}
							</p>
						</div>

                        {['images', 'pdf'].map(group => {
                            const items = images.filter(image => (image.file?.type === 'application/pdf' || (!image.file && /-page-\d+(?:-optimized)?\.(?:png|webp)$/.test(image.previewUrl))) === (group === 'pdf'));
                            if (!items.length) return null;
                            return <section key={group} className={styles.fileGroup}>
                                <h3>{group === 'pdf' ? 'PDF ဖိုင်နှင့် စာမျက်နှာများ' : 'ပုံများ'} ({items.length})</h3>
                                <div className={styles.previewGrid}>
                                    {items.map(image => <div key={image.id} className={styles.previewWrapper}>
                                        {image.file?.type === 'application/pdf' ? <div className={styles.pdfPreview}>
                                            <strong>PDF</strong><span>{image.file.name}</span><small>PDF စာမျက်နှာများကို ပုံအဖြစ် ပြောင်းပေးပါမည်။</small>
                                        </div> : <PrivateImage src={image.previewUrl} alt='ရွေးထားသော အိမ်စာစာမျက်နှာ' className={styles.previewImg} />}
                                        <button type='button' className={styles.deleteBtn} onClick={() => handleRemoveImage(image.id)} disabled={uploading} aria-label='ဖိုင်ဖယ်မည်'>×</button>
                                    </div>)}
                                </div>
                            </section>;
                        })}

						<button type='submit' className={styles.btnUpload} disabled={uploading || checkingPages || Boolean(pageError) || images.length < MIN_IMAGES}>
							<svg
								width='20'
								height='20'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'>
								<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />

								<polyline points='17 8 12 3 7 8' />

								<line x1='12' y1='3' x2='12' y2='15' />
							</svg>

							{uploading ? 'သိမ်းနေသည်...' : homework?.status === 'SUBMITTED' && !isReupload ? 'Update (ပြင်ဆင်မည်)' : 'တင်မည်'}
						</button>

						{/* Back */}

						<button type='button' className={styles.btnBack} onClick={() => router.back()} disabled={uploading}>
							ပြန်ထွက်မည်
						</button>
					</form>
				</div>

				<div className={styles.footer}>O-Technique-Myanmar-2026@</div>
			</div>
		</div>
	);
}

export default function HomeworkCreatePage() {
	return (
		<Suspense
			fallback={
				<div className={styles.container}>
					<div className={styles.mobileFrame}>
						<div className={styles.loading}>Loading homework...</div>
					</div>
				</div>
			}>
			<HomeworkCreateContent />
		</Suspense>
	);
}
