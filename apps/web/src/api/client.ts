const baseUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

// Error bodies of the API: 400 {message, issues[]}, 409 {message, conflicts[]},
// 422 {message, errors[]}. The body is kept so callers can read those lists.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(
      typeof body === 'object' && body !== null && 'message' in body
        ? String(body.message)
        : `Request failed with status ${status}`,
    );
  }

  get errors(): string[] {
    return this.list('errors').filter((item) => typeof item === 'string');
  }

  list(key: string): unknown[] {
    if (typeof this.body !== 'object' || this.body === null) return [];
    const value = (this.body as Record<string, unknown>)[key];
    return Array.isArray(value) ? value : [];
  }
}

export async function api<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = { method };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : undefined;
  if (!response.ok) throw new ApiError(response.status, json);
  return json as T;
}
