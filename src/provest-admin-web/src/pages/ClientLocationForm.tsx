import { useEffect, useState } from 'react'
import {
  Alert,
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
import {
  EMPTY_CLIENT_LOCATION,
  clientLocationsApi,
  type ClientLocationWriteRequest,
} from '../api/clientLocations'
import { clientLabel, lookupsApi, projectSetupLabel } from '../api/lookups'
import { ErrorBanner } from '../components/ErrorBanner'

interface ClientLocationFormProps {
  open: boolean
  locationId: number | null
  onClose: () => void
}

export function ClientLocationForm({ open, locationId, onClose }: ClientLocationFormProps) {
  const isEdit = locationId !== null
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ClientLocationWriteRequest>(EMPTY_CLIENT_LOCATION)
  const [error, setError] = useState<unknown>(null)

  const existing = useQuery({
    queryKey: ['client-location', locationId],
    queryFn: () => clientLocationsApi.get(locationId!),
    enabled: open && isEdit,
  })

  const clients = useQuery({
    queryKey: ['lookup', 'clients'],
    queryFn: lookupsApi.clients,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  const projectSetups = useQuery({
    queryKey: ['lookup', 'project-setups'],
    queryFn: lookupsApi.projectSetups,
    staleTime: 5 * 60 * 1000,
    enabled: open,
  })

  useEffect(() => {
    if (!open) return
    setError(null)

    if (!isEdit) {
      setValues(EMPTY_CLIENT_LOCATION)
      return
    }

    if (existing.data) {
      const d = existing.data
      setValues({
        ProVestClientId: d.ProVestClientId,
        LocationId: d.LocationId,
        State: d.State,
        IsActive: d.IsActive,
        ProjectSetupId: d.ProjectSetupId,
      })
    }
  }, [open, isEdit, existing.data])

  const save = useMutation({
    mutationFn: (body: ClientLocationWriteRequest) =>
      isEdit ? clientLocationsApi.update(locationId!, body) : clientLocationsApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-locations'] })
      onClose()
    },
    onError: (err) => setError(err),
  })

  const set = <K extends keyof ClientLocationWriteRequest>(
    key: K,
    value: ClientLocationWriteRequest[K],
  ) => setValues((current) => ({ ...current, [key]: value }))

  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldErrors(field) : [])

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{isEdit ? `Edit location #${locationId}` : 'New client location'}</DialogTitle>

      <DialogContent dividers>
        <ErrorBanner error={error} onClose={() => setError(null)} />

        <Alert severity="info" sx={{ mb: 2 }}>
          <strong>Client</strong> and <strong>Location Id</strong> are different things.
          Location Id is the number the importer matches against{' '}
          <code>Import_Update.client_id</code> and <code>ImportFileHeader.client_id</code>; no
          foreign key enforces it, so a wrong value fails silently at import time.
        </Alert>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <TextField
              select
              label="Client"
              size="small"
              fullWidth
              value={values.ProVestClientId ?? ''}
              onChange={(e) =>
                set('ProVestClientId', e.target.value === '' ? null : Number(e.target.value))
              }
              error={fieldError('ProVestClientId').length > 0}
              helperText={
                fieldError('ProVestClientId').join(' ') || 'ProVestClient this location belongs to.'
              }
            >
              <MenuItem value="">
                <em>Select a client</em>
              </MenuItem>
              {(clients.data ?? []).map((client) => (
                <MenuItem key={client.Id} value={client.Id}>
                  {clientLabel(client)}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <TextField
            label="Location Id"
            size="small"
            fullWidth
            type="number"
            value={values.LocationId ?? ''}
            onChange={(e) => set('LocationId', e.target.value === '' ? null : Number(e.target.value))}
            error={fieldError('LocationId').length > 0}
            helperText={
              fieldError('LocationId').join(' ') || 'Matches client_id on the import tables.'
            }
          />

          <TextField
            label="State"
            size="small"
            fullWidth
            value={values.State}
            onChange={(e) => set('State', e.target.value)}
            error={fieldError('State').length > 0}
            helperText={fieldError('State').join(' ') || 'e.g. FL. Matched case-insensitively.'}
            slotProps={{ htmlInput: { maxLength: 30 } }}
          />

          <Box sx={{ gridColumn: '1 / -1' }}>
            <TextField
              select
              label="Project setup"
              size="small"
              fullWidth
              value={values.ProjectSetupId ?? ''}
              onChange={(e) =>
                set('ProjectSetupId', e.target.value === '' ? null : Number(e.target.value))
              }
              error={fieldError('ProjectSetupId').length > 0}
              helperText={fieldError('ProjectSetupId').join(' ') || 'Optional.'}
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
          </Box>

          <Box sx={{ gridColumn: '1 / -1' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.IsActive}
                  onChange={(e) => set('IsActive', e.target.checked)}
                />
              }
              label="Active (the importer only resolves states from active locations)"
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
