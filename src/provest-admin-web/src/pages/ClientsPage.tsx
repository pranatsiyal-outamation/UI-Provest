import { useState } from 'react'
import { Box, Button, Chip, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clientsApi, type ClientFilters, type ClientListItem } from '../api/clients'
import { DataGrid, type Column } from '../components/DataGrid'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { ErrorBanner } from '../components/ErrorBanner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useListState } from '../hooks/useListState'
import { ClientForm } from './ClientForm'

const DEFAULT_FILTERS: ClientFilters = {
  IsActive: '',
  IsMergingEnabled: '',
  IsZipExtractionEnabled: '',
  ProjectSetupId: '',
}

const columns: Column<ClientListItem>[] = [
  { field: 'Id', label: 'Id', sortable: true, width: 70 },
  { field: 'ClientName', label: 'Client name', sortable: true },
  { field: 'ClientCode', label: 'Client code', sortable: true, width: 130 },
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
  { field: 'StateColumn', label: 'State column' },
  { field: 'UniqueColumns', label: 'Unique columns' },
  { field: 'FileNumberColumn', label: 'File number column' },
  { field: 'IsMergingEnabled', label: 'Merging', width: 90 },
  { field: 'IsZipExtractionEnabled', label: 'Zip', width: 70 },
  { field: 'ProjectSetupId', label: 'Project setup', width: 110, align: 'right' },
]

export function ClientsPage() {
  const list = useListState<ClientFilters>('ClientName', DEFAULT_FILTERS)
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [toDelete, setToDelete] = useState<ClientListItem | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)

  const query = useQuery({
    queryKey: ['clients', list.params],
    queryFn: () => clientsApi.list(list.params),
  })

  const remove = useMutation({
    mutationFn: (id: number) => clientsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      // Deleting a client frees up its locations view too.
      queryClient.invalidateQueries({ queryKey: ['lookup', 'clients'] })
      setToDelete(null)
    },
    onError: (err) => {
      // Typically 409: ProVestClientLocation or ProVestErrorLog rows still reference
      // this client. The banner carries the database's own explanation.
      setActionError(err)
      setToDelete(null)
    },
  })

  const openCreate = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (row: ClientListItem) => {
    setEditingId(row.Id)
    setFormOpen(true)
  }

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
            ProVestClient
          </Typography>
          <Typography variant="body2" color="text.secondary">
            One row per ProVest client. Deleting is a deactivation &mdash; locations and
            error-log rows reference these.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          New client
        </Button>
      </Stack>

      <ErrorBanner error={actionError ?? query.error} onClose={() => setActionError(null)} />

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <SearchBar
          value={list.searchInput}
          onChange={list.setSearchInput}
          placeholder="Search name, code, columns"
          helperText="Case-insensitive, matching the database collation."
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

        <TextField
          select
          size="small"
          label="Merging"
          sx={{ minWidth: 130 }}
          value={list.filters.IsMergingEnabled ?? ''}
          onChange={(e) =>
            list.setFilter(
              'IsMergingEnabled',
              (e.target.value === '' ? '' : e.target.value === 'true') as never,
            )
          }
        >
          <MenuItem value="">Any</MenuItem>
          <MenuItem value="true">Enabled</MenuItem>
          <MenuItem value="false">Disabled</MenuItem>
        </TextField>

        <TextField
          select
          size="small"
          label="Zip extraction"
          sx={{ minWidth: 150 }}
          value={list.filters.IsZipExtractionEnabled ?? ''}
          onChange={(e) =>
            list.setFilter(
              'IsZipExtractionEnabled',
              (e.target.value === '' ? '' : e.target.value === 'true') as never,
            )
          }
        >
          <MenuItem value="">Any</MenuItem>
          <MenuItem value="true">Enabled</MenuItem>
          <MenuItem value="false">Disabled</MenuItem>
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
              <IconButton size="small" onClick={() => openEdit(row)}>
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

      <ClientForm open={formOpen} clientId={editingId} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete client"
        confirmLabel="Delete permanently"
        busy={remove.isPending}
        message={
          <>
            Permanently delete <strong>{toDelete?.ClientName ?? `client #${toDelete?.Id}`}</strong>?
            <br />
            <br />
            The database will refuse this while any ProVestClientLocation or ProVestErrorLog row
            still references the client &mdash; delete those first. If it succeeds, there is no
            undo.
          </>
        }
        onConfirm={() => toDelete && remove.mutate(toDelete.Id)}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
