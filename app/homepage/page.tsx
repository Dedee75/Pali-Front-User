/** @format */

'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';

import { confirmAction } from '../../lib/dialog';
import styles from './homepage.module.css';

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

const MAX_PROFILE_IMAGE_SIZE = 6 * 1024 * 1024;

const DEFAULT_STUDENT_IMAGE =
	'data:image/svg+xml;charset=UTF-8,' +
	encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="160" height="160">
      <rect width="160" height="160" fill="#f3f4f6"/>
      <circle cx="80" cy="60" r="30" fill="#c9a227"/>
      <path d="M30 145c8-32 27-48 50-48s42 16 50 48" fill="#c9a227"/>
    </svg>
  `);

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

type HomeworkStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'REVIEWED';

type HomeworkSubmission = {
	id: number;
	submittedAt: string | null;
	totalMarks: number | null;
	remark: string | null;

	images: Array<{
		id: number;
		image: string;
		marks: number | null;
		remark: string | null;
	}>;
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

function getErrorMessage(value: unknown, fallback: string): string {
	if (value && typeof value === 'object' && 'message' in value) {
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

function resolveStudentImage(value: string | null | undefined): string {
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

function formatProfileDate(value: string | null | undefined): string {
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

function getStatusText(status: HomeworkStatus): string {
	if (status === 'REVIEWED') {
		return 'စစ်ဆေးပြီး (Reviewed)';
	}

	if (status === 'SUBMITTED') {
		return 'တင်ပြီးပါပြီ (Submitted)';
	}

	return 'မတင်ရသေး (Not Submitted)';
}

export default function Homepage() {
	const router = useRouter();

	const [student, setStudent] = useState<StudentProfile | null>(null);

	const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);

	const [loading, setLoading] = useState(true);

	const [error, setError] = useState('');

	const [profileOpen, setProfileOpen] = useState(false);

	const [selectedProfileImage, setSelectedProfileImage] = useState<File | null>(null);

	const [profilePreviewUrl, setProfilePreviewUrl] = useState('');

	const [profileSaving, setProfileSaving] = useState(false);

	const [profileError, setProfileError] = useState('');

	useEffect(() => {
		const controller = new AbortController();

		const clearStudentSession = () => {
			localStorage.removeItem('studentAccessToken');

			localStorage.removeItem('student');
		};

		const loadHomepage = async () => {
			const token = localStorage.getItem('studentAccessToken');

			if (!token) {
				clearStudentSession();

				router.replace('/');

				return;
			}

			const storedStudent = getStoredStudent();

			if (storedStudent) {
				setStudent(storedStudent);
			}

			try {
				const headers = {
					Accept: 'application/json',

					Authorization: `Bearer ${token.trim()}`,
				};

				const [profileResponse, homeworkResponse] = await Promise.all([
					fetch(`${API_URL}/student-auth/me`, {
						method: 'GET',

						headers,

						cache: 'no-store',

						signal: controller.signal,
					}),

					fetch(`${API_URL}/student-homeworks`, {
						method: 'GET',

						headers,

						cache: 'no-store',

						signal: controller.signal,
					}),
				]);

				if (profileResponse.status === 401 || homeworkResponse.status === 401) {
					clearStudentSession();

					router.replace('/');

					return;
				}

				const [profileResult, homeworkResult] = await Promise.all([
					profileResponse.json().catch(() => null),

					homeworkResponse.json().catch(() => null),
				]);

				if (!profileResponse.ok) {
					throw new Error(getErrorMessage(profileResult, 'Failed to load student profile.'));
				}

				if (!homeworkResponse.ok) {
					throw new Error(getErrorMessage(homeworkResult, 'Failed to load homework list.'));
				}

				const profile = profileResult as StudentProfile;

				const homeworkList = Array.isArray(homeworkResult) ? (homeworkResult as HomeworkItem[]) : [];

				setStudent(profile);

				setHomeworks(homeworkList);

				localStorage.setItem('student', JSON.stringify(profile));
			} catch (requestError) {
				if (requestError instanceof DOMException && requestError.name === 'AbortError') {
					return;
				}

				setError(requestError instanceof Error ? requestError.message : 'Failed to load homepage.');
			} finally {
				setLoading(false);
			}
		};

		void loadHomepage();

		return () => {
			controller.abort();
		};
	}, [router]);

	useEffect(() => {
		return () => {
			if (profilePreviewUrl) {
				URL.revokeObjectURL(profilePreviewUrl);
			}
		};
	}, [profilePreviewUrl]);

	useEffect(() => {
		if (!profileOpen) {
			return;
		}

		document.body.style.overflow = 'hidden';

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				closeProfileModal();
			}
		};

		document.addEventListener('keydown', handleEscape);

		return () => {
			document.body.style.overflow = '';

			document.removeEventListener('keydown', handleEscape);
		};
	}, [profileOpen]);

	const handleLogout = () => {
		localStorage.removeItem('studentAccessToken');

		localStorage.removeItem('student');

		router.replace('/');
	};

	const openProfileModal = () => {
		setProfileError('');

		setProfileOpen(true);
	};

	const closeProfileModal = () => {
		if (profilePreviewUrl) {
			URL.revokeObjectURL(profilePreviewUrl);
		}

		setProfilePreviewUrl('');

		setSelectedProfileImage(null);

		setProfileError('');

		setProfileOpen(false);
	};

	const handleProfileImageChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0] ?? null;

		if (!file) {
			return;
		}

		const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

		if (!allowedTypes.has(file.type)) {
			setProfileError('Only JPG, PNG and WEBP images are allowed.');

			event.target.value = '';

			return;
		}

		if (file.size > MAX_PROFILE_IMAGE_SIZE) {
			setProfileError('Photo must be 6 MB or smaller.');

			event.target.value = '';

			return;
		}

		if (profilePreviewUrl) {
			URL.revokeObjectURL(profilePreviewUrl);
		}

		const previewUrl = URL.createObjectURL(file);

		setSelectedProfileImage(file);

		setProfilePreviewUrl(previewUrl);

		setProfileError('');
	};

	const saveProfileImage = async () => {
		if (!selectedProfileImage) {
			setProfileError('Please select a new profile photo.');

			return;
		}

		const token = localStorage.getItem('studentAccessToken');

		if (!token) {
			handleLogout();

			return;
		}

		if (!(await confirmAction('update', 'your profile photo'))) return;

		setProfileSaving(true);

		setProfileError('');

		try {
			const requestBody = new FormData();

			requestBody.append('image', selectedProfileImage, selectedProfileImage.name);

			const response = await fetch(`${API_URL}/student-auth/me/image`, {
				method: 'PATCH',

				headers: {
					Accept: 'application/json',

					Authorization: `Bearer ${token.trim()}`,
				},

				body: requestBody,
			});

			const result = await response.json().catch(() => null);

			if (response.status === 401) {
				handleLogout();

				return;
			}

			if (!response.ok) {
				throw new Error(getErrorMessage(result, 'Failed to update profile photo.'));
			}

			const updatedStudent = result?.student ?? result;

			const nextStudent = {
				...(student ?? {}),
				...updatedStudent,
			} as StudentProfile;

			/*
			 * Keep the latest profile in localStorage
			 * before the page reloads.
			 */
			localStorage.setItem('student', JSON.stringify(nextStudent));

			setStudent(nextStudent);

			if (profilePreviewUrl) {
				URL.revokeObjectURL(profilePreviewUrl);
			}

			setProfilePreviewUrl('');

			setSelectedProfileImage(null);

			setProfileError('');

			setProfileOpen(false);

			/*
			 * Upload success:
			 * close profile modal,
			 * reload data,
			 * and return to homepage.
			 */
			window.location.replace('/homepage');

			return;
		} catch (requestError) {
			setProfileError(requestError instanceof Error ? requestError.message : 'Failed to update profile photo.');
		} finally {
			setProfileSaving(false);
		}
	};

	const openHomework = (homework: HomeworkItem) => {
		if (homework.status === 'NOT_SUBMITTED') {
			router.push(`/homework-create?homeworkId=${homework.id}`);

			return;
		}

		router.push(`/homework-submitted?homeworkId=${homework.id}`);
	};

	const batchName =
		student?.batch?.name ?? homeworks[0]?.batch?.name ?? `Batch ${String(student?.batchId ?? '').padStart(3, '0')}`;

	if (loading) {
		return (
			<div className={styles.container}>
				<div className={styles.mobileFrame}>
					<div className={styles.loadingState}>Loading...</div>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.container}>
			<div className={styles.mobileFrame}>
				<div className={styles.userCard}>
					<div className={styles.userCardTop}>
						<div className={styles.userInfo}>
							<h1 className={styles.greeting}>မင်္ဂလာပါ, {student?.name ?? 'Student'}</h1>

							<div className={styles.batchInfo}>
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

									<circle cx='9' cy='7' r='4' />

									<path d='M23 21v-2a4 4 0 0 0-3-3.87' />

									<path d='M16 3.13a4 4 0 0 1 0 7.75' />
								</svg>

								<span>
									{batchName}
									{' · '}
									{student?.studentCode ?? ''}
								</span>
							</div>
						</div>

						<div className={styles.profileActions}>
							<button
								type='button'
								className={styles.profilePhotoButton}
								onClick={openProfileModal}
								title='My Profile'
								aria-label='My Profile'>
								<img
									src={resolveStudentImage(student?.image)}
									alt={student?.name ?? 'Student Profile'}
									className={styles.profilePhoto}
									onError={(event) => {
										event.currentTarget.src = DEFAULT_STUDENT_IMAGE;
									}}
								/>

								<span className={styles.profileEditBadge}>✎</span>
							</button>

							<button
								type='button'
								className={styles.logoutBtn}
								onClick={handleLogout}
								title='Logout'
								aria-label='Logout'>
								<svg
									width='20'
									height='20'
									viewBox='0 0 24 24'
									fill='none'
									stroke='#b8860b'
									strokeWidth='2'
									strokeLinecap='round'
									strokeLinejoin='round'>
									<path d='M9 21H5a2 2 0 0 0-2-2V5a2 2 0 0 1 2-2h4' />

									<polyline points='16 17 21 12 16 7' />

									<line x1='21' y1='12' x2='9' y2='12' />
								</svg>
							</button>
						</div>
					</div>
				</div>

				{error && <div className={styles.errorBox}>{error}</div>}

				<h2 className={styles.sectionTitle}>Weekly Homework (အိမ်စာများ)</h2>

				<div className={styles.homeworkList}>
					{homeworks.length === 0 && !error && <div className={styles.emptyCard}>လက်ရှိအိမ်စာ မရှိသေးပါ။</div>}

					{homeworks.map((homework) => {
						const isNotSubmitted = homework.status === 'NOT_SUBMITTED';

						const isReviewed = homework.status === 'REVIEWED';

						return (
							<div key={homework.id} className={styles.card}>
								<div className={styles.cardHeader}>
									<span className={styles.weekBadge}>{homework.weekLabel}</span>

									<span className={isNotSubmitted ? styles.statusNotSubmitted : styles.statusApproved}>
										{getStatusText(homework.status)}
									</span>
								</div>

								<h3 className={styles.taskTitle}>{homework.title}</h3>

								<p className={styles.taskDesc}>{homework.description}</p>

								<div className={styles.dueDateBox}>
									<svg
										width='14'
										height='14'
										viewBox='0 0 24 24'
										fill='none'
										stroke='#666'
										strokeWidth='2'
										strokeLinecap='round'
										strokeLinejoin='round'>
										<circle cx='12' cy='12' r='10' />

										<polyline points='12 6 12 12 16 14' />
									</svg>

									<span>Due: {formatDate(homework.dueDate)}</span>
								</div>

								{isReviewed && homework.submission && (
									<div className={styles.reviewBox}>
										<div>Comment: {homework.submission.remark ?? 'No comment'}</div>
									</div>
								)}

								<button
									type='button'
									className={isNotSubmitted ? styles.btnUpload : styles.btnSubmitted}
									onClick={() => openHomework(homework)}>
									{isNotSubmitted ?
										<>
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

												<line x1='12' y1='3' x2='12' y2='15' />
											</svg>
											တင်ရန် (Upload)
										</>
									:	<>
											<svg
												width='18'
												height='18'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'>
												<path d='M22 11.08V12a10 10 0 1 1-5.93-9.14' />

												<polyline points='22 4 12 14.01 9 11.01' />
											</svg>

											{isReviewed ? 'စစ်ဆေးပြီး (View)' : 'တင်ပြီးပါပြီ (Submitted)'}
										</>
									}
								</button>
							</div>
						);
					})}
				</div>

				<div className={styles.footer}>O-Technique-Myanmar-2026@</div>

				{profileOpen && student && (
					<div className={styles.profileModalOverlay} onClick={closeProfileModal}>
						<section
							className={styles.profileModal}
							onClick={(event) => event.stopPropagation()}
							role='dialog'
							aria-modal='true'
							aria-labelledby='student-profile-title'>
							<button
								type='button'
								className={styles.profileCloseButton}
								onClick={closeProfileModal}
								aria-label='Close'>
								×
							</button>

							<div className={styles.profileModalHeader}>
								<div className={styles.profileModalImageWrapper}>
									<img
										src={profilePreviewUrl || resolveStudentImage(student.image)}
										alt={student.name}
										className={styles.profileModalImage}
										onError={(event) => {
											event.currentTarget.src = DEFAULT_STUDENT_IMAGE;
										}}
									/>

									<span className={styles.profileModalEditIcon}>✎</span>
								</div>

								<div>
									<h2 id='student-profile-title' className={styles.profileModalName}>
										{student.name}
									</h2>

									<p className={styles.profileModalCode}>{student.studentCode}</p>
								</div>
							</div>

							<div className={styles.profileDetails}>
								<div className={styles.profileDetailRow}>
									<strong>Student ID</strong>

									<span>{student.studentCode}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Name</strong>

									<span>{student.name}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Batch</strong>

									<span>{student.batch?.name ?? batchName}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Phone</strong>

									<span>{student.phone ?? '-'}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Date of Birth</strong>

									<span>{formatProfileDate(student.dateOfBirth)}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Age</strong>

									<span>{student.age ?? '-'}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Gender</strong>

									<span>{student.gender ?? '-'}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Occupation</strong>

									<span>{student.occupation ?? '-'}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Township</strong>

									<span>{student.township ?? '-'}</span>
								</div>

								<div className={styles.profileDetailRow}>
									<strong>Region</strong>

									<span>{student.region ?? '-'}</span>
								</div>
							</div>

							<div className={styles.readOnlyNotice}>
								Profile information is read-only. Only the profile photo can be changed.
							</div>

							<div className={styles.profileImageEditor}>
								<label className={styles.profileImageLabel}>Change Profile Photo</label>

								<input
									type='file'
									accept='image/jpeg,image/png,image/webp'
									className={styles.profileImageInput}
									onChange={handleProfileImageChange}
									disabled={profileSaving}
								/>

								<small className={styles.profileImageHint}>JPG, PNG or WEBP · Maximum 6 MB</small>

								{profileError && <div className={styles.profileImageError}>{profileError}</div>}

								<button
									type='button'
									className={styles.profileSaveButton}
									onClick={() => void saveProfileImage()}
									disabled={profileSaving || !selectedProfileImage}>
									{profileSaving ? 'Saving...' : 'Save New Photo'}
								</button>
							</div>
						</section>
					</div>
				)}
			</div>
		</div>
	);
}
