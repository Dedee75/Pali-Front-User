const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3000';

export async function studentApiFetch(
  endpoint: string,
  options: RequestInit = {},
) {
  const token =
    localStorage.getItem(
      'studentAccessToken',
    );

  if (!token) {
    throw new Error(
      'Student login is required.',
    );
  }

  const response = await fetch(
    `${API_URL}${endpoint}`,
    {
      ...options,

      headers: {
        ...(options.body
          ? {
              'Content-Type':
                'application/json',
            }
          : {}),

        Authorization:
          `Bearer ${token}`,

        ...options.headers,
      },

      cache: 'no-store',
    },
  );

  const result =
    await response
      .json()
      .catch(() => null);

  if (
    response.status === 401
  ) {
    localStorage.removeItem(
      'studentAccessToken',
    );

    localStorage.removeItem(
      'student',
    );

    throw new Error(
      result?.message ??
        'Student session expired.',
    );
  }

  if (!response.ok) {
    const message =
      Array.isArray(
        result?.message,
      )
        ? result.message.join(
            ', ',
          )
        : result?.message ??
          'Request failed.';

    throw new Error(message);
  }

  return result;
}
