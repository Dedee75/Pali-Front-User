/** @format */

'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { confirmAction } from '../../lib/dialog';
import styles from './homework-create.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

const MIN_IMAGES = 1;
const MAX_IMAGES = 20;
const MAX_FILE_SIZE = 15 * 1024 * 1024;

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
 canEdit?: boolean;
 submission?: {images: {id:number; image:string}[] } | null;
	attachment?: string | null;
	attachmentName?: string | null;
	id: number;
	title: string;
	description: string;
	dueDate: string;
	status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'REVIEWED';
	batch: {
		id: number;
		name: string;
	};
};

type UploadRouteState = {
	status: 'uploading' | 'success' | 'error';
	imageCount: number;
	error?: string;
	startedAt: number;
	finishedAt?: number;
};

function saveUploadRouteState(homeworkId: string, state: UploadRouteState) {
	sessionStorage.setItem(`homeworkUpload:${homeworkId}`, JSON.stringify(state));

	window.dispatchEvent(
		new CustomEvent('homework-upload-state', {
			detail: {
				homeworkId,
			},
		}),
	);
}

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
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState('');

	const remainingSlots = useMemo(() => MAX_IMAGES - images.length, [images.length]);

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

				if (result.status === 'REVIEWED' || result.canEdit === false) {
					router.replace(`/homework-submitted?homeworkId=${homeworkId}`);
					return;
				}

				setHomework(result as HomeworkDetail);
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
	}, [homeworkId, router]);

	useEffect(() => {
		return () => {
			for (const image of imageRefs.current) {
				URL.revokeObjectURL(image.previewUrl);
			}
		};
	}, []);

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

			if (file.size > MAX_FILE_SIZE) {
				setError(`${file.name} is larger than 15 MB.`);
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
			setError(`Only ${remainingSlots} more file(s) can be added. Maximum is ${MAX_IMAGES}.`);
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

	const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (uploading || !homeworkId) {
			return;
		}

		if (images.length < MIN_IMAGES) {
			setError(`Please select at least ${MIN_IMAGES} image or PDF file.`);
			return;
		}

		if (images.length > MAX_IMAGES) {
			setError(`You can upload a maximum of ${MAX_IMAGES} images.`);
			return;
		}

		const token = localStorage.getItem('studentAccessToken');

		if (!token) {
			router.replace('/');
			return;
		}

		setUploading(true);
		setError('');

		const startedAt = Date.now();

		saveUploadRouteState(homeworkId, {
			status: 'uploading',
			imageCount: images.length,
			startedAt,
		});

		router.push(`/upload-loading?homeworkId=${homeworkId}`);

		try {
			const formData = new FormData();
            formData.append('retainedImageIds', JSON.stringify(images.filter(image => image.existingId !== undefined).map(image => image.existingId)));

			for (const image of images) {
				if (image.file) formData.append('images', image.file);
			}

			const response = await fetch(`${API_URL}/student-homeworks/${homeworkId}/submit`, {
				method: 'POST',

				headers: {
					Authorization: `Bearer ${token.trim()}`,
				},

				body: formData,
			});

			const result = await response.json().catch(() => null);

			if (response.status === 401) {
				sessionStorage.removeItem(`homeworkUpload:${homeworkId}`);

				localStorage.removeItem('studentAccessToken');

				localStorage.removeItem('student');

				router.replace('/');
				return;
			}

			if (!response.ok) {
				throw new Error(getErrorMessage(result));
			}

			saveUploadRouteState(homeworkId, {
				status: 'success',
				imageCount: images.length,
				startedAt,
				finishedAt: Date.now(),
			});
		} catch (uploadError) {
			const message = uploadError instanceof Error ? uploadError.message : 'Homework upload failed.';

			saveUploadRouteState(homeworkId, {
				status: 'error',
				imageCount: images.length,
				error: message,
				startedAt,
				finishedAt: Date.now(),
			});

			setError(message);
		} finally {
			setUploading(false);
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
						{error && <div className={styles.errorBox}>{error}</div>}

						{/* Homework Information */}

						<div className={styles.homeworkSection}>
							<div className={styles.homeworkTitle}>
								<span>Homework</span>

								<strong>- {homework?.title ?? '-'}</strong>
							</div>

							{homework?.attachment && (
								<a
									className={styles.attachmentLink}
									href={`${API_URL.replace(/\/$/, '')}${homework.attachment}`}
									target='_blank'
									rel='noopener noreferrer'>
									<span aria-hidden='true'>📎</span> အိမ်စာကြည့်ရန်
								</a>
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
								Homework Images / PDF ({MIN_IMAGES} - {MAX_IMAGES})
							</label>

							{/* Choose File */}

							<div className={styles.fileInputWrapper}>
								<input
									type='file'
									accept='image/jpeg,image/png,image/webp,application/pdf,.pdf'
									multiple
									onChange={handleFileChange}
									className={styles.fileInput}
									disabled={uploading || images.length >= MAX_IMAGES}
								/>
							</div>

							<p className={styles.fileHelp}>
								Selected: {images.length} / {MAX_IMAGES}. Each file must be 15 MB or smaller. PDF pages are
								converted to images; maximum 20 pages in total.
							</p>
						</div>

						{images.length > 0 && (
							<div className={styles.previewGrid}>
								{images.map((image, index) => (
									<div key={image.id} className={styles.previewWrapper}>
										{image.file?.type === 'application/pdf' ?
											<div className={styles.pdfPreview}>
												<strong>PDF</strong>

												<span>{image.file.name}</span>

												<small>Pages will appear as images after upload.</small>
											</div>
										:	<img
												src={image.previewUrl}
												alt={`Homework page ${index + 1}`}
												className={styles.previewImg}
											/>
										}

										<span className={styles.previewNumber}>{index + 1}</span>

										<button
											type='button'
											className={styles.deleteBtn}
											onClick={() => handleRemoveImage(image.id)}
											disabled={uploading}
											aria-label={`Remove image ${index + 1}`}>
											<svg
												width='14'
												height='14'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='3'
												strokeLinecap='round'
												strokeLinejoin='round'>
												<line x1='18' y1='6' x2='6' y2='18' />

												<line x1='6' y1='6' x2='18' y2='18' />
											</svg>
										</button>
									</div>
								))}
							</div>
						)}

						<button type='submit' className={styles.btnUpload} disabled={uploading || images.length < MIN_IMAGES}>
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
