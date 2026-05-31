/** Base URL for the FastAPI backend. */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Helper to handle error responses from fetch calls. */
export async function checkResponse<T>(res: Response, errorMsg: string): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const detail = typeof body.detail === "string" ? body.detail : undefined;
    throw new Error(detail || `${errorMsg} (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/** Helper to throw an error for planned API stubs that are not wired to the backend yet. */
export function plannedApiStub(featureName: string): never {
  throw new Error(`Planned API not wired yet: ${featureName}`);
}
