/** @format */

'use client';
import { useServerPagination } from '../../lib/server-pagination';
import { EntriesControl, ListPagination } from '../../components/ListPagination';

import { PrivateImage } from '@/lib/private-files';

import { useMemo, useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isActiveUpload } from '../../lib/homework-uploads';
import { useHomeworkUploads } from '../../lib/use-homework-uploads';

import { confirmAction, showMessage } from '../../lib/dialog';
import styles from './homepage.module.css';

const API_URL = (
	process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000'
).replace(/\/$/, '');

const MAX_PROFILE_IMAGE_SIZE = 15 * 1024 * 1024;

const DEFAULT_STUDENT_IMAGE =
	'data:image/svg+xml;charset=UTF-8,' +
	encodeURIComponent(`
		<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
			<rect width="160" height="160" fill="#f3f4f6"/>
			<circle cx="80" cy="60" r="30" fill="#c9a227"/>
			<path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
		</svg>
	`);

/* =========================
   TYPES
========================= */

type StudentProfile = {
	id: number;
	studentCode: string;
	name: string;
	phone: string | null;
	age: number | null;
	gender: string | null;
	occupation: string | null;
	township: string | null;
	region: string | null;
	dateOfBirth: string | null;
	image: string | null;
	batchId: number;
	isActive?: boolean;

	batch?: {
		id: number;
		name: string;
	} | null;
};

type HomeworkStatus =
	| 'NOT_SUBMITTED'
	| 'PROCESSING'
	| 'SUBMITTED'
	| 'REVIEWED';

type HomeworkSubmission = {
 processingError?: string | null;
	id: number;
	submittedAt: string | null;
	totalMarks: number | null;
	remark: string | null;

	imageCount: number;
};

type HomeworkItem = {
	id: number;
	weekLabel: string;
	title: string;
	description: string;
	dueDate: string;
	totalMarks: number | null;
	status: HomeworkStatus;

	batch: {
		id: number;
		name: string;
	};

	submission: HomeworkSubmission | null;
};

/* =========================
   HELPERS
========================= */

function getStoredStudent(): StudentProfile | null {
	const value = localStorage.getItem('student');

	if (!value) {
		return null;
	}

	try {
		return JSON.parse(value) as StudentProfile;
	} catch {
		return null;
	}
}

function getErrorMessage(
	value: unknown,
	fallback: string,
): string {
	if (
		value &&
		typeof value === 'object' &&
		'message' in value
	) {
		const message = (
			value as {
				message?: unknown;
			}
		).message;

		if (typeof message === 'string') {
			return message;
		}

		if (Array.isArray(message)) {
			return message.join(', ');
		}
	}

	return fallback;
}

function resolveStudentImage(
	value: string | null | undefined,
): string {
	const image = String(value ?? '').trim();

	if (!image) {
		return DEFAULT_STUDENT_IMAGE;
	}

	if (
		image.startsWith('http://') ||
		image.startsWith('https://') ||
		image.startsWith('data:image/') ||
		image.startsWith('blob:')
	) {
		return image;
	}

	if (image.startsWith('/')) {
		return `${API_URL}${image}`;
	}

	return `${API_URL}/${image}`;
}

function formatDate(value: string): string {
	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date);
}

