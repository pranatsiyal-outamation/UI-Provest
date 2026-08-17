import { TextField } from '@mui/material'
import type { ColumnMeta } from '../api/types'

interface ColumnFieldProps {
  column: ColumnMeta
  value: string | number | null
  onChange: (value: string | number | null) => void
  errors?: string[]
  disabled?: boolean
  helperText?: string
}

/**
 * One input for one database column, driven by the generated ColumnMeta.
 *
 * Used only by the Import_Update and ImportFileHeader forms, where hand-writing 71
 * and 64 near-identical inputs would be the less reliable option. Every other form
 * lays its fields out explicitly.
 */
export function ColumnField({
  column,
  value,
  onChange,
  errors = [],
  disabled = false,
  helperText,
}: ColumnFieldProps) {
  const isMax = column.maxLength === null && column.kind === 'text'

  return (
    <TextField
      label={column.name}
      size="small"
      fullWidth
      disabled={disabled}
      type={column.kind === 'int' ? 'number' : 'text'}
      multiline={isMax}
      minRows={isMax ? 2 : undefined}
      value={value ?? ''}
      onChange={(event) => {
        const raw = event.target.value
        // A cleared box means NULL, not an empty string -- these columns are nullable
        // and the importer treats null and '' differently.
        if (raw === '') {
          onChange(null)
        } else {
          onChange(column.kind === 'int' ? Number(raw) : raw)
        }
      }}
      error={errors.length > 0}
      helperText={errors.join(' ') || helperText}
      slotProps={
        column.maxLength !== null && column.kind === 'text'
          ? { htmlInput: { maxLength: column.maxLength } }
          : undefined
      }
      sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 13 } }}
    />
  )
}
