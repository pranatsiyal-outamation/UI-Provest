import { http, toQueryString } from './http'
import type { ListParams, PagedResult } from './types'

const BASE = '/api/admin/clients'

export interface ClientListItem {
  Id: number
  ClientName: string | null
  ClientCode: string | null
  IsMergingEnabled: boolean | null
  IsActive: boolean
  StateColumn: string | null
  UniqueColumns: string | null
  IsZipExtractionEnabled: boolean | null
  FileNumberColumn: string | null
  ProjectSetupId: number | null
}

export interface ClientDetail extends ClientListItem {
  InboundFolder: string | null
  OutboundFolder: string | null
}

export interface ClientWriteRequest {
  ClientName: string | null
  ClientCode: string | null
  InboundFolder: string | null
  OutboundFolder: string | null
  IsMergingEnabled: boolean
  IsActive: boolean
  StateColumn: string | null
  UniqueColumns: string | null
  IsZipExtractionEnabled: boolean
  FileNumberColumn: string | null
  ProjectSetupId: number | null
}

export interface ClientFilters {
  IsActive?: boolean | ''
  IsMergingEnabled?: boolean | ''
  IsZipExtractionEnabled?: boolean | ''
  ProjectSetupId?: number | ''
}

export const clientsApi = {
  list: (params: ListParams & ClientFilters) =>
    http.get<PagedResult<ClientListItem>>(
      BASE + toQueryString(params),
    ),

  get: (id: number) => http.get<ClientDetail>(`${BASE}/${id}`),

  create: (body: ClientWriteRequest) => http.post<ClientDetail>(BASE, body),

  update: (id: number, body: ClientWriteRequest) => http.put<ClientDetail>(`${BASE}/${id}`, body),

  /**
   * Hard delete. Fails with 409 while any ProVestClientLocation or ProVestErrorLog
   * row still references the client; the error names the blocking table.
   */
  remove: (id: number) => http.delete<void>(`${BASE}/${id}`),
}

export const EMPTY_CLIENT: ClientWriteRequest = {
  ClientName: null,
  ClientCode: null,
  InboundFolder: null,
  OutboundFolder: null,
  IsMergingEnabled: false,
  IsActive: true,
  StateColumn: null,
  UniqueColumns: null,
  IsZipExtractionEnabled: false,
  FileNumberColumn: null,
  ProjectSetupId: null,
}
