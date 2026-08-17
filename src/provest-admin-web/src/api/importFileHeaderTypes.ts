// Generated from the CREATE TABLE statement for [dbo].[ImportFileHeader].
// 64 columns. Regenerate rather than editing by hand.

import type { ColumnMeta } from './types'

// ImportFileHeader holds one row per importer layout: col_1..col_60 are the raw header
// row from the client file, and unique_key is those headers concatenated -- which is
// what the importer matches on to resolve an ImporterId.

export interface ImportFileHeaderListItem {
  id: number | null
  client_id: number | null
  importer_id: number | null
  col_1: string | null
  col_2: string | null
  col_3: string | null
  col_4: string | null
  col_5: string | null
  col_6: string | null
  col_7: string | null
  col_8: string | null
  /** First 200 characters of unique_key; the full value is on the detail record. */
  unique_key_preview: string | null
  /** False when id is null or shared with another row, which makes the row unaddressable. */
  IsAddressable: boolean
}

export interface ImportFileHeaderDetail {
  id: number | null
  client_id: number | null
  col_1: string | null
  col_2: string | null
  col_3: string | null
  col_4: string | null
  col_5: string | null
  col_6: string | null
  col_7: string | null
  col_8: string | null
  col_9: string | null
  col_10: string | null
  col_11: string | null
  col_12: string | null
  col_13: string | null
  col_14: string | null
  col_15: string | null
  col_16: string | null
  col_17: string | null
  col_18: string | null
  col_19: string | null
  col_20: string | null
  col_21: string | null
  col_22: string | null
  col_23: string | null
  col_24: string | null
  col_25: string | null
  col_26: string | null
  col_27: string | null
  col_28: string | null
  col_29: string | null
  col_30: string | null
  col_31: string | null
  col_32: string | null
  col_33: string | null
  col_34: string | null
  col_35: string | null
  col_36: string | null
  col_37: string | null
  col_38: string | null
  col_39: string | null
  col_40: string | null
  col_41: string | null
  col_42: string | null
  col_43: string | null
  col_44: string | null
  col_45: string | null
  col_46: string | null
  col_47: string | null
  col_48: string | null
  col_49: string | null
  col_50: string | null
  col_51: string | null
  col_52: string | null
  col_53: string | null
  col_54: string | null
  col_55: string | null
  col_56: string | null
  col_57: string | null
  col_58: string | null
  col_59: string | null
  col_60: string | null
  importer_id: number | null
  unique_key: string | null
}

/** Same shape as the detail record. On update, id identifies the row and is not changed. */
export type ImportFileHeaderWriteRequest = ImportFileHeaderDetail

