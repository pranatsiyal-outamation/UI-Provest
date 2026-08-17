import { useEffect, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  TextField,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/http'
import { EMPTY_CLIENT, clientsApi, type ClientWriteRequest } from '../api/clients'
import { lookupsApi, projectSetupLabel } from '../api/lookups'
import { ErrorBanner } from '../components/ErrorBanner'

interface ClientFormProps {
  open: boolean
  /** null means create. */
  clientId: number | null
  onClose: () => void
}

export function ClientForm({ open, clientId, onClose }: ClientFormProps) {
  const isEdit = clientId !== null
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ClientWriteRequest>(EMPTY_CLIENT)
  const [error, setError] = useState<unknown>(null)

  const existing = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId!),
    enabled: open && isEdit,
  })

  const projectSetups = useQuery({
    queryKey: ['lookup', 'project-setups'],
    queryFn: lookupsApi.projectSetups,
    // Lookups change rarely; unlike the table rows themselves they are worth caching.
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setError(null)

    if (!isEdit) {
      setValues(EMPTY_CLIENT)
      return
    }

    if (existing.data) {
      const d = existing.data
      setValues({
        ClientName: d.ClientName,
        ClientCode: d.ClientCode,
        InboundFolder: d.InboundFolder,
        OutboundFolder: d.OutboundFolder,
        IsMergingEnabled: d.IsMergingEnabled ?? false,
        IsActive: d.IsActive,
        StateColumn: d.StateColumn,
        UniqueColumns: d.UniqueColumns,
        IsZipExtractionEnabled: d.IsZipExtractionEnabled ?? false,
        FileNumberColumn: d.FileNumberColumn,
        ProjectSetupId: d.ProjectSetupId,
      })
    }
  }, [open, isEdit, existing.data])

  const save = useMutation({
    mutationFn: (body: ClientWriteRequest) =>
      isEdit ? clientsApi.update(clientId!, body) : clientsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['lookup', 'clients'] })
      onClose()
    },
    onError: (err) => setError(err),
  })

  const set = <K extends keyof ClientWriteRequest>(key: K, value: ClientWriteRequest[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  const fieldError = (field: string) =>
    error instanceof ApiError ? error.fieldErrors(field) : []

  const textField = (
    field: keyof ClientWriteRequest & string,
    label: string,
    maxLength?: number,
    extra?: { multiline?: boolean; helperText?: string },
  ) => {
    const errors = fieldError(field)
    return (
      <TextField
        label={label}
        value={(values[field] as string | null) ?? ''}
        // An emptied text box means "no value", which is NULL, not an empty string.
        onChange={(e) => set(field, (e.target.value || null) as ClientWriteRequest[typeof field])}
        error={errors.length > 0}
        helperText={errors.join(' ') || extra?.helperText}
        size="small"
        fullWidth
        multiline={extra?.multiline}
        slotProps={maxLength ? { htmlInput: { maxLength } } : undefined}
      />
    )
  }

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle>{isEdit ? `Edit client #${clientId}` : 'New client'}</DialogTitle>

      <DialogContent dividers>
        <ErrorBanner error={error} onClose={() => setError(null)} />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
          {textField('ClientName', 'Client name', 100)}
          {textField('ClientCode', 'Client code', 100, {
            helperText: 'Matched case-insensitively by the importer.',
          })}

          <Box sx={{ gridColumn: '1 / -1' }}>
            {textField('InboundFolder', 'Inbound folder', undefined, { multiline: true })}
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            {textField('OutboundFolder', 'Outbound folder', undefined, { multiline: true })}
          </Box>

          {textField('StateColumn', 'State column', 500, {
            helperText: 'Header name(s) in the client file holding the state.',
          })}
          {textField('UniqueColumns', 'Unique columns', 500)}
          {textField('FileNumberColumn', 'File number column', 200)}

          <TextField
            select
            label="Project setup"
            size="small"
            fullWidth
            value={values.ProjectSetupId ?? ''}
            onChange={(e) => set('ProjectSetupId', e.target.value === '' ? null : Number(e.target.value))}
            helperText={fieldError('ProjectSetupId').join(' ') || 'Optional.'}
            error={fieldError('ProjectSetupId').length > 0}
          >
            <MenuItem value="">
              <em>None</em>
            </MenuItem>
            {(projectSetups.data ?? []).map((setup) => (
              <MenuItem key={setup.Id} value={setup.Id}>
                {projectSetupLabel(setup)}
              </MenuItem>
            ))}
          </TextField>

          <Box sx={{ gridColumn: '1 / -1', display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.IsActive}
                  onChange={(e) => set('IsActive', e.target.checked)}
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.IsMergingEnabled}
                  onChange={(e) => set('IsMergingEnabled', e.target.checked)}
                />
              }
              label="Merging enabled"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.IsZipExtractionEnabled}
                  onChange={(e) => set('IsZipExtractionEnabled', e.target.checked)}
                />
              }
              label="Zip extraction enabled"
            />
          </Box>
        </Box>
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
