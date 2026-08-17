import { useState } from 'react'
import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  importFileHeadersApi,
  type ImportFileHeaderFilters,
  type ImportFileHeaderListItem,
} from '../api/importFileHeaders'
import { DataGrid, type Column } from '../components/DataGrid'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { ErrorBanner } from '../components/ErrorBanner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useListState } from '../hooks/useListState'
import { ImportFileHeaderForm } from './ImportFileHeaderForm'

const DEFAULT_FILTERS: ImportFileHeaderFilters = {
  id: '',
  client_id: '',
  importer_id: '',
}

const UNADDRESSABLE =
  'This row has no id, or shares its id with another row. ImportFileHeader has no primary ' +
  'key, so it cannot be edited or deleted from here.'

const columns: Column<ImportFileHeaderListItem>[] = [
  { field: 'id', label: 'id', sortable: true, width: 80, align: 'right' },
  { field: 'client_id', label: 'client_id', sortable: true, width: 100, align: 'right' },
  { field: 'importer_id', label: 'importer_id', sortable: true, width: 110, align: 'right' },
  { field: 'col_1', label: 'col_1' },
  { field: 'col_2', label: 'col_2' },
  { field: 'col_3', label: 'col_3' },
  { field: 'col_4', label: 'col_4' },
  { field: 'col_5', label: 'col_5' },
  { field: 'col_6', label: 'col_6' },
  { field: 'col_7', label: 'col_7' },
  { field: 'col_8', label: 'col_8' },
  {
    field: 'unique_key_preview',
    label: 'unique_key',
    render: (row) => (
      <Tooltip title={row.unique_key_preview ?? ''}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            fontSize: 12,
            maxWidth: 280,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {row.unique_key_preview ?? '—'}
        </Typography>
      </Tooltip>
    ),
  },
]

export function ImportFileHeadersPage() {
  const list = useListState<ImportFileHeaderFilters>('client_id', DEFAULT_FILTERS)
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [toDelete, setToDelete] = useState<ImportFileHeaderListItem | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)

  const query = useQuery({
    queryKey: ['import-file-headers', list.params],
    queryFn: () => importFileHeadersApi.list(list.params),
  })

  const remove = useMutation({
    mutationFn: (id: number) => importFileHeadersApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-file-headers'] })
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
            ImportFileHeader
          </Typography>
          <Typography variant="body2" color="text.secondary">
            One row per importer layout. <code>col_1..col_60</code> hold the client file&rsquo;s
            header row; <code>client_id</code> is a Location Id.
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
          New header
        </Button>
      </Stack>

      <ErrorBanner error={actionError ?? query.error} onClose={() => setActionError(null)} />

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <SearchBar
          value={list.searchInput}
          onChange={list.setSearchInput}
          placeholder="Search unique_key"
          helperText="unique_key is every header concatenated, so this searches all 60 columns."
          width={360}
        />

        <TextField
          size="small"
          label="id"
          type="number"
          sx={{ width: 110 }}
          value={list.filters.id ?? ''}
          onChange={(e) => list.setFilter('id', (e.target.value === '' ? '' : Number(e.target.value)) as never)}
        />
        <TextField
          size="small"
          label="client_id"
          type="number"
          sx={{ width: 120 }}
          value={list.filters.client_id ?? ''}
          onChange={(e) =>
            list.setFilter('client_id', (e.target.value === '' ? '' : Number(e.target.value)) as never)
          }
        />
        <TextField
          size="small"
          label="importer_id"
          type="number"
          sx={{ width: 130 }}
          value={list.filters.importer_id ?? ''}
          onChange={(e) =>
            list.setFilter('importer_id', (e.target.value === '' ? '' : Number(e.target.value)) as never)
          }
        />

        <Button onClick={list.resetFilters}>Reset</Button>
      </Stack>

      <DataGrid
        columns={columns}
        rows={query.data?.items ?? []}
        getRowKey={(row, index) => `${row.id ?? 'null'}-${index}`}
        sortBy={list.sortBy}
        sortDir={list.sortDir}
        onSort={list.toggleSort}
        loading={query.isFetching}
        hasError={query.isError}
        isRowDisabled={(row) => !row.IsAddressable}
        disabledReason={() => UNADDRESSABLE}
        renderActions={(row) => (
          <>
            <Tooltip title={row.IsAddressable ? 'Edit' : UNADDRESSABLE}>
              <span>
                <IconButton
                  size="small"
                  disabled={!row.IsAddressable}
                  onClick={() => {
                    setEditingId(row.id)
                    setFormOpen(true)
                  }}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title={row.IsAddressable ? 'Delete permanently' : UNADDRESSABLE}>
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={!row.IsAddressable}
                  onClick={() => setToDelete(row)}
                >
                  <DeleteForeverIcon fontSize="small" />
                </IconButton>
              </span>
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

      <ImportFileHeaderForm open={formOpen} headerId={editingId} onClose={() => setFormOpen(false)} />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete import file header"
        confirmLabel="Delete permanently"
        busy={remove.isPending}
        message={
          <>
            Permanently delete <code>ImportFileHeader</code> row with id{' '}
            <strong>{toDelete?.id}</strong> (client_id {toDelete?.client_id}, importer_id{' '}
            {toDelete?.importer_id})?
            <br />
            <br />
            This table has no soft delete. Files from that client will stop resolving to an
            Importer Id, and there is no undo.
          </>
        }
        onConfirm={() => toDelete?.id != null && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />
    </Box>
  )
}