export const IMPORT_FILE_HEADER_COLUMNS: ColumnMeta[] = [
  { name: 'id', kind: 'int', maxLength: null },
  { name: 'client_id', kind: 'int', maxLength: null },
  { name: 'col_1', kind: 'text', maxLength: 500 },
  { name: 'col_2', kind: 'text', maxLength: 500 },
  { name: 'col_3', kind: 'text', maxLength: 500 },
  { name: 'col_4', kind: 'text', maxLength: 500 },
  { name: 'col_5', kind: 'text', maxLength: 500 },
  { name: 'col_6', kind: 'text', maxLength: 500 },
  { name: 'col_7', kind: 'text', maxLength: 500 },
  { name: 'col_8', kind: 'text', maxLength: 500 },
  { name: 'col_9', kind: 'text', maxLength: 500 },
  { name: 'col_10', kind: 'text', maxLength: 500 },
  { name: 'col_11', kind: 'text', maxLength: 500 },
  { name: 'col_12', kind: 'text', maxLength: 500 },
  { name: 'col_13', kind: 'text', maxLength: 500 },
  { name: 'col_14', kind: 'text', maxLength: 500 },
  { name: 'col_15', kind: 'text', maxLength: 500 },
  { name: 'col_16', kind: 'text', maxLength: 500 },
  { name: 'col_17', kind: 'text', maxLength: 500 },
  { name: 'col_18', kind: 'text', maxLength: 500 },
  { name: 'col_19', kind: 'text', maxLength: 500 },
  { name: 'col_20', kind: 'text', maxLength: 500 },
  { name: 'col_21', kind: 'text', maxLength: 500 },
  { name: 'col_22', kind: 'text', maxLength: 500 },
  { name: 'col_23', kind: 'text', maxLength: 500 },
  { name: 'col_24', kind: 'text', maxLength: 500 },
  { name: 'col_25', kind: 'text', maxLength: 500 },
  { name: 'col_26', kind: 'text', maxLength: 500 },
  { name: 'col_27', kind: 'text', maxLength: 500 },
  { name: 'col_28', kind: 'text', maxLength: 500 },
  { name: 'col_29', kind: 'text', maxLength: 500 },
  { name: 'col_30', kind: 'text', maxLength: 500 },
  { name: 'col_31', kind: 'text', maxLength: 500 },
  { name: 'col_32', kind: 'text', maxLength: 500 },
  { name: 'col_33', kind: 'text', maxLength: 500 },
  { name: 'col_34', kind: 'text', maxLength: 500 },
  { name: 'col_35', kind: 'text', maxLength: 500 },
  { name: 'col_36', kind: 'text', maxLength: 500 },
  { name: 'col_37', kind: 'text', maxLength: 500 },
  { name: 'col_38', kind: 'text', maxLength: 500 },
  { name: 'col_39', kind: 'text', maxLength: 500 },
  { name: 'col_40', kind: 'text', maxLength: 500 },
  { name: 'col_41', kind: 'text', maxLength: 500 },
  { name: 'col_42', kind: 'text', maxLength: 500 },
  { name: 'col_43', kind: 'text', maxLength: 500 },
  { name: 'col_44', kind: 'text', maxLength: 500 },
  { name: 'col_45', kind: 'text', maxLength: 500 },
  { name: 'col_46', kind: 'text', maxLength: 500 },
  { name: 'col_47', kind: 'text', maxLength: 500 },
  { name: 'col_48', kind: 'text', maxLength: 500 },
  { name: 'col_49', kind: 'text', maxLength: 500 },
  { name: 'col_50', kind: 'text', maxLength: 500 },
  { name: 'col_51', kind: 'text', maxLength: 500 },
  { name: 'col_52', kind: 'text', maxLength: 500 },
  { name: 'col_53', kind: 'text', maxLength: 500 },
  { name: 'col_54', kind: 'text', maxLength: 500 },
  { name: 'col_55', kind: 'text', maxLength: 500 },
  { name: 'col_56', kind: 'text', maxLength: 500 },
  { name: 'col_57', kind: 'text', maxLength: 500 },
  { name: 'col_58', kind: 'text', maxLength: 500 },
  { name: 'col_59', kind: 'text', maxLength: 500 },
  { name: 'col_60', kind: 'text', maxLength: 500 },
  { name: 'importer_id', kind: 'int', maxLength: null },
  { name: 'unique_key', kind: 'text', maxLength: null },
]

export const IMPORT_FILE_HEADER_EMPTY: ImportFileHeaderWriteRequest = {
  id: null,
  client_id: null,
  col_1: null,
  col_2: null,
  col_3: null,
  col_4: null,
  col_5: null,
  col_6: null,
  col_7: null,
  col_8: null,
  col_9: null,
  col_10: null,
  col_11: null,
  col_12: null,
  col_13: null,
  col_14: null,
  col_15: null,
  col_16: null,
  col_17: null,
  col_18: null,
  col_19: null,
  col_20: null,
  col_21: null,
  col_22: null,
  col_23: null,
  col_24: null,
  col_25: null,
  col_26: null,
  col_27: null,
  col_28: null,
  col_29: null,
  col_30: null,
  col_31: null,
  col_32: null,
  col_33: null,
  col_34: null,
  col_35: null,
  col_36: null,
  col_37: null,
  col_38: null,
  col_39: null,
  col_40: null,
  col_41: null,
  col_42: null,
  col_43: null,
  col_44: null,
  col_45: null,
  col_46: null,
  col_47: null,
  col_48: null,
  col_49: null,
  col_50: null,
  col_51: null,
  col_52: null,
  col_53: null,
  col_54: null,
  col_55: null,
  col_56: null,
  col_57: null,
  col_58: null,
  col_59: null,
  col_60: null,
  importer_id: null,
  unique_key: null,
}
