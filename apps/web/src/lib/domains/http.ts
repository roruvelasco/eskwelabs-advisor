async function parseResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | null;

  if (!response.ok) {
    throw new Error(
      typeof payload === 'object' && payload && 'error' in payload
        ? JSON.stringify(payload)
        : `Request failed with ${response.status}`
    );
  }

  return payload as T;
}

export async function getJson<T>(path: string) {
  return parseResponse<T>(await fetch(path));
}

export async function sendJson<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown
) {
  return parseResponse<T>(
    await fetch(path, {
      method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })
  );
}

export interface ApiEnvelope<T> {
  data: T;
}
