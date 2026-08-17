export interface PagedResult<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export type SortDir = 'asc' | 'desc'

/** The list parameters every table endpoint accepts. */
export interface ListParams {
  page: number
  pageSize: number
  search?: string
  sortBy?: string
  sortDir?: SortDir
}

export const DEFAULT_PAGE_SIZE = 50
export const PAGE_SIZE_OPTIONS = [50, 100]

/**
 * Describes one database column, for building the wide forms over Import_Update (71
 * columns) and ImportFileHeader (64). Generated alongside those types from the
 * CREATE TABLE statements.
 */
export interface ColumnMeta {
  name: string
  kind: 'int' | 'text'
  /** Database column width; null for nvarchar(max). */
  maxLength: number | null
}