function formatProfileDate(
	value: string | null | undefined,
): string {
	if (!value) {
		return '-';
	}

	const date = new Date(value);

	if (Number.isNaN(date.getTime())) {
		return value;
	}

	return new Intl.DateTimeFormat('en-CA', {
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(date);
}

function getStatusText(
	status: HomeworkStatus,
): string {
	switch (status) {
		case 'PROCESSING':
			return 'ပြုပြင်နေပါသည် (Processing)';
		case 'REVIEWED':
			return 'စစ်ဆေးပြီး (Reviewed)';

		case 'SUBMITTED':
			return 'တင်ပြီးပါပြီ (Submitted)';

		default:
			return 'မတင်ရသေး (Not Submitted)';
	}
}

/* =========================
   PAGE
========================= */

export default function Homepage() {
 const pager = useServerPagination();
 const {query: pageQuery, accept: acceptPage} = pager;


  const [loggingOut, setLoggingOut] = useState(false);
	const router = useRouter();
 const uploads = useHomeworkUploads();

	const [student, setStudent] =
		useState<StudentProfile | null>(null);

	const [homeworkRows, setHomeworks] =
		useState<HomeworkItem[]>([]);
 const homeworks = useMemo(() => pager.isCurrent ? homeworkRows : [], [pager.isCurrent, homeworkRows]);


	const [loading, setLoading] =
		useState(true);

	const [error, setError] =
		useState('');

	const [profileOpen, setProfileOpen] =
		useState(false);

	const [
		selectedProfileImage,
		setSelectedProfileImage,
	] = useState<File | null>(null);

	const [
		profilePreviewUrl,
		setProfilePreviewUrl,
	] = useState('');

	const [
		profileSaving,
		setProfileSaving,
	] = useState(false);

	const [
		profileError,
		setProfileError,
	] = useState('');

	/* =========================
	   LOAD HOMEPAGE
	========================= */

	useEffect(() => {
		const controller =
			new AbortController();

		const clearStudentSession = () => {
			localStorage.removeItem(
				'studentAccessToken',
			);

			localStorage.removeItem(
				'student',
			);
		};

		const loadHomepage = async () => {
			const token =
				localStorage.getItem(
					'studentAccessToken',
				);

			if (!token) {
				clearStudentSession();

				router.replace('/');

				return;
			}

			const storedStudent =
				getStoredStudent();

			if (storedStudent) {
				setStudent(storedStudent);
			}

			try {
				const headers = {
					Accept: 'application/json',

					Authorization: `Bearer ${token.trim()}`,
				};

				const [
					profileResponse,
					homeworkResponse,
				] = await Promise.all([
					fetch(
						`${API_URL}/student-auth/me`,
						{
							method: 'GET',
							headers,
							cache: 'no-store',
							signal:
								controller.signal,
						},
					),

					fetch(
						`${API_URL}/student-homeworks?${pageQuery}`,
						{
							method: 'GET',
							headers,
							cache: 'no-store',
							signal:
								controller.signal,
						},
					),
				]);

				if (
					profileResponse.status ===
						401 ||
					homeworkResponse.status ===
						401
				) {
					clearStudentSession();

					router.replace('/');

					return;
				}

				const [
					profileResult,
					homeworkResult,
				] = await Promise.all([
					profileResponse
						.json()
						.catch(() => null),

					homeworkResponse
						.json()
						.catch(() => null),
				]);

				if (!profileResponse.ok) {
					throw new Error(
						getErrorMessage(
							profileResult,
							'Failed to load student profile.',
						),
					);
				}

				if (!homeworkResponse.ok) {
					throw new Error(
						getErrorMessage(
							homeworkResult,
							'Failed to load homework list.',
						),
					);
				}

				const profile =
					profileResult as StudentProfile;

                if (controller.signal.aborted || !acceptPage(homeworkResult, pageQuery)) return;
                const homeworkList = homeworkResult.data as HomeworkItem[];

				setStudent(profile);

				setHomeworks(
					homeworkList,
				);

				localStorage.setItem(
					'student',
					JSON.stringify(profile),
				);
			} catch (requestError) {
				if (
					requestError instanceof
						DOMException &&
					requestError.name ===
						'AbortError'
				) {
					return;
				}

				setError(
					requestError instanceof
					Error
						? requestError.message
						: 'Failed to load homepage.',
				);
			} finally {
				setLoading(false);
			}
		};

        let refreshing = false;
        const refreshHomepage = async () => {
            if (document.hidden || refreshing || controller.signal.aborted) return;
            refreshing = true;
            try { await loadHomepage(); } finally { refreshing = false; }
        };
        const handleVisibilityChange = () => {
            if (!document.hidden) void refreshHomepage();
        };
        void refreshHomepage();
        const refreshTimer = window.setInterval(() => void refreshHomepage(), 15000);
        window.addEventListener('focus', refreshHomepage);
        window.addEventListener('homework-upload-state', refreshHomepage);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            controller.abort();
            window.clearInterval(refreshTimer);
            window.removeEventListener('focus', refreshHomepage);
            window.removeEventListener('homework-upload-state', refreshHomepage);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
	}, [router, pageQuery, acceptPage]);

	/* =========================
	   PROFILE PREVIEW CLEANUP
	========================= */

	useEffect(() => {
		return () => {
			if (profilePreviewUrl) {
				URL.revokeObjectURL(
					profilePreviewUrl,
				);
			}
		};
	}, [profilePreviewUrl]);

	/* =========================
	   PROFILE MODAL
	========================= */

	useEffect(() => {
		if (!profileOpen) {
			return;
		}

		document.body.style.overflow =
			'hidden';

		const handleEscape = (
			event: KeyboardEvent,
		) => {
			if (event.key === 'Escape') {
				setProfileOpen(false);
			}
		};

		document.addEventListener(
			'keydown',
			handleEscape,
		);

		return () => {
			document.body.style.overflow =
				'';

			document.removeEventListener(
				'keydown',
				handleEscape,
			);
		};
	}, [profileOpen]);

	/* =========================
	   LOGOUT
	========================= */

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const token = localStorage.getItem('studentAccessToken');
      if (token) {
        const response = await fetch(`${API_URL}/student-auth/logout-all`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.trim()}` },
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok && response.status !== 401) {
          throw new Error('Logout failed');
        }
      }
      localStorage.removeItem('studentAccessToken');
      localStorage.removeItem('student');
      router.replace('/');
    } catch {
      await showMessage('Logout မပြီးသေးပါ။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ပြီး ပြန်နှိပ်ပေးပါ။');
    } finally {
      setLoggingOut(false);
    }
  };

	/* =========================
	   PROFILE
	========================= */

	const openProfileModal = () => {
		setProfileError('');

		setProfileOpen(true);
	};

	const closeProfileModal = () => {
		if (profilePreviewUrl) {
			URL.revokeObjectURL(
				profilePreviewUrl,
			);
		}

		setProfilePreviewUrl('');

		setSelectedProfileImage(null);

		setProfileError('');

		setProfileOpen(false);
	};

	const handleProfileImageChange = (
		event: ChangeEvent<HTMLInputElement>,
	) => {
		const file =
			event.target.files?.[0] ??
			null;

		if (!file) {
			return;
		}

		const allowedTypes = new Set([
			'image/jpeg',
			'image/png',
			'image/webp',
		]);

		if (
			!allowedTypes.has(file.type)
		) {
			setProfileError(
				'Only JPG, PNG and WEBP images are allowed.',
			);

			event.target.value = '';

			return;
		}

		if (
			file.size >
			MAX_PROFILE_IMAGE_SIZE
		) {
			setProfileError(
				'Photo must be 15 MB or smaller.',
			);

			event.target.value = '';

			return;
		}

		if (profilePreviewUrl) {
			URL.revokeObjectURL(
				profilePreviewUrl,
			);
		}

		const previewUrl =
			URL.createObjectURL(file);

		setSelectedProfileImage(file);

		setProfilePreviewUrl(
			previewUrl,
		);

		setProfileError('');
	};

	const saveProfileImage =
		async () => {
			if (
				!selectedProfileImage
			) {
				setProfileError(
					'Please select a new profile photo.',
				);

				return;
			}

			const token =
				localStorage.getItem(
					'studentAccessToken',
				);

			if (!token) {
				handleLogout();

				return;
			}

			if (
				!(
					await confirmAction(
						'update',
						'your profile photo',
					)
				)
			) {
				return;
			}

			setProfileSaving(true);

			setProfileError('');

			try {
				const requestBody =
					new FormData();

				requestBody.append(
					'image',
					selectedProfileImage,
					selectedProfileImage.name,
				);

				const response =
					await fetch(
						`${API_URL}/student-auth/me/image`,
						{
							method: 'PATCH',

							headers: {
								Accept:
									'application/json',

								Authorization: `Bearer ${token.trim()}`,
							},

							body: requestBody,
						},
					);

				const result =
					await response
						.json()
						.catch(() => null);

				if (
					response.status === 401
				) {
					handleLogout();

					return;
				}

				if (!response.ok) {
					throw new Error(
						getErrorMessage(
							result,
							'Failed to update profile photo.',
						),
					);
				}

				const updatedStudent =
					result?.student ??
					result;

				const nextStudent = {
					...(student ?? {}),
					...updatedStudent,
				} as StudentProfile;

				localStorage.setItem(
					'student',
					JSON.stringify(
						nextStudent,
					),
				);

				setStudent(nextStudent);

				if (
					profilePreviewUrl
				) {
					URL.revokeObjectURL(
						profilePreviewUrl,
					);
				}

				setProfilePreviewUrl('');

				setSelectedProfileImage(
					null,
				);

				setProfileError('');

				setProfileOpen(false);

				window.location.replace(
					'/homepage',
				);
			} catch (requestError) {
				setProfileError(
					requestError instanceof
						Error
						? requestError.message
						: 'Failed to update profile photo.',
				);
			} finally {
				setProfileSaving(false);
			}
		};

	/* =========================
	   OPEN HOMEWORK
	========================= */

	const openHomework = (
		homework: HomeworkItem,
	) => {
		/*
		 * NOT SUBMITTED
		 * -> upload page
		 */
		if (
			homework.status ===
			'NOT_SUBMITTED'
		) {
			router.push(
				`/homework-create?homeworkId=${homework.id}`,
			);

			return;
		}

		/*
		 * SUBMITTED
		 * -> submitted page
		 * -> student can review/edit
		 */
		if (
			homework.status ===
			'SUBMITTED'
		) {
			router.push(
				`/homework-submitted?homeworkId=${homework.id}`,
			);

			return;
		}

		/*
		 * REVIEWED
		 * -> submitted page
		 * -> View Only
		 */
		router.push(
			`/homework-submitted?homeworkId=${homework.id}`,
		);
	};

	const batchName =
		student?.batch?.name ??
		homeworks[0]?.batch?.name ??
		`Batch ${String(
			student?.batchId ?? '',
		).padStart(3, '0')}`;

	/* =========================
	   LOADING
	========================= */

	if (loading || (!pager.isCurrent && !error)) {
		return (
			<div
				className={
					styles.container
				}>
				<div
					className={
						styles.mobileFrame
					}>
					<div
						className={
							styles.loadingState
						}>
						Loading...
					</div>
				</div>
			</div>
		);
	}

	/* =========================
	   UI
	========================= */

	return (
		<div
			className={
				styles.container
			}>
			<div
				className={
					styles.mobileFrame
				}>

				{/* =========================
				    STUDENT CARD
				========================= */}

				<div
					className={
						styles.userCard
					}>
					<div
						className={
							styles.userCardTop
						}>
						<div
							className={
								styles.userInfo
							}>
							<h1
								className={
									styles.greeting
								}>
								မင်္ဂလာပါ,{' '}
								{student?.name ??
									'Student'}
							</h1>

							<div
								className={
									styles.batchInfo
								}>
								<svg
									width='16'
									height='16'
									viewBox='0 0 24 24'
									fill='none'
									stroke='#b8860b'
									strokeWidth='2'
									strokeLinecap='round'
									strokeLinejoin='round'>
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
									{batchName}

									{' · '}

									{student?.studentCode ??
										''}
								</span>
							</div>
						</div>

						<div
							className={
								styles.profileActions
							}>
							<button
								type='button'
								className={
									styles.profilePhotoButton
								}
								onClick={
									openProfileModal
								}
								title='My Profile'
								aria-label='My Profile'>
								<PrivateImage
									src={resolveStudentImage(
										student?.image,
									)}
									alt={
										student?.name ??
										'Student Profile'
									}
									className={
										styles.profilePhoto
									}
									onError={(
										event,
									) => {
										event.currentTarget.src =
											DEFAULT_STUDENT_IMAGE;
									}}
								/>

								<span
									className={
										styles.profileEditBadge
									}>
									✎
								</span>
							</button>

							<button
								type='button'
								className={
									styles.logoutBtn
								}
								onClick={
									handleLogout
								}
								disabled={loggingOut}
                                title='စက်အားလုံးမှ Logout'
								aria-label='စက်အားလုံးမှ Logout'>
								<svg
									width='20'
									height='20'
									viewBox='0 0 24 24'
									fill='none'
									stroke='#b8860b'
									strokeWidth='2'
									strokeLinecap='round'
									strokeLinejoin='round'>
									<path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' />

									<polyline points='16 17 21 12 16 7' />

									<line
										x1='21'
										y1='12'
										x2='9'
										y2='12'
									/>
								</svg>
							</button>
						</div>
					</div>
				</div>

				{/* =========================
				    ERROR
				========================= */}

				{error && (
					<div
						className={
							styles.errorBox
						}>
						{error}
					</div>
				)}

				{/* =========================
				    TITLE
				========================= */}

				<h2
					className={
						styles.sectionTitle
					}>
					Weekly Homework
					(အိမ်စာများ)
				</h2>

				<EntriesControl pageSize={pager.pageSize} onChange={pager.setPageSize} />

				{/* =========================
				    HOMEWORK LIST
				========================= */}

				<div
					className={
						styles.homeworkList
					}>

					{homeworks.length ===
						0 &&
						!error && (
							<div
								className={
									styles.emptyCard
								}>
								လက်ရှိအိမ်စာ
								မရှိသေးပါ။
							</div>
						)}

                    {homeworks.map(
						(homework) => {
                            const activeUpload = uploads.find(job => job.homeworkId === String(homework.id) && isActiveUpload(job));
							const isNotSubmitted =
								homework.status ===
								'NOT_SUBMITTED' && !activeUpload;

							const isSubmitted =
								homework.status ===
								'SUBMITTED' && !activeUpload;

							const isProcessing =
								Boolean(activeUpload) || homework.status ===
								'PROCESSING';

							const isReviewed =
								homework.status ===
								'REVIEWED';

							const fullMarks =
								homework.totalMarks ??
								100;

                            const obtainedMarks = isReviewed ? homework.submission?.totalMarks ?? '-' : '-';

							return (
								<div
									key={
										homework.id
									}
									className={
										styles.card
									}>

									{/* HEADER */}

									<div
										className={
											styles.cardHeader
										}>
										<span
											className={
												styles.weekBadge
											}>
											{
												homework.weekLabel
											}
										</span>

										<span
											className={
											isNotSubmitted
													? styles.statusNotSubmitted
													: isSubmitted || isProcessing
														? styles.statusSubmitted
														: styles.statusReviewed
											}>
											{activeUpload?.status === 'uploading' ? `ပို့နေသည် (${activeUpload.progress}%)` : getStatusText(
												homework.status,
											)}
										</span>
									</div>

									{isProcessing && <div role='status' style={{padding: '12px 0'}}>
                                        {activeUpload?.status === 'uploading' ? `ဖိုင်များ ပို့နေသည် — ${activeUpload.progress}%` : 'ဖိုင်လက်ခံပြီး၊ PDF နှင့် ပုံများကို ပြင်ဆင်နေပါသည်။'}
                                        <Link href={`/upload-loading?homeworkId=${homework.id}`}> အခြေအနေကြည့်ရန်</Link>
                                    </div>}
                                    {!activeUpload && homework.submission?.processingError && <div role='alert' style={{color: '#a12622', padding: '12px 0'}}>
                                        <strong>အိမ်စာတင်မှု မအောင်မြင်ပါ။</strong><p>{homework.submission.processingError}</p>
                                        <Link href={`/homework-create?homeworkId=${homework.id}&mode=upload`}>ဖိုင်ပြန်ရွေးပြီး တင်မည်</Link>
                                    </div>}
                                    {/* TITLE */}

									<h3
										className={
											styles.taskTitle
										}>
										{
											homework.title
										}
									</h3>

									{/* DESCRIPTION */}

									<p
										className={
											styles.taskDesc
										}>
										{
											homework.description
										}
									</p>

									{/* =========================
									    DUE DATE + MARK
									========================= */}

									<div
										className={
											styles.homeworkMeta
										}>
										<div
											className={
												styles.dueDateBox
											}>
											<svg
												width='14'
												height='14'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'>
												<circle
													cx='12'
													cy='12'
													r='10'
												/>

												<polyline points='12 6 12 12 16 14' />
											</svg>

											<span>
												Due:{' '}
												{formatDate(
													homework.dueDate,
												)}
											</span>
										</div>

										<div
											className={
												styles.markBox
											}>
											<span>
												ရမှတ် :
											</span>

											<strong>
												{
													obtainedMarks
												}
												/
												{
													fullMarks
												}
											</strong>
										</div>
									</div>

									{/* =========================
									    REVIEW COMMENT
									========================= */}

									{isReviewed &&
										homework.submission && (
											<div
												className={
													styles.reviewBox
												}>
												<span>
													Comment:
												</span>{' '}

												{homework
													.submission
													.remark ??
													'No comment'}
											</div>
										)}

									{/* =========================
									    NOT SUBMITTED BUTTON
									========================= */}

									{isNotSubmitted && (
										<button
											type='button'
											className={
												styles.btnUpload
											}
											onClick={() =>
												openHomework(
													homework,
												)
											}>
											<svg
												width='18'
												height='18'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'>
												<path d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' />

												<polyline points='17 8 12 3 7 8' />

												<line
													x1='12'
													y1='3'
													x2='12'
													y2='15'
												/>
											</svg>

											တင်ရန်
											(Upload)
										</button>
									)}

									{/* =========================
									    SUBMITTED / EDIT BUTTON
									========================= */}

									{isSubmitted && (
										<button
											type='button'
											className={
												styles.btnEdit
											}
											onClick={() =>
												openHomework(
													homework,
												)
											}>
											<svg
												width='18'
												height='18'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'>
												<path d='M12 20h9' />

												<path d='M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z' />
											</svg>

											ပြန်စစ်ရန်
											(Edit)
										</button>
									)}

										{isProcessing && (
											<div className={styles.btnEdit}>
												{activeUpload?.status === 'uploading' ? 'ဖိုင်များ ပို့နေပါသည်။' : 'အိမ်စာပုံများကို ပြုပြင်နေပါသည်။'}
											</div>
										)}

									{/* =========================
									    REVIEWED BUTTON
									========================= */}

									{isReviewed && (
										<button
											type='button'
											className={
												styles.btnReviewed
											}
											onClick={() =>
												openHomework(
													homework,
												)
											}>
											<svg
												width='18'
												height='18'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'>
												<circle
													cx='12'
													cy='12'
													r='9'
												/>

												<path d='m8 12 2.5 2.5L16 9' />
											</svg>

											စစ်ဆေးပြီး
											(View Only)
										</button>
									)}
								</div>
							);
						},
					)}
				</div>

				<ListPagination total={pager.total} pageSize={pager.pageSize} currentPage={pager.currentPage} onChange={pager.setCurrentPage} />

				{/* =========================
				    FOOTER
				========================= */}

				<div
					className={
						styles.footer
					}>
					O-Technique-Myanmar-2026@
				</div>

				{/* =========================
				    PROFILE MODAL
				========================= */}

				{profileOpen &&
					student && (
						<div
							className={
								styles.profileModalOverlay
							}
							onClick={
								closeProfileModal
							}>
							<section
								className={
									styles.profileModal
								}
								onClick={(
									event,
								) =>
									event.stopPropagation()
								}
								role='dialog'
								aria-modal='true'
								aria-labelledby='student-profile-title'>

								<button
									type='button'
									className={
										styles.profileCloseButton
									}
									onClick={
										closeProfileModal
									}
									aria-label='Close'>
									×
								</button>

								<div
									className={
										styles.profileModalHeader
									}>
									<div
										className={
											styles.profileModalImageWrapper
										}>
										<PrivateImage
											src={
												profilePreviewUrl ||
												resolveStudentImage(
													student.image,
												)
											}
											alt={
												student.name
											}
											className={
												styles.profileModalImage
											}
											onError={(
												event,
											) => {
												event.currentTarget.src =
													DEFAULT_STUDENT_IMAGE;
											}}
										/>

										<span
											className={
												styles.profileModalEditIcon
											}>
											✎
										</span>
									</div>

									<div>
										<h2
											id='student-profile-title'
											className={
												styles.profileModalName
											}>
											{
												student.name
											}
										</h2>

										<p
											className={
												styles.profileModalCode
											}>
											{
												student.studentCode
											}
										</p>
									</div>
								</div>

								<div
									className={
										styles.profileDetails
									}>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Student ID
										</strong>

										<span>
											{
												student.studentCode
											}
										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Name
										</strong>

										<span>
											{
												student.name
											}
										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Batch
										</strong>

										<span>
											{student.batch
												?.name ??
												batchName}
										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Phone
										</strong>

										<span>
											{student.phone ??
												'-'}
										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Date of Birth
										</strong>

										<span>
											{formatProfileDate(
												student.dateOfBirth,
											)}

										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Age
										</strong>

										<span>
											{student.age ??
												'-'}
										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Gender
										</strong>

										<span>
											{student.gender ??
												'-'}
										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Occupation
										</strong>

										<span>
											{student.occupation ??
												'-'}
										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Township
										</strong>

										<span>
											{student.township ??
												'-'}
										</span>
									</div>

									<div
										className={
											styles.profileDetailRow
										}>
										<strong>
											Region
										</strong>

										<span>
											{student.region ??
												'-'}
										</span>
									</div>
								</div>

								<div
									className={
										styles.readOnlyNotice
									}>
									Profile information
									is read-only. Only
									the profile photo can
									be changed.
                                    Please Contact Administartor to Edit Profile.
								</div>

								<div
									className={
										styles.profileImageEditor
									}>
									<label
										className={
											styles.profileImageLabel
										}>
										Change Profile
										Photo
									</label>

									<input
										type='file'
										accept='image/jpeg,image/png,image/webp'
										className={
											styles.profileImageInput
										}
										onChange={
											handleProfileImageChange
										}
										disabled={
											profileSaving
										}
									/>

									<small
										className={
											styles.profileImageHint
										}>
										JPG, PNG or WEBP
										· Maximum 15 MB
									</small>

									{profileError && (
										<div
											className={
												styles.profileImageError
											}>
											{
												profileError
											}
										</div>
									)}

									<button
										type='button'
										className={
											styles.profileSaveButton
										}
										onClick={() =>
											void saveProfileImage()
										}
										disabled={
											profileSaving ||
											!selectedProfileImage
										}>
										{profileSaving
											? 'Saving...'
											: 'Save New Photo'}
									</button>
								</div>
							</section>
						</div>
					)}
			</div>
		</div>
	);
}
