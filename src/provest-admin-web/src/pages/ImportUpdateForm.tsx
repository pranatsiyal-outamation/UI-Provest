import { useEffect, useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../api/http'
import { importUpdatesApi } from '../api/importUpdates'
import {
  IMPORT_UPDATE_COLUMNS,
  IMPORT_UPDATE_EMPTY,
  type ImportUpdateWriteRequest,
} from '../api/importUpdateTypes'
import { ColumnField } from '../components/ColumnField'
import { ErrorBanner } from '../components/ErrorBanner'

interface ImportUpdateFormProps {
  open: boolean
  importUpdateId: number | null
  onClose: () => void
}

/**
 * 71 fields in one flat list is unusable, so they are grouped. This grouping is
 * specific to Import_Update and lives here rather than in shared configuration.
 */
const GROUPS: { title: string; fields: string[] }[] = [
  { title: 'Identity', fields: ['id', 'client_id', 'lawfirm_filenumber', '3rdparty_filenumber'] },
  {
    title: 'Parties',
    fields: ['plaintiff', 'plaintiff2', 'defendant', 'defendant2', 'creditor', 'client_ref'],
  },
  {
    title: 'Court',
    fields: [
      'document_code', 'document_type', 'index_number', 'court_name', 'court_type',
      'court_county', 'court_city', 'court_state', 'court_zip', 'court_date', 'court_time',
      'court_room', 'court_room2', 'date_kase_filed', 'date_due', 'def_ordinal',
    ],
  },
  {
    title: 'Servee 1',
    fields: [
      'servee_last_name', 'servee_name', 'servee_address', 'servee_apt',
      'servee_city', 'servee_state', 'servee_zip',
    ],
  },
  {
    title: 'Servee 2',
    fields: [
      'servee_last_name2', 'servee_name2', 'servee_address2', 'servee_apt2',
      'servee_city2', 'servee_state2', 'servee_zip2',
    ],
  },
  {
    title: 'Employer',
    fields: [
      'employer_name', 'employer_address1', 'employer_address2',
      'employer_city', 'employer_state', 'employer_zip',
    ],
  },
  {
    title: 'Financial',
    fields: [
      'suit_amt', 'principal', 'interest', 'court_cost', 'atty_cost', 'chargeoff_date',
      'kasebilling_checknum', 'kasebilling_amt', 'date_prepaid_check',
    ],
  },
  {
    title: 'Additional',
    fields: [
      'special_instructions',
      'additional_info1', 'additional_info2', 'additional_info3', 'additional_info4', 'additional_info5',
      'client_data1', 'client_data2', 'client_data3', 'client_data4',
      'client_data5', 'client_data6', 'client_data7', 'client_data8',
      'misc_1', 'dob',
    ],
  },
]

export function ImportUpdateForm({ open, importUpdateId, onClose }: ImportUpdateFormProps) {
  const isEdit = importUpdateId !== null
  const queryClient = useQueryClient()
  const [values, setValues] = useState<ImportUpdateWriteRequest>(IMPORT_UPDATE_EMPTY)
  const [error, setError] = useState<unknown>(null)

  const existing = useQuery({
    queryKey: ['import-update', importUpdateId],
    queryFn: () => importUpdatesApi.get(importUpdateId!),
    enabled: open && isEdit,
  })

  useEffect(() => {
    if (!open) return
    setError(null)
    if (!isEdit) setValues(IMPORT_UPDATE_EMPTY)
    else if (existing.data) setValues(existing.data)
  }, [open, isEdit, existing.data])

  const save = useMutation({
    mutationFn: (body: ImportUpdateWriteRequest) =>
      isEdit ? importUpdatesApi.update(importUpdateId!, body) : importUpdatesApi.create(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['import-updates'] })
      queryClient.invalidateQueries({ queryKey: ['column-mappings'] })
      onClose()
    },
    onError: (err) => setError(err),
  })

  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldErrors(field) : [])

  const set = (name: string, value: string | number | null) =>
    setValues((current) => ({ ...current, [name]: value }))

  const byName = useMemo(
    () => new Map(IMPORT_UPDATE_COLUMNS.map((column) => [column.name, column])),
    [],
  )

  // Guards against a column being dropped from a group when the schema changes.
  const ungrouped = useMemo(() => {
    const grouped = new Set(GROUPS.flatMap((group) => group.fields))
    return IMPORT_UPDATE_COLUMNS.filter((column) => !grouped.has(column.name))
  }, [])

  const filledCount = (fields: string[]) =>
    fields.filter((field) => {
      const value = values[field as keyof ImportUpdateWriteRequest]
      return value !== null && value !== undefined && value !== ''
    }).length

  const renderGroup = (fields: string[]) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2 }}>
      {fields.map((name) => {
        const column = byName.get(name)
        if (!column) return null
        return (
          <ColumnField
            key={name}
            column={column}
            value={values[name as keyof ImportUpdateWriteRequest] as string | number | null}
            onChange={(value) => set(name, value)}
            errors={fieldError(name)}
            disabled={isEdit && name === 'id'}
            helperText={
              name === 'id' && isEdit
                ? 'Not editable: mappings reference it.'
                : name === 'client_id'
                  ? 'ProVestClientLocation.LocationId'
                  : undefined
            }
          />
        )
      })}
    </Box>
  )

  return (
    <Dialog open={open} onClose={save.isPending ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        {isEdit ? `Edit importer layout (id ${importUpdateId})` : 'New importer layout'}
      </DialogTitle>

      <DialogContent dividers>
        <ErrorBanner error={error} onClose={() => setError(null)} />

        <Alert severity="info" sx={{ mb: 2 }}>
          Each field holds the <strong>header name</strong> in this client&rsquo;s raw file that
          feeds the corresponding ProVest standard column &mdash; not a value. After saving, use{' '}
          <strong>Regenerate</strong> on the ProVestColumnMapping tab to rebuild this
          importer&rsquo;s mappings; until then the change has no effect on imports.
        </Alert>

        {GROUPS.map((group, index) => (
          <Accordion key={group.title} defaultExpanded={index === 0} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                {group.title}
              </Typography>
              <Chip
                size="small"
                variant="outlined"
                label={`${filledCount(group.fields)} / ${group.fields.length} set`}
                sx={{ mr: 2 }}
              />
            </AccordionSummary>
            <AccordionDetails>{renderGroup(group.fields)}</AccordionDetails>
          </Accordion>
        ))}

        {ungrouped.length > 0 && (
          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Other columns</Typography>
            </AccordionSummary>
            <AccordionDetails>{renderGroup(ungrouped.map((c) => c.name))}</AccordionDetails>
          </Accordion>
        )}
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
