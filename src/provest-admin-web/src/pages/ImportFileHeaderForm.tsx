import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/http'
import { importFileHeadersApi } from '../api/importFileHeaders'
import {
  IMPORT_FILE_HEADER_COLUMNS,
  IMPORT_FILE_HEADER_EMPTY,
  type ImportFileHeaderWriteRequest,
} from '../api/importFileHeaderTypes'
import { ColumnField } from '../components/ColumnField'
import { ErrorBanner } from '../components/ErrorBanner'

interface ImportFileHeaderFormProps {
  open: boolean
  headerId: number | null
  onClose: () => void
}

const KEY_COLUMNS = ['id', 'client_id', 'importer_id']

export function ImportFileHeaderForm({ open, headerId, onClose }: ImportFileHeaderFormProps) {
  const isEdit = headerId !== null
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ImportFileHeaderWriteRequest>(IMPORT_FILE_HEADER_EMPTY)
  const [error, setError] = useState<unknown>(null)

  const existing = useQuery({
    queryKey: ['import-file-header', headerId],
    queryFn: () => importFileHeadersApi.get(headerId!),
    enabled: open && isEdit,
  })

  useEffect(() => {
    if (!open) return
    setError(null)
    if (!isEdit) setValues(IMPORT_FILE_HEADER_EMPTY)
    else if (existing.data) setValues(existing.data)
  }, [open, isEdit, existing.data])

  const save = useMutation({
    mutationFn: (body: ImportFileHeaderWriteRequest) =>
      isEdit ? importFileHeadersApi.update(headerId!, body) : importFileHeadersApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-file-headers'] })
      onClose()
    },
    onError: (err) => setError(err),
  })

  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldErrors(field) : [])

  const set = (name: string, value: string | number | null) =>
    setValues((current) => ({ ...current, [name]: value }))

  const keyColumns = useMemo(
    () => IMPORT_FILE_HEADER_COLUMNS.filter((c) => KEY_COLUMNS.includes(c.name)),
    [],
  )
  const colColumns = useMemo(
    () => IMPORT_FILE_HEADER_COLUMNS.filter((c) => c.name.startsWith('col_')),
    [],
  )
  const uniqueKeyColumn = useMemo(
    () => IMPORT_FILE_HEADER_COLUMNS.find((c) => c.name === 'unique_key')!,
    [],
  )

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {isEdit ? `Edit import file header (id ${headerId})` : 'New import file header'}
      </DialogTitle>

      <DialogContent dividers>
        <ErrorBanner error={error} onClose={() => setError(null)} />

        <Alert severity="info" sx={{ mb: 2 }}>
          <code>unique_key</code> is the client file&rsquo;s header row concatenated, and it is
          what the importer matches to resolve an Importer Id. Changing it, or changing any{' '}
          <code>col_n</code> without updating it, will stop that client&rsquo;s files from
          resolving.
        </Alert>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, mb: 3 }}>
          {keyColumns.map((column) => (
            <ColumnField
              key={column.name}
              column={column}
              value={values[column.name as keyof ImportFileHeaderWriteRequest] as string | number | null}
              onChange={(value) => set(column.name, value)}
              errors={fieldError(column.name)}
              disabled={isEdit && column.name === 'id'}
              helperText={
                column.name === 'id' && isEdit
                  ? 'Not editable: other rows reference it.'
                  : column.name === 'client_id'
                    ? 'ProVestClientLocation.LocationId'
                    : undefined
              }
            />
          ))}
        </Box>

        <Box sx={{ mb: 3 }}>
          <ColumnField
            column={uniqueKeyColumn}
            value={values.unique_key}
            onChange={(value) => set('unique_key', value)}
            errors={fieldError('unique_key')}
          />
        </Box>

        <Accordion defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="subtitle2">Header columns (col_1 &ndash; col_60)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 2 }}>
              {colColumns.map((column) => (
                <ColumnField
                  key={column.name}
                  column={column}
                  value={
                    values[column.name as keyof ImportFileHeaderWriteRequest] as string | number | null
                  }
                  onChange={(value) => set(column.name, value)}
                  errors={fieldError(column.name)}
                />
              ))}
            </Box>
          </AccordionDetails>
        </Accordion>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={save.isPending}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => save.mutate(values)}
          disabled={save.isPending || (isEdit && existing.isLoading)}
        >
          {save.isPending ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
