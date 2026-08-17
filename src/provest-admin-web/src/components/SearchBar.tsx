import { IconButton, InputAdornment, TextField } from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import SearchIcon from '@mui/icons-material/Search'

interface SearchBarProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  helperText?: string
  width?: number | string
}

/**
 * Plain controlled input. The 300 ms debounce lives in useListState, so typing does
 * not issue a request per keystroke.
 *
 * Searching is case-insensitive because the database collation is; nothing here
 * changes the case of what is typed or stored.
 */
export function SearchBar({
  value,
  onChange,
  placeholder = 'Search',
  helperText,
  width = 340,
}: SearchBarProps) {
  return (
    <TextField
      size="small"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      helperText={helperText}
      sx={{ width }}
      slotProps={{
        input: {
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onChange('')} aria-label="Clear search">
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : undefined,
        },
      }}
    />
  )
}
