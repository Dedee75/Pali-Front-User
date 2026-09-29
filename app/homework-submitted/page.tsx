/** @format */

'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './homework-submitted.module.css';

const API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

type StudentProfile = {
	id: number;
	studentCode: string;
	name: string;
	batchId: number;
};

type SubmissionImage = {
	id: number;
	image: string;
	marks: number | null;
	remark: string | null;
};

type HomeworkDetail = {
 canEdit?: boolean;
	attachment?: string | null;
	attachmentName?: string | null;

	id: number;
	title: string;
	description: string;
	dueDate: string;
	totalMarks: number | null;

	status: 'NOT_SUBMITTED' | 'SUBMITTED' | 'REVIEWED';

	batch: {
		id: number;
		name: string;
	};

	submission: {
		id: number;

		status: 'PENDING' | 'SUBMITTED' | 'REVIEWED';

		submittedAt: string | null;

		totalMarks: number | null;

		remark: string | null;

		images: SubmissionImage[];
	} | null;
};


/* =========================
   HELPERS
   ========================= */

function resolveImageUrl(value: string): string {
	if (
		value.startsWith('http://') ||
		value.startsWith('https://') ||
		value.startsWith('data:') ||
		value.startsWith('blob:')
	) {
		return value;
	}

	return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}


