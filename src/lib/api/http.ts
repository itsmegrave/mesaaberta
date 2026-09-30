import { parse } from 'devalue';

export class ApiError extends Error {
  constructor(
    public status: number,
    message = 'Request failed',
  ) {
    super(message);
  }
}

/** Same-origin transport only. Cookies and abort signals are preserved; server errors stay opaque. */
export async function apiRead<T>(path: string, signal?: AbortSignal, viewer?: string): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\'))
    throw new Error('Expected a same-origin API path');
  const response = await fetch(path, {
    signal,
    credentials: 'same-origin',
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new ApiError(response.status);
  if (viewer && viewer !== 'public' && response.headers.get('x-query-viewer') !== viewer)
    throw new ApiError(401);
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(502, 'Invalid API response');
  try {
    return (
      response.headers.get('x-query-codec') === 'devalue'
        ? parse(await response.text())
        : await response.json()
    ) as T;
  } catch {
    throw new ApiError(502, 'Invalid API response');
  }
}
