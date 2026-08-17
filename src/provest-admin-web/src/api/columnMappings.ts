import { http, toQueryString } from './http'
import type { ListParams, PagedResult } from './types'

const BASE = '/api/admin/column-mappings'

/**
 * Read-only. This table is generated from Import_Update, so ImporterId is
 * Import_Update.id and ColumnName is a client header copied out of an Import_Update
 * cell. There are deliberately no create/update/delete calls -- per-row edits would be
 * discarded the next time the mappings are rebuilt.
 */
export interface ColumnMappingListItem {
  Id: number
  ImporterId: number
  ColumnName: string
  ProVestStandardColumnId: number
  StandardColumnName: string
}

export interface ColumnMappingFilters {
  ImporterId?: number | ''
  ProVestStandardColumnId?: number | ''
}

export interface RegenerateResult {
  ImporterId: number
  RowsInserted: number
}

export const columnMappingsApi = {
  list: (params: ListParams & ColumnMappingFilters) =>
    http.get<PagedResult<ColumnMappingListItem>>(
      BASE + toQueryString(params),
    ),

  /** Deletes and rebuilds this importer's mappings from its Import_Update row. */
  regenerate: (importerId: number) =>
    http.post<RegenerateResult>(`${BASE}/regenerate`, { ImporterId: importerId }),
}
