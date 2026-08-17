import { http } from './http'

export interface Session {
  username: string
  displayName: string
}

export const authApi = {
  /** Returns the session, or throws ApiError with status 401 when signed out. */
  me: () => http.get<Session>('/api/auth/me'),

  login: (username: string, password: string) =>
    http.post<Session>('/api/auth/login', { Username: username, Password: password }),

  logout: () => http.post<void>('/api/auth/logout', {}),
}
