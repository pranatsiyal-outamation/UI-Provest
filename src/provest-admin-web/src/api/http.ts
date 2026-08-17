/**
 * Thin fetch wrapper. Every non-2xx response becomes an ApiError carrying the
 * RFC 7807 ProblemDetails the API returned, so pages can show a top-level message
 * and highlight the offending fields without each one parsing responses itself.
 */

import { logger } from '../lib/logger'

export interface ProblemDetails {
  type?: string
  title?: string
  status?: number
  detail?: string
  instance?: string
  traceId?: string
  /** Field name -> messages. Produced by model validation and by truncation errors. */
  errors?: Record<string, string[]>
}

export class ApiError extends Error {
  readonly status: number
  readonly problem: ProblemDetails

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail || problem.title || `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }

  /** Messages for one field, if the API reported any. */
  fieldErrors(field: string): string[] {
    if (!this.problem.errors) return []
    // Model validation keys are PascalCase; the snake_case tables report the column
    // name verbatim. Match either without forcing callers to know which.
    const key = Object.keys(this.problem.errors).find(
      (k) => k.toLowerCase() === field.toLowerCase(),
    )
    return key ? this.problem.errors[key] : []
  }
}

export function toQueryString(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    // Empty strings are dropped too: an empty search box means "no filter",
    // not "match the empty string".
    if (value === null || value === undefined || value === '') continue
    search.append(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

/**
 * Called when any request comes back 401, so the app can drop straight back to the
 * sign-in screen instead of rendering empty grids. Set once by App.
 */
let onUnauthenticated: (() => void) | null = null

export function setUnauthenticatedHandler(handler: (() => void) | null) {
  onUnauthenticated = handler
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method ?? 'GET'
  let response: Response

  try {
    response = await fetch(path, {
      ...init,
      // The session cookie is same-origin (Vite proxies /api in dev, same site in
      // production), but state this rather than relying on the default.
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    })
  } catch (err) {
    // fetch itself throws for network/CORS failures, before there's any response
    // to build an ApiError from -- log it here or it vanishes into the caller.
    logger.error(`${method} ${path} failed before a response was received`, err)
    throw err
  }

  if (!response.ok) {
    // A 401 on anything other than the session probe means the cookie expired
    // mid-session; tell the app so it can show the login screen.
    if (response.status === 401 && !path.endsWith('/api/auth/me')) {
      onUnauthenticated?.()
    }
    const problem = await readProblem(response)
    logger.error(`${method} ${path} responded ${response.status}`, problem)
    throw new ApiError(response.status, problem)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : undefined) as T
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    const body = await response.json()
    if (body && typeof body === 'object') {
      return body as ProblemDetails
    }
  } catch {
    // A non-JSON error body (a proxy failure, say) still needs to reach the user
    // as something readable.
  }
  return {
    status: response.status,
    title: 'Request failed',
    detail: `The server responded with ${response.status} ${response.statusText}.`,
  }
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
