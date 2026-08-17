import { useState } from 'react'
import { Box, Button, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteForeverIcon from '@mui/icons-material/DeleteForever'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { importUpdatesApi, type ImportUpdateFilters, type ImportUpdateListItem } from '../api/importUpdates'
import { columnMappingsApi } from '../api/columnMappings'
import { DataGrid, type Column } from '../components/DataGrid'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { ErrorBanner } from '../components/ErrorBanner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useListState } from '../hooks/useListState'
import { ImportUpdateForm } from './ImportUpdateForm'

const DEFAULT_FILTERS: ImportUpdateFilters = { id: '', client_id: '' }

const UNADDRESSABLE =
  'This row has no id, or shares its id with another row. Import_Update has no primary key, ' +
  'so it cannot be edited or deleted from here.'

const columns: Column<ImportUpdateListItem>[] = [
  { field: 'id', label: 'id', sortable: true, width: 80, align: 'right' },
  { field: 'client_id', label: 'client_id', sortable: true, width: 100, align: 'right' },
  { field: 'lawfirm_filenumber', label: 'lawfirm_filenumber', sortable: true },
  { field: 'plaintiff', label: 'plaintiff', sortable: true },
  { field: 'defendant', label: 'defendant' },
  { field: 'document_type', label: 'document_type' },
  { field: 'index_number', label: 'index_number' },
  { field: 'court_name', label: 'court_name' },
  { field: 'servee_name', label: 'servee_name' },
  { field: 'client_ref', label: 'client_ref' },
  { field: 'creditor', label: 'creditor' },
]

export function ImportUpdatesPage() {
  const list = useListState<ImportUpdateFilters>('id', DEFAULT_FILTERS)
  const queryClient = useQueryClient()

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [toDelete, setToDelete] = useState<ImportUpdateListItem | null>(null)
  const [toRegenerate, setToRegenerate] = useState<ImportUpdateListItem | null>(null)
  const [actionError, setActionError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['import-updates', list.params],
    queryFn: () => importUpdatesApi.list(list.params),
  })

  const remove = useMutation({
    mutationFn: (id: number) => importUpdatesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-updates'] })
      setToDelete(null)
    },
    onError: (err) => {
      setActionError(err)
      setToDelete(null)
    },
  })

  const regenerate = useMutation({
    mutationFn: (importerId: number) => columnMappingsApi.regenerate(importerId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['column-mappings'] })
      setToRegenerate(null)
      setNotice(
        `Rebuilt importer ${data.ImporterId}: ${data.RowsInserted} mapping row${
          data.RowsInserted === 1 ? '' : 's'
        } inserted.`,
      )
    },
    onError: (err) => {
      setActionError(err)
      setToRegenerate(null)
    },
  })

  return (
    <Box>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
            Import_Update
          </Typography>
          <Typography variant="body2" color="text.secondary">
            One row per importer layout. Cells hold the client file&rsquo;s{' '}
            <strong>header names</strong>, not case data. <code>id</code> is the Importer Id.
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
          New layout
        </Button>
      </Stack>

      <ErrorBanner error={actionError ?? query.error} onClose={() => setActionError(null)} />

      {notice && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="success.main">
            {notice}
          </Typography>
        </Box>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <SearchBar
          value={list.searchInput}
          onChange={list.setSearchInput}
          placeholder="Search file number, parties, court, creditor"
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
            <Tooltip
              title={row.IsAddressable ? "Regenerate this importer's column mappings" : UNADDRESSABLE}
            >
              <span>
                <IconButton
                  size="small"
                  color="warning"
                  disabled={!row.IsAddressable}
                  onClick={() => setToRegenerate(row)}
                >
                  <AutorenewIcon fontSize="small" />
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

      <ImportUpdateForm
        open={formOpen}
        importUpdateId={editingId}
        onClose={() => setFormOpen(false)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        title="Delete importer layout"
        confirmLabel="Delete permanently"
        busy={remove.isPending}
        message={
          <>
            Permanently delete <code>Import_Update</code> row with id{' '}
            <strong>{toDelete?.id}</strong>?
            <br />
            <br />
            Its <code>ProVestColumnMapping</code> rows are left behind and will be orphaned, and
            this table has no soft delete. There is no undo.
          </>
        }
        onConfirm={() => toDelete?.id != null && remove.mutate(toDelete.id)}
        onCancel={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={toRegenerate !== null}
        title="Regenerate column mappings"
        confirmLabel="Regenerate"
        confirmColor="warning"
        busy={regenerate.isPending}
        message={
          <>
            Delete every <code>ProVestColumnMapping</code> row for importer{' '}
            <strong>{toRegenerate?.id}</strong> and rebuild them from this row?
            <br />
            <br />
            Other importers are untouched.
          </>
        }
        onConfirm={() => toRegenerate?.id != null && regenerate.mutate(toRegenerate.id)}
        onCancel={() => setToRegenerate(null)}
      />
    </Box>
  )
}
