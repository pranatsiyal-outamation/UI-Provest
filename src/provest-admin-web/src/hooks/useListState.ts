import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEFAULT_PAGE_SIZE, type ListParams, type SortDir } from '../api/types'

export interface ListState<TFilters extends object> {
  /** Debounced value -- what to send to the API. */
  params: ListParams & TFilters
  /** Live value -- what the search box should display. */
  searchInput: string
  setSearchInput: (value: string) => void
  page: number
  setPage: (page: number) => void
  pageSize: number
  setPageSize: (size: number) => void
  sortBy?: string
  sortDir: SortDir
  toggleSort: (column: string) => void
  filters: TFilters
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void
  resetFilters: () => void
}

const SEARCH_DEBOUNCE_MS = 300

/**
 * Holds page / pageSize / search / sort / filters and turns them into API query
 * parameters. Sorting, filtering and paging are entirely server-side; this only
 * tracks what to ask for.
 *
 * State lives in the URL so a filtered view can be shared or reloaded.
 */
export function useListState<TFilters extends object>(
  defaultSortBy: string,
  defaultFilters: TFilters,
): ListState<TFilters> {
  const [searchParams, setSearchParams] = useSearchParams()

  const page = Number(searchParams.get('page') ?? 1)
  const pageSize = Number(searchParams.get('pageSize') ?? DEFAULT_PAGE_SIZE)
  const sortBy = searchParams.get('sortBy') ?? defaultSortBy
  const sortDir = (searchParams.get('sortDir') as SortDir) ?? 'asc'
  const search = searchParams.get('search') ?? ''

  // The input updates on every keystroke; the URL (and therefore the request)
  // only catches up once typing pauses.
  const [searchInput, setSearchInput] = useState(search)

  useEffect(() => {
    // Only act when the typed value differs from what the URL already holds.
    //
    // This guard is load-bearing, not defensive. React Router hands back a new
    // setSearchParams whenever the URL changes, so this effect re-runs on every
    // navigation -- including paging. Without the check it would fire 300ms after
    // "next page" and reset page to 1, which looks exactly like the button not
    // working. Comparing against the URL also makes the effect idempotent under
    // StrictMode's double-invocation.
    if (searchInput === search) {
      return
    }

    const timer = setTimeout(() => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (searchInput) next.set('search', searchInput)
          else next.delete('search')
          // A new search invalidates the current page number.
          next.set('page', '1')
          return next
        },
        { replace: true },
      )
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(timer)
  }, [searchInput, search, setSearchParams])

  const update = useCallback(
    (changes: Record<string, string | undefined>, resetPage = true) => {
      setSearchParams((current) => {
        const next = new URLSearchParams(current)
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === '') next.delete(key)
          else next.set(key, value)
        }
        if (resetPage) next.set('page', '1')
        return next
      })
    },
    [setSearchParams],
  )

  const setPage = useCallback((value: number) => update({ page: String(value) }, false), [update])

  const setPageSize = useCallback(
    (value: number) => update({ pageSize: String(value) }),
    [update],
  )

  const toggleSort = useCallback(
    (column: string) => {
      const nextDir: SortDir = sortBy === column && sortDir === 'asc' ? 'desc' : 'asc'
      update({ sortBy: column, sortDir: nextDir })
    },
    [sortBy, sortDir, update],
  )

  const filters = useMemo(() => {
    // The URL only ever carries strings, so each value is coerced back to the type
    // its default indicates before being handed to the query.
    const result: Record<string, unknown> = { ...(defaultFilters as Record<string, unknown>) }
    for (const key of Object.keys(defaultFilters)) {
      const raw = searchParams.get(key)
      if (raw === null) continue

      if (raw === 'true' || raw === 'false') {
        result[key] = raw === 'true'
      } else if (raw !== '' && !Number.isNaN(Number(raw))) {
        result[key] = Number(raw)
      } else {
        result[key] = raw
      }
    }
    return result as TFilters
    // defaultFilters is a literal at the call site; keying on searchParams is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      update({
        [key as string]:
          value === undefined || value === null || value === '' ? undefined : String(value),
      })
    },
    [update],
  )

  const resetFilters = useCallback(() => {
    const cleared: Record<string, undefined> = {}
    for (const key of Object.keys(defaultFilters)) cleared[key] = undefined
    setSearchInput('')
    update({ ...cleared, search: undefined })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [update])

  const params = useMemo(
    () =>
      ({
        page,
        pageSize,
        search: search || undefined,
        sortBy,
        sortDir,
        ...filters,
      }) as ListParams & TFilters,
    [page, pageSize, search, sortBy, sortDir, filters],
  )

  return {
    params,
    searchInput,
    setSearchInput,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortBy,
    sortDir,
    toggleSort,
    filters,
    setFilter,
    resetFilters,
  }
}
