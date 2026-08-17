import { Box, IconButton, MenuItem, Select, Typography } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import FirstPageIcon from '@mui/icons-material/FirstPage'
import LastPageIcon from '@mui/icons-material/LastPage'
import { PAGE_SIZE_OPTIONS } from '../api/types'

interface PaginationProps {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
  disabled?: boolean
}

/**
 * Server-side paging controls. The page size options are capped at 100, matching the
 * limit the stored procedures enforce.
 */
export function Pagination({
  page,
  pageSize,
  totalCount,
  totalPages,
  onPageChange,
  onPageSizeChange,
  disabled = false,
}: PaginationProps) {
  const first = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, totalCount)

  const atStart = page <= 1
  const atEnd = page >= totalPages

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 2,
        py: 1,
        flexWrap: 'wrap',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Rows per page
        </Typography>
        <Select
          size="small"
          value={pageSize}
          disabled={disabled}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          sx={{ minWidth: 76 }}
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <MenuItem key={size} value={size}>
              {size}
            </MenuItem>
          ))}
        </Select>
      </Box>

      <Typography variant="body2" color="text.secondary">
        {first.toLocaleString()}&ndash;{last.toLocaleString()} of {totalCount.toLocaleString()}
      </Typography>

      <Box>
        <IconButton
          size="small"
          disabled={disabled || atStart}
          onClick={() => onPageChange(1)}
          aria-label="First page"
        >
          <FirstPageIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={disabled || atStart}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={disabled || atEnd}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon fontSize="small" />
        </IconButton>
        <IconButton
          size="small"
          disabled={disabled || atEnd}
          onClick={() => onPageChange(totalPages)}
          aria-label="Last page"
        >
          <LastPageIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  )
}
