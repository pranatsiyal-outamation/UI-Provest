import { http, toQueryString } from './http'
import type { ListParams, PagedResult } from './types'
import type {
  ImportFileHeaderDetail,
  ImportFileHeaderListItem,
  ImportFileHeaderWriteRequest,
} from './importFileHeaderTypes'

const BASE = '/api/admin/import-file-headers'

export interface ImportFileHeaderFilters {
  id?: number | ''
  client_id?: number | ''
  importer_id?: number | ''
}

export const importFileHeadersApi = {
  list: (params: ListParams & ImportFileHeaderFilters) =>
    http.get<PagedResult<ImportFileHeaderListItem>>(
      BASE + toQueryString(params),
    ),

  get: (id: number) => http.get<ImportFileHeaderDetail>(`${BASE}/${id}`),

  create: (body: ImportFileHeaderWriteRequest) => http.post<ImportFileHeaderDetail>(BASE, body),

  update: (id: number, body: ImportFileHeaderWriteRequest) =>
    http.put<ImportFileHeaderDetail>(`${BASE}/${id}`, body),

  remove: (id: number) => http.delete<void>(`${BASE}/${id}`),
}

export type { ImportFileHeaderDetail, ImportFileHeaderListItem, ImportFileHeaderWriteRequest }