function getErrorMessage(result: unknown): string {
	if (
		result &&
		typeof result === 'object' &&
		'message' in result
	) {
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

	return 'Failed to load submitted homework.';
}


/* =========================
   PAGE CONTENT
   ========================= */

function HomeworkSubmittedContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const homeworkId = searchParams.get('homeworkId');

	const [student, setStudent] =
		useState<StudentProfile | null>(null);

	const [homework, setHomework] =
		useState<HomeworkDetail | null>(null);

	/*
	 * UI images
	 *
	 * ဒီ state က UI မှာ လက်ရှိပြမယ့် images ဖြစ်ပါတယ်။
	 * X နှိပ်ရင် ဒီ array ထဲကနေသာ ယာယီဖယ်ပါမယ်။
	 *
	 * Update editor သို့ ဖယ်ထားသော IDs ပို့ပြီး သိမ်းချိန်တွင် အတည်ပြုသည်။
	 */
	const [displayImages, setDisplayImages] = useState<
		SubmissionImage[]
	>([]);

	const [removedImageIds, setRemovedImageIds] = useState<
		number[]
	>([]);

	const [loading, setLoading] = useState(true);

	const [error, setError] = useState('');


	/* =========================
	   LOAD HOMEWORK
	   ========================= */

	useEffect(() => {
		const token =
			localStorage.getItem('studentAccessToken');

		const storedStudent =
			localStorage.getItem('student');

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
			setStudent(
				JSON.parse(storedStudent) as StudentProfile,
			);
		} catch {
			localStorage.removeItem(
				'studentAccessToken',
			);

			localStorage.removeItem('student');

			router.replace('/');

			return;
		}


		const loadSubmission = async () => {
			try {
				const response = await fetch(
					`${API_URL}/student-homeworks/${homeworkId}`,
					{
						headers: {
							Accept: 'application/json',

							Authorization: `Bearer ${token.trim()}`,
						},

						cache: 'no-store',
					},
				);

				const result = await response
					.json()
					.catch(() => null);


				/* Login expired */

				if (response.status === 401) {
					localStorage.removeItem(
						'studentAccessToken',
					);

					localStorage.removeItem(
						'student',
					);

					router.replace('/');

					return;
				}


				/* API error */

				if (!response.ok) {
					throw new Error(
						getErrorMessage(result),
					);
				}


				const detail =
					result as HomeworkDetail;


				/*
				 * Submission မရှိသေးရင်
				 * homework-create ကို ပြန်ပို့မယ်
				 */

				if (
					!detail.submission ||
					detail.status === 'NOT_SUBMITTED'
				) {
					router.replace(
						`/homework-create?homeworkId=${homeworkId}`,
					);

					return;
				}


				setHomework(detail);

				/*
				 * Server ကနေ ရလာတဲ့ existing images
				 * ကို UI state ထဲထည့်မယ်
				 */

				setDisplayImages(
					detail.submission.images ?? [],
				);

				setRemovedImageIds([]);
			} catch (requestError) {
				setError(
					requestError instanceof Error
						? requestError.message
						: 'Failed to load submitted homework.',
				);
			} finally {
				setLoading(false);
			}
		};


		void loadSubmission();
	}, [homeworkId, router]);


	/* =========================
	   REMOVE IMAGE FROM UI
	   ========================= */

	const handleRemoveImage = (
		image: SubmissionImage,
	) => {
		/*
		 * UI ထဲကနေ image ဖယ်မယ်
		 */

		setDisplayImages((currentImages) =>
			currentImages.filter(
				(item) => item.id !== image.id,
			),
		);


		/*
		 * Update editor သို့ပို့ရန်
		 * ဘယ် image တွေ delete လုပ်မလဲသိဖို့
		 * ID တွေ သိမ်းထားမယ်
		 */

		setRemovedImageIds((currentIds) => {
			if (currentIds.includes(image.id)) {
				return currentIds;
			}

			return [...currentIds, image.id];
		});
	};


	/* =========================
	   UPDATE BUTTON
	   ========================= */

	const handleUpdate = () => {
		if (!homeworkId) {
			return;
		}

		// Carry the draft removals into the editor; save them together with new files.

		router.push(
			`/homework-create?homeworkId=${homeworkId}&mode=update&removedImageIds=${removedImageIds.join(',')}`,
		);
	};


	/* =========================
	   LOADING
	   ========================= */

	if (loading) {
		return (
			<div className={styles.container}>
				<div className={styles.mobileFrame}>
					<div className={styles.loadingState}>
						Loading submitted homework...
					</div>
				</div>
			</div>
		);
	}


	/* =========================
	   DATA
	   ========================= */

	const isReviewed =
		homework?.status === 'REVIEWED';
	const canEdit = Boolean(homework) && !isReviewed && homework?.canEdit !== false;


	/* =========================
	   UI
	   ========================= */

	return (
		<div className={styles.container}>
			<div className={styles.mobileFrame}>

				{/* =====================
				    STUDENT CARD
				===================== */}

				<div className={styles.userCard}>
					<h1 className={styles.greeting}>
						မင်္ဂလာပါ,{' '}
						{student?.name ?? 'Student'}
					</h1>

					<div className={styles.batchInfo}>
						<svg
							width='16'
							height='16'
							viewBox='0 0 24 24'
							fill='none'
							stroke='#b8860b'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
						>
							<path d='M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2' />

							<circle
								cx='9'
								cy='7'
								r='4'
							/>

							<path d='M23 21v-2a4 4 0 0 0-3-3.87' />

							<path d='M16 3.13a4 4 0 0 1 0 7.75' />
						</svg>

						<span>
							{homework?.batch.name ??
								`Batch ${
									student?.batchId ?? ''
								}`}
							{' · '}
							{student?.studentCode ?? ''}
						</span>
					</div>
				</div>


				{/* =====================
				    HOMEWORK TITLE
				===================== */}

				<h2 className={styles.sectionTitle}>
					{homework?.title ??
						'Submitted Homework'}
				</h2>


				{/* =====================
				    ATTACHMENT
				===================== */}

				{homework?.attachment && (
					<div
						className={
							styles.attachmentContainer
						}
					>
						<a
							href={resolveImageUrl(
								homework.attachment,
							)}
							target='_blank'
							rel='noopener noreferrer'
							className={
								styles.attachmentLink
							}
						>
							<span>📎</span>

							<span>
								{homework.attachmentName ||
									'Homework attachment'}
							</span>
						</a>
					</div>
				)}


				{/* =====================
				    ERROR
				===================== */}

				{error && (
					<div className={styles.errorMessage}>
						{error}
					</div>
				)}


				{/* =====================
				    SUBMISSION INFO
				===================== */}

				{homework && (
					<div
						className={
							styles.submissionInfo
						}
					>
						<div
							className={
								styles.infoRow
							}
						>
							<span
								className={
									styles.infoLabel
								}
							>
								Status
							</span>

							<span
								className={
									isReviewed
										? styles.statusReviewed
										: styles.statusSubmitted
								}
							>
								{isReviewed
									? 'Reviewed'
									: 'Submitted'}
							</span>
						</div>


						<div
							className={
								styles.infoRow
							}
						>
							<span
								className={
									styles.infoLabel
								}
							>
								Submitted
							</span>

							<span
								className={
									styles.infoValue
								}
							>
								{homework.submission
									?.submittedAt
									? new Date(
											homework.submission
												.submittedAt,
										).toLocaleString()
									: '-'}
							</span>
						</div>


						{isReviewed && (
							<div
								className={
									styles.teacherComment
								}
							>
								<span
									className={
										styles.infoLabel
									}
								>
									Teacher Comment
								</span>

								<p>
									{homework.submission
										?.remark ??
										'No comment'}
								</p>
							</div>
						)}


						<div
							className={
								styles.infoRow
							}
						>
							<span
								className={
									styles.infoLabel
								}
							>
								Images
							</span>

							<span
								className={
									styles.imageCount
								}
							>
								{displayImages.length}
							</span>
						</div>
					</div>
				)}


				{/* =====================
				    UPDATE INFORMATION
				===================== */}

				{canEdit && (
					<div className={styles.updateNotice}>
						<div
							className={
								styles.updateNoticeIcon
							}
						>
							✎
						</div>

						<div>
							<strong>
								အိမ်စာပြင်ဆင်နိုင်ပါသည်
							</strong>

							<p>
								မလိုအပ်သောပုံကို × နှိပ်၍
								ဖယ်နိုင်ပြီး Update မှ
								ပုံအသစ်များ
								ထပ်ထည့်နိုင်ပါသည်။
							</p>
						</div>
					</div>
				)}


				{/* =====================
				    IMAGE TITLE
				===================== */}

				<div className={styles.imageHeader}>
					<h3>Submitted Images</h3>

					<span>
						{displayImages.length}{' '}
						{displayImages.length === 1
							? 'Page'
							: 'Pages'}
					</span>
				</div>


				{/* =====================
				    IMAGES
				===================== */}

				<div className={styles.imageGrid}>
					{displayImages.map(
						(image, index) => (
							<div
								key={image.id}
								className={
									styles.imageWrapper
								}
							>

								{/* DELETE / CANCEL BUTTON */}

								{canEdit && (
									<button
										type='button'
										className={
											styles.removeImageBtn
										}
										onClick={() =>
											handleRemoveImage(
												image,
											)
										}
										title='Remove image'
										aria-label={`Remove page ${
											index + 1
										}`}
									>
										×
									</button>
								)}


								<img
									src={resolveImageUrl(
										image.image,
									)}
									alt={`Submitted homework page ${
										index + 1
									}`}
									className={
										styles.submittedImg
									}
									loading='lazy'
								/>


								<span
									className={
										styles.pageBadge
									}
								>
									Page {index + 1}
								</span>
							</div>
						),
					)}
				</div>


				{/* =====================
				    EMPTY IMAGE STATE
				===================== */}

				{displayImages.length === 0 &&
					!error && (
						<div
							className={
								styles.emptyImages
							}
						>
							<div
								className={
									styles.emptyIcon
								}
							>
								🖼️
							</div>

							<strong>
								No submitted images
							</strong>

							{canEdit && (
								<p>
									Update ကိုနှိပ်ပြီး
									ပုံအသစ်များ
									ထည့်နိုင်ပါသည်။
								</p>
							)}
						</div>
					)}


				{/* =====================
				    REMOVED IMAGE INFO
				===================== */}

				{canEdit &&
					removedImageIds.length > 0 && (
						<div
							className={
								styles.changeInfo
							}
						>
							<span>!</span>

							<p>
								{
									removedImageIds.length
								}{' '}
								image
								{removedImageIds.length >
								1
									? 's'
									: ''}{' '}
								ရွေးချယ်ဖယ်ရှားထားပါသည်။
								Update လုပ်သည့်အချိန်
								save လုပ်ရန်လိုပါသည်။
							</p>
						</div>
					)}


				{/* =====================
				    BUTTONS
				===================== */}

				<div
					className={
						styles.buttonContainer
					}
				>

					{/* UPDATE */}

					{homework && !canEdit && !isReviewed && <p>ဆရာက စတင်စစ်ဆေးပြီးဖြစ်၍ ပုံများကို ပြင်ဆင်၍မရတော့ပါ။</p>}
					{canEdit && homeworkId && (
						<button
							type='button'
							className={
								styles.btnUpdate
							}
							onClick={handleUpdate}
						>
							<svg
								width='19'
								height='19'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
								strokeLinecap='round'
								strokeLinejoin='round'
							>
								<path d='M12 20h9' />

								<path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z' />
							</svg>

							Update (ပြင်ဆင်မည်)
						</button>
					)}


					{/* BACK */}

					<button
						type='button'
						className={styles.btnBack}
						onClick={() =>
							router.push('/homepage')
						}
					>
						<svg
							width='20'
							height='20'
							viewBox='0 0 24 24'
							fill='none'
							stroke='currentColor'
							strokeWidth='2'
							strokeLinecap='round'
							strokeLinejoin='round'
						>
							<line
								x1='19'
								y1='12'
								x2='5'
								y2='12'
							/>

							<polyline points='12 19 5 12 12 5' />
						</svg>

						ပြန်ထွက်မည် (Back)
					</button>
				</div>


				{/* =====================
				    FOOTER
				===================== */}

				<div className={styles.footer}>
					O-Technique-Myanmar-2026@
				</div>
			</div>
		</div>
	);
}


/* =========================
   EXPORT
   ========================= */

export default function HomeworkSubmittedPage() {
	return (
		<Suspense
			fallback={
				<div className={styles.container}>
					<div
						className={
							styles.mobileFrame
						}
					>
						<div
							className={
								styles.loadingState
							}
						>
							Loading submitted
							homework...
						</div>
					</div>
				</div>
			}
		>
			<HomeworkSubmittedContent />
		</Suspense>
	);
}