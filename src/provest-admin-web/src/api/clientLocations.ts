import { http, toQueryString } from './http'
import type { ListParams, PagedResult } from './types'

const BASE = '/api/admin/client-locations'

export interface ClientLocationListItem {
  Id: number
  ProVestClientId: number
  /** Joined from ProVestClient for display. */
  ClientName: string | null
  /**
   * NOT ProVestClient.Id. This is what the importer matches against
   * Import_Update.client_id and ImportFileHeader.client_id.
   */
  LocationId: number
  State: string
  IsActive: boolean
  ProjectSetupId: number | null
}

export type ClientLocationDetail = ClientLocationListItem

export interface ClientLocationWriteRequest {
  ProVestClientId: number | null
  LocationId: number | null
  State: string
  IsActive: boolean
  ProjectSetupId: number | null
}

export interface ClientLocationFilters {
  ProVestClientId?: number | ''
  LocationId?: number | ''
  State?: string
  IsActive?: boolean | ''
  ProjectSetupId?: number | ''
}

export const clientLocationsApi = {
  list: (params: ListParams & ClientLocationFilters) =>
    http.get<PagedResult<ClientLocationListItem>>(
      BASE + toQueryString(params),
    ),

  get: (id: number) => http.get<ClientLocationDetail>(`${BASE}/${id}`),

  create: (body: ClientLocationWriteRequest) => http.post<ClientLocationDetail>(BASE, body),

  update: (id: number, body: ClientLocationWriteRequest) =>
    http.put<ClientLocationDetail>(`${BASE}/${id}`, body),

  /** Hard delete. Removing these is what unblocks deleting the parent client. */
  remove: (id: number) => http.delete<void>(`${BASE}/${id}`),
}

export const EMPTY_CLIENT_LOCATION: ClientLocationWriteRequest = {
  ProVestClientId: null,
  LocationId: null,
  State: '',
  IsActive: true,
  ProjectSetupId: null,
}
