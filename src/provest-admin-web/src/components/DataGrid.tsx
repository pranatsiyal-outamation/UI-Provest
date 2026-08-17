import type { ReactNode } from 'react'
import {
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
} from '@mui/material'
import type { SortDir } from '../api/types'

export interface Column<T> {
  /** Property on the row. Also the value sent as sortBy, when sortable. */
  field: Extract<keyof T, string>
  label: string
  sortable?: boolean
  width?: number | string
  align?: 'left' | 'right'
  /** Custom cell rendering. Defaults to the raw value. */
  render?: (row: T) => ReactNode
}

interface DataGridProps<T> {
  columns: Column<T>[]
  rows: T[]
  getRowKey: (row: T, index: number) => string | number
  sortBy?: string
  sortDir?: SortDir
  onSort?: (field: string) => void
  loading?: boolean
  emptyMessage?: string
  /**
   * True when the list request failed. Without this the grid renders "no records
   * match", which claims the data is absent when in fact nothing was ever fetched --
   * a connection failure then looks exactly like an empty search result.
   */
  hasError?: boolean
  /** Right-hand actions cell. */
  renderActions?: (row: T) => ReactNode
  /**
   * Rows the user cannot act on. Import_Update and ImportFileHeader have no primary
   * key, so a row with a null or duplicated id cannot be targeted by an update or
   * delete; those are shown, dimmed, with an explanation rather than hidden.
   */
  isRowDisabled?: (row: T) => boolean
  disabledReason?: (row: T) => string
}

/**
 * Renders whatever columns it is handed. It knows nothing about any specific table --
 * each page declares its own columns and passes them in.
 */
export function DataGrid<T>({
  columns,
  rows,
  getRowKey,
  sortBy,
  sortDir = 'asc',
  onSort,
  loading = false,
  emptyMessage = 'No records match the current filters.',
  hasError = false,
  renderActions,
  isRowDisabled,
  disabledReason,
}: DataGridProps<T>) {
  const columnCount = columns.length + (renderActions ? 1 : 0)

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ position: 'relative' }}>
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.6)',
            zIndex: 2,
          }}
        >
          <CircularProgress size={28} />
        </Box>
      )}

      {/* Wide tables scroll inside this container rather than the page. */}
      <Table size="small" stickyHeader sx={{ minWidth: 640 }}>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.field}
                align={column.align ?? 'left'}
                sx={{ width: column.width, whiteSpace: 'nowrap', fontWeight: 600 }}
                sortDirection={sortBy === column.field ? sortDir : false}
              >
                {column.sortable && onSort ? (
                  <TableSortLabel
                    active={sortBy === column.field}
                    direction={sortBy === column.field ? sortDir : 'asc'}
                    onClick={() => onSort(column.field)}
                  >
                    {column.label}
                  </TableSortLabel>
                ) : (
                  column.label
                )}
              </TableCell>
            ))}
            {renderActions && (
              <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                Actions
              </TableCell>
            )}
          </TableRow>
        </TableHead>

        <TableBody>
          {rows.length === 0 && !loading && (
            <TableRow>
              <TableCell colSpan={columnCount}>
                <Typography
                  variant="body2"
                  color={hasError ? 'error.main' : 'text.secondary'}
                  sx={{ py: 3 }}
                  align="center"
                >
                  {hasError
                    ? 'Could not load records — the request failed. See the message above.'
                    : emptyMessage}
                </Typography>
              </TableCell>
            </TableRow>
          )}

          {rows.map((row, index) => {
            const disabled = isRowDisabled?.(row) ?? false
            const reason = disabled ? disabledReason?.(row) : undefined

            const cells = (
              <TableRow
                hover
                key={getRowKey(row, index)}
                sx={disabled ? { opacity: 0.55, bgcolor: 'action.hover' } : undefined}
              >
                {columns.map((column) => (
                  <TableCell key={column.field} align={column.align ?? 'left'}>
                    {column.render ? column.render(row) : formatValue(row[column.field])}
                  </TableCell>
                ))}
                {renderActions && (
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {renderActions(row)}
                  </TableCell>
                )}
              </TableRow>
            )

            return reason ? (
              <Tooltip key={getRowKey(row, index)} title={reason} followCursor>
                {cells}
              </Tooltip>
            ) : (
              cells
            )
          })}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function formatValue(value: unknown): ReactNode {
  if (value === null || value === undefined || value === '') {
    return (
      <Typography component="span" variant="body2" color="text.disabled">
        &mdash;
      </Typography>
    )
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
