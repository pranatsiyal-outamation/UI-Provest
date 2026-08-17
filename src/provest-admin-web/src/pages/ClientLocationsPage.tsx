import { useState } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  clientLocationsApi,
  type ClientLocationFilters,
  type ClientLocationListItem,
} from '../api/clientLocations'
import { clientLabel, lookupsApi } from '../api/lookups'
import { DataGrid, type Column } from '../components/DataGrid'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { ErrorBanner } from '../components/ErrorBanner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useListState } from '../hooks/useListState'
import { ClientLocationForm } from './ClientLocationForm'

const DEFAULT_FILTERS: ClientLocationFilters = {
  ProVestClientId: '',
  LocationId: '',
  State: '',
  IsActive: '',
  ProjectSetupId: '',
}

const columns: Column<ClientLocationListItem>[] = [
  { field: 'Id', label: 'Id', sortable: true, width: 70 },
  { field: 'ProVestClientId', label: 'Client Id', sortable: true, width: 90, align: 'right' },
  { field: 'ClientName', label: 'Client' },
  {
    field: 'LocationId',
    label: 'Location Id',
    sortable: true,
    width: 110,
    align: 'right',
  },
  { field: 'State', label: 'State', sortable: true, width: 90 },
  {
    field: 'IsActive',
    label: 'Active',
    sortable: true,
    width: 90,
    render: (row) => (
      <Chip
        size="small"
        label={row.IsActive ? 'Active' : 'Inactive'}
        color={row.IsActive ? 'success' : 'default'}
        variant={row.IsActive ? 'filled' : 'outlined'}
      />
    ),
  },
  { field: 'ProjectSetupId', label: 'Project setup', width: 110, align: 'right' },
]

export function ClientLocationsPage() {
  const list = useListState<ClientLocationFilters>('ProVestClientId', DEFAULT_FILTERS)
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [toDelete, setToDelete] = useState<ClientLocationListItem | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)

  const query = useQuery({
    queryKey: ['client-locations', list.params],
    queryFn: () => clientLocationsApi.list(list.params),
  })

  const clients = useQuery({
    queryKey: ['lookup', 'clients'],
    queryFn: lookupsApi.clients,
    staleTime: 5 * 60 * 1000,
  })

  const remove = useMutation({
    mutationFn: (id: number) => clientLocationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-locations'] })
      setToDelete(null)
    },
    onError: (err) => {
      setActionError(err)
      setToDelete(null)
    },
  })

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
            ProVestClientLocation
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Maps a client and state to the <strong>Location Id</strong> the importer looks for on
            the import tables. Not the same as Client Id.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEditingId(null)
            setFormOpen(true)
          }}
        >
          New location
        </Button>
      </Stack>

      <ErrorBanner error={actionError ?? query.error} onClose={() => setActionError(null)} />

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <SearchBar
          value={list.searchInput}
          onChange={list.setSearchInput}
          placeholder="Search client or state"
          width={260}
        />

        <TextField
          select
          size="small"
          label="Client"
          sx={{ minWidth: 240 }}
          value={list.filters.ProVestClientId ?? ''}
          onChange={(e) =>
            list.setFilter(
              'ProVestClientId',
              (e.target.value === '' ? '' : Number(e.target.value)) as never,
            )
          }
        >
          <MenuItem value="">Any</MenuItem>
          {(clients.data ?? []).map((client) => (
            <MenuItem key={client.Id} value={client.Id}>
              {clientLabel(client)}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          size="small"
          label="Location Id"
          type="number"
          sx={{ width: 130 }}
          value={list.filters.LocationId ?? ''}
          onChange={(e) =>
            list.setFilter('LocationId', (e.target.value === '' ? '' : Number(e.target.value)) as never)
          }
        />

        <TextField
          select
          size="small"
          label="Active"
          sx={{ minWidth: 130 }}
          value={list.filters.IsActive ?? ''}
          onChange={(e) =>
            list.setFilter('IsActive', (e.target.value === '' ? '' : e.target.value === 'true') as never)
          }
        >
          <MenuItem value="">Any</MenuItem>
          <MenuItem value="true">Active</MenuItem>
          <MenuItem value="false">Inactive</MenuItem>
        </TextField>

        <Button onClick={list.resetFilters}>Reset</Button>
      </Stack>

      <DataGrid
        columns={columns}
        rows={query.data?.items ?? []}
        getRowKey={(row) => row.Id}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSort={list.toggleSort}
        loading={query.isFetching}
        hasError={query.isError}
        renderActions={(row) => (
          <>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => {
                  setEditingId(row.Id)
                  setFormOpen(true)
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Delete permanently">
              <IconButton size="small" color="error" onClick={() => setToDelete(row)}>
                <DeleteForeverIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        )}
      />

      <Pagination
        page={query.data?.page ?? list.page}
        pageSize={query.data?.pageSize ?? list.pageSize}
        totalCount={query.data?.totalCount ?? 0}
        totalPages={query.data?.totalPages ?? 0}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        disabled={query.isFetching}
      />

      <ClientLocationForm
        open={formOpen}
        locationId={editingId}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete location"
        confirmLabel="Delete permanently"
        busy={remove.isPending}
        message={
          <>
            Permanently delete the <strong>{toDelete?.State}</strong> location for{' '}
            <strong>{toDelete?.ClientName ?? `client #${toDelete?.ProVestClientId}`}</strong>?
            <br />
            <br />
            The importer will stop resolving {toDelete?.State} to Location Id{' '}
            {toDelete?.LocationId}, and any <code>Import_Update</code> or{' '}
            <code>ImportFileHeader</code> rows using that Location Id will no longer match a
            client. There is no undo.
          </>
        }
        onConfirm={() => toDelete && remove.mutate(toDelete.Id)}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
