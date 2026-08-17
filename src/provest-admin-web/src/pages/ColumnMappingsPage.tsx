import { useState } from 'react'
import { Alert, Box, Button, MenuItem, Stack, TextField, Typography } from '@mui/material'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  columnMappingsApi,
  type ColumnMappingFilters,
  type ColumnMappingListItem,
} from '../api/columnMappings'
import { lookupsApi } from '../api/lookups'
import { DataGrid, type Column } from '../components/DataGrid'
import { Pagination } from '../components/Pagination'
import { SearchBar } from '../components/SearchBar'
import { ErrorBanner } from '../components/ErrorBanner'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useListState } from '../hooks/useListState'

const DEFAULT_FILTERS: ColumnMappingFilters = {
  ImporterId: '',
  ProVestStandardColumnId: '',
}

const columns: Column<ColumnMappingListItem>[] = [
  { field: 'Id', label: 'Id', sortable: true, width: 80 },
  { field: 'ImporterId', label: 'Importer Id', sortable: true, width: 110, align: 'right' },
  { field: 'ColumnName', label: 'Client header', sortable: true },
  { field: 'StandardColumnName', label: 'ProVest standard column', sortable: true },
  {
    field: 'ProVestStandardColumnId',
    label: 'Standard column Id',
    width: 150,
    align: 'right',
  },
]

export function ColumnMappingsPage() {
  const list = useListState<ColumnMappingFilters>('ImporterId', DEFAULT_FILTERS)
  const queryClient = useQueryClient()

  const [regenerateId, setRegenerateId] = useState<string>('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [actionError, setActionError] = useState<unknown>(null)
  const [result, setResult] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['column-mappings', list.params],
    queryFn: () => columnMappingsApi.list(list.params),
  })

  const standardColumns = useQuery({
    queryKey: ['lookup', 'standard-columns'],
    queryFn: lookupsApi.standardColumns,
    staleTime: 5 * 60 * 1000,
  })

  const regenerate = useMutation({
    mutationFn: (importerId: number) => columnMappingsApi.regenerate(importerId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['column-mappings'] })
      setConfirmOpen(false)
      setResult(
        `Rebuilt importer ${data.ImporterId}: ${data.RowsInserted} mapping row${
          data.RowsInserted === 1 ? '' : 's'
        } inserted.`,
      )
    },
    onError: (err) => {
      setActionError(err)
      setConfirmOpen(false)
    },
  })

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontFamily: 'monospace' }}>
          ProVestColumnMapping
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Read-only. Generated from <code>Import_Update</code>.
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        This table is <strong>derived</strong>, not authored. Each row comes from a cell of the
        matching <code>Import_Update</code> row, where <code>Importer Id</code> is{' '}
        <code>Import_Update.id</code>. Editing rows here directly would be undone the next time the
        mappings are rebuilt, so edit <code>Import_Update</code> and then regenerate.
      </Alert>

      <ErrorBanner error={actionError ?? query.error} onClose={() => setActionError(null)} />

      {result && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setResult(null)}>
          {result}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <SearchBar
          value={list.searchInput}
          onChange={list.setSearchInput}
          placeholder="Search client header or standard column"
          width={320}
        />

        <TextField
          size="small"
          label="Importer Id"
          type="number"
          sx={{ width: 130 }}
          value={list.filters.ImporterId ?? ''}
          onChange={(e) =>
            list.setFilter('ImporterId', (e.target.value === '' ? '' : Number(e.target.value)) as never)
          }
        />

        <TextField
          select
          size="small"
          label="Standard column"
          sx={{ minWidth: 240 }}
          value={list.filters.ProVestStandardColumnId ?? ''}
          onChange={(e) =>
            list.setFilter(
              'ProVestStandardColumnId',
              (e.target.value === '' ? '' : Number(e.target.value)) as never,
            )
          }
        >
          <MenuItem value="">Any</MenuItem>
          {(standardColumns.data ?? []).map((column) => (
            <MenuItem key={column.Id} value={column.Id}>
              {column.ColumnName}
            </MenuItem>
          ))}
        </TextField>

        <Button onClick={list.resetFilters}>Reset</Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        sx={{
          mb: 2,
          p: 1.5,
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          alignItems: 'center',
        }}
      >
        <Typography variant="body2" sx={{ mr: 1 }}>
          Regenerate mappings for importer
        </Typography>
        <TextField
          size="small"
          type="number"
          label="Importer Id"
          sx={{ width: 140 }}
          value={regenerateId}
          onChange={(e) => setRegenerateId(e.target.value)}
        />
        <Button
          variant="outlined"
          startIcon={<AutorenewIcon />}
          disabled={regenerateId === ''}
          onClick={() => setConfirmOpen(true)}
        >
          Regenerate
        </Button>
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

      <ConfirmDialog
        open={confirmOpen}
        title="Regenerate mappings"
        confirmLabel="Regenerate"
        confirmColor="warning"
        busy={regenerate.isPending}
        message={
          <>
            Delete every <code>ProVestColumnMapping</code> row for importer{' '}
            <strong>{regenerateId}</strong> and rebuild them from that importer&rsquo;s{' '}
            <code>Import_Update</code> row?
            <br />
            <br />
            Other importers are untouched. This changes what the importer maps for this client, so
            confirm the <code>Import_Update</code> row is correct first.
          </>
        }
        onConfirm={() => regenerate.mutate(Number(regenerateId))}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  )
}
