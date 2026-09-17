/** @format */

'use client';

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

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

	return 'Login failed.';
}

export default function LoginPage() {
	const router = useRouter();

	const [studentId, setStudentId] = useState('');

	const [phone, setPhone] = useState('');

	const [error, setError] = useState('');

	const [loading, setLoading] = useState(false);

	useEffect(() => {
		const registeredId = localStorage.getItem('registeredStudentCode');

		if (registeredId) {
			// Restore browser-only saved input after hydration.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setStudentId(registeredId);
		}
	}, []);

	const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (loading) {
			return;
		}

		setError('');

		const studentCode = studentId.trim().toUpperCase().replace(/\s+/g, '');

		const normalizedPhone = phone.replace(/\D/g, '');

		if (!/^[A-Z0-9-]{1,20}$/.test(studentCode)) {
			setError('Enter your full Student ID (e.g. MY26-00001).');
			return;
		}

		if (!/^09\d{7,9}$/.test(normalizedPhone)) {
			setError('Phone must start with 09 and contain 9 to 11 digits.');
			return;
		}

		setLoading(true);

		try {
			const response = await fetch(`${API_URL}/student-auth/login`, {
				method: 'POST',

				headers: {
					'Content-Type': 'application/json',
				},

				body: JSON.stringify({
					studentCode,
					phone: normalizedPhone,
				}),
			});

			const result = await response.json().catch(() => null);

			if (!response.ok) {
				throw new Error(getErrorMessage(result));
			}

			if (!result?.accessToken || !result?.student) {
				throw new Error('Invalid login response from server.');
			}

			localStorage.setItem('studentAccessToken', result.accessToken);

			localStorage.setItem('student', JSON.stringify(result.student));

			localStorage.setItem('registeredStudentCode', result.student.studentCode);

			router.replace('/homepage');
		} catch (error) {
			setError(error instanceof Error ? error.message : 'Login failed.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className={styles.container}>
			<div className={styles.mobileFrame}>
				<div className={styles.header}>
					<div className={styles.logoWrapper}>
						<svg
							width='60'
							height='60'
							viewBox='0 0 24 24'
							fill='none'
							stroke='white'
							strokeWidth='1.5'
							strokeLinecap='round'
							strokeLinejoin='round'>
							<path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20' />
							<path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z' />

							<text x='12' y='14' fill='white' fontSize='10' stroke='none' textAnchor='middle' fontWeight='bold'>
								A
							</text>
						</svg>
					</div>

					<h1 className={styles.title}>Pali Homework System</h1>

					<p className={styles.subtitle}>Homework Management System</p>
				</div>

				<form className={styles.form} onSubmit={handleLogin} noValidate>
					{error && (
						<div
							style={{
								padding: '10px 12px',
								marginBottom: '16px',
								borderRadius: '7px',
								color: '#b91c1c',
								background: '#fef2f2',
								fontSize: '14px',
							}}>
							{error}
						</div>
					)}

					<div className={styles.formGroup}>
						<label className={styles.label}>Student ID</label>

						<div className={styles.inputWrapper}>
							<svg className={styles.icon} viewBox='0 0 24 24' fill='#b8860b' width='20' height='20'>
								<path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z' />
							</svg>

							<input
								type='text'
								className={styles.inputFull}
								placeholder='MY26-00001'
								maxLength={20}
								value={studentId}
								onChange={(event) => {
									setStudentId(event.target.value);

									setError('');
								}}
								autoCapitalize='characters'
								spellCheck={false}
								autoComplete='username'
								required
							/>
						</div>
					</div>

					<div className={styles.formGroup}>
						<label className={styles.label}>Phone Number (ဖုန်းနံပါတ်)</label>

						<div className={styles.inputWrapper}>
							<svg
								className={styles.icon}
								viewBox='0 0 24 24'
								fill='none'
								stroke='#b8860b'
								strokeWidth='2'
								width='20'
								height='20'>
								<path d='M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z' />
							</svg>

							<input
								type='tel'
								className={styles.inputFull}
								placeholder='09779953380'
								maxLength={11}
								value={phone}
								onChange={(event) => {
									setPhone(event.target.value.replace(/\D/g, ''));

									setError('');
								}}
								inputMode='numeric'
								autoComplete='tel'
								required
							/>
						</div>
					</div>

					<button type='submit' className={styles.submitBtn} disabled={loading}>
						{loading ? 'ဝင်ရောက်နေသည်...' : 'Login (ဝင်မည်)'}
					</button>

					<button
						type='button'
						onClick={() => router.push('/register')}
						disabled={loading}
						style={{
							width: '100%',
							marginTop: '12px',
							padding: '11px 14px',
							border: '1px solid #b8860b',
							borderRadius: '7px',
							color: '#b8860b',
							background: 'transparent',
							cursor: loading ? 'not-allowed' : 'pointer',
							fontWeight: 600,
						}}>
						Register New Student (မှတ်ပုံတင်မည်)
					</button>
				</form>

				<div className={styles.footer}>O-Technique-Myanmar-2026@</div>
			</div>
		</div>
	);
}
