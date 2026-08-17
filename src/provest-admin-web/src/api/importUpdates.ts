import { http, toQueryString } from './http'
import type { ListParams, PagedResult } from './types'
import type {
  ImportUpdateDetail,
  ImportUpdateListItem,
  ImportUpdateWriteRequest,
} from './importUpdateTypes'

const BASE = '/api/admin/import-updates'

export interface ImportUpdateFilters {
  id?: number | ''
  client_id?: number | ''
}

export const importUpdatesApi = {
  list: (params: ListParams & ImportUpdateFilters) =>
    http.get<PagedResult<ImportUpdateListItem>>(
      BASE + toQueryString(params),
    ),

  get: (id: number) => http.get<ImportUpdateDetail>(`${BASE}/${id}`),

  create: (body: ImportUpdateWriteRequest) => http.post<ImportUpdateDetail>(BASE, body),

  update: (id: number, body: ImportUpdateWriteRequest) =>
    http.put<ImportUpdateDetail>(`${BASE}/${id}`, body),

  /** Hard delete. This table has no IsActive column and no soft-delete concept. */
  remove: (id: number) => http.delete<void>(`${BASE}/${id}`),
}

export type { ImportUpdateDetail, ImportUpdateListItem, ImportUpdateWriteRequest }
