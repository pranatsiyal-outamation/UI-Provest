// Generated from the CREATE TABLE statement for [dbo].[Import_Update].
// 71 columns. Regenerate rather than editing by hand.

import type { ColumnMeta } from './types'

// Import_Update holds one row per importer layout. Each cell is the name of the column
// in that client's raw file that feeds the corresponding ProVest standard column --
// these are header names, not case data.

export interface ImportUpdateListItem {
  id: number | null
  client_id: number | null
  lawfirm_filenumber: string | null
  plaintiff: string | null
  defendant: string | null
  document_type: string | null
  index_number: string | null
  court_name: string | null
  servee_name: string | null
  client_ref: string | null
  creditor: string | null
  /** False when id is null or shared with another row, which makes the row unaddressable. */
  IsAddressable: boolean
}

export interface ImportUpdateDetail {
  id: number | null
  client_id: number | null
  lawfirm_filenumber: string | null
  '3rdparty_filenumber': string | null
  plaintiff: string | null
  plaintiff2: string | null
  defendant: string | null
  defendant2: string | null
  document_code: string | null
  document_type: string | null
  index_number: string | null
  court_name: string | null
  court_type: string | null
  court_county: string | null
  court_city: string | null
  court_state: string | null
  court_zip: string | null
  servee_last_name: string | null
  servee_name: string | null
  servee_address: string | null
  servee_apt: string | null
  servee_city: string | null
  servee_state: string | null
  servee_zip: string | null
  servee_last_name2: string | null
  servee_name2: string | null
  servee_address2: string | null
  servee_apt2: string | null
  servee_city2: string | null
  servee_state2: string | null
  servee_zip2: string | null
  employer_name: string | null
  employer_address1: string | null
  employer_address2: string | null
  employer_city: string | null
  employer_state: string | null
  employer_zip: string | null
  special_instructions: string | null
  additional_info1: string | null
  additional_info2: string | null
  additional_info3: string | null
  additional_info4: string | null
  additional_info5: string | null
  kasebilling_checknum: string | null
  kasebilling_amt: string | null
  date_kase_filed: string | null
  court_date: string | null
  court_time: string | null
  court_room: string | null
  date_due: string | null
  client_ref: string | null
  creditor: string | null
  chargeoff_date: string | null
  suit_amt: string | null
  principal: string | null
  interest: string | null
  court_cost: string | null
  atty_cost: string | null
  client_data1: string | null
  client_data2: string | null
  client_data3: string | null
  client_data4: string | null
  client_data5: string | null
  client_data6: string | null
  client_data7: string | null
  client_data8: string | null
  date_prepaid_check: string | null
  def_ordinal: string | null
  court_room2: string | null
  misc_1: string | null
  dob: string | null
}

/** Same shape as the detail record. On update, id identifies the row and is not changed. */
export type ImportUpdateWriteRequest = ImportUpdateDetail

export const IMPORT_UPDATE_COLUMNS: ColumnMeta[] = [
  { name: 'id', kind: 'int', maxLength: null },
  { name: 'client_id', kind: 'int', maxLength: null },
  { name: 'lawfirm_filenumber', kind: 'text', maxLength: 500 },
  { name: '3rdparty_filenumber', kind: 'text', maxLength: 500 },
  { name: 'plaintiff', kind: 'text', maxLength: 500 },
  { name: 'plaintiff2', kind: 'text', maxLength: 500 },
  { name: 'defendant', kind: 'text', maxLength: 500 },
  { name: 'defendant2', kind: 'text', maxLength: 500 },
  { name: 'document_code', kind: 'text', maxLength: 500 },
  { name: 'document_type', kind: 'text', maxLength: 500 },
  { name: 'index_number', kind: 'text', maxLength: 500 },
  { name: 'court_name', kind: 'text', maxLength: 500 },
  { name: 'court_type', kind: 'text', maxLength: 500 },
  { name: 'court_county', kind: 'text', maxLength: 500 },
  { name: 'court_city', kind: 'text', maxLength: 500 },
  { name: 'court_state', kind: 'text', maxLength: 500 },
  { name: 'court_zip', kind: 'text', maxLength: 500 },
  { name: 'servee_last_name', kind: 'text', maxLength: 500 },
  { name: 'servee_name', kind: 'text', maxLength: 500 },
  { name: 'servee_address', kind: 'text', maxLength: 500 },
  { name: 'servee_apt', kind: 'text', maxLength: 500 },
  { name: 'servee_city', kind: 'text', maxLength: 500 },
  { name: 'servee_state', kind: 'text', maxLength: 500 },
  { name: 'servee_zip', kind: 'text', maxLength: 500 },
  { name: 'servee_last_name2', kind: 'text', maxLength: 500 },
  { name: 'servee_name2', kind: 'text', maxLength: 500 },
  { name: 'servee_address2', kind: 'text', maxLength: 500 },
  { name: 'servee_apt2', kind: 'text', maxLength: 500 },
  { name: 'servee_city2', kind: 'text', maxLength: 500 },
  { name: 'servee_state2', kind: 'text', maxLength: 500 },
  { name: 'servee_zip2', kind: 'text', maxLength: 500 },
  { name: 'employer_name', kind: 'text', maxLength: 500 },
  { name: 'employer_address1', kind: 'text', maxLength: 500 },
  { name: 'employer_address2', kind: 'text', maxLength: 500 },
  { name: 'employer_city', kind: 'text', maxLength: 500 },
  { name: 'employer_state', kind: 'text', maxLength: 500 },
  { name: 'employer_zip', kind: 'text', maxLength: 500 },
  { name: 'special_instructions', kind: 'text', maxLength: null },
  { name: 'additional_info1', kind: 'text', maxLength: 500 },
  { name: 'additional_info2', kind: 'text', maxLength: 500 },
  { name: 'additional_info3', kind: 'text', maxLength: 500 },
  { name: 'additional_info4', kind: 'text', maxLength: 500 },
  { name: 'additional_info5', kind: 'text', maxLength: 500 },
  { name: 'kasebilling_checknum', kind: 'text', maxLength: 500 },
  { name: 'kasebilling_amt', kind: 'text', maxLength: 500 },
  { name: 'date_kase_filed', kind: 'text', maxLength: 500 },
  { name: 'court_date', kind: 'text', maxLength: 500 },
  { name: 'court_time', kind: 'text', maxLength: 500 },
  { name: 'court_room', kind: 'text', maxLength: 500 },
  { name: 'date_due', kind: 'text', maxLength: 500 },
  { name: 'client_ref', kind: 'text', maxLength: 500 },
  { name: 'creditor', kind: 'text', maxLength: 500 },
  { name: 'chargeoff_date', kind: 'text', maxLength: 500 },
  { name: 'suit_amt', kind: 'text', maxLength: 500 },
  { name: 'principal', kind: 'text', maxLength: 500 },
  { name: 'interest', kind: 'text', maxLength: 500 },
  { name: 'court_cost', kind: 'text', maxLength: 500 },
  { name: 'atty_cost', kind: 'text', maxLength: 500 },
  { name: 'client_data1', kind: 'text', maxLength: 500 },
  { name: 'client_data2', kind: 'text', maxLength: 500 },
  { name: 'client_data3', kind: 'text', maxLength: 500 },
  { name: 'client_data4', kind: 'text', maxLength: 500 },
  { name: 'client_data5', kind: 'text', maxLength: 500 },
  { name: 'client_data6', kind: 'text', maxLength: 500 },
  { name: 'client_data7', kind: 'text', maxLength: 500 },
  { name: 'client_data8', kind: 'text', maxLength: 500 },
  { name: 'date_prepaid_check', kind: 'text', maxLength: 500 },
  { name: 'def_ordinal', kind: 'text', maxLength: 500 },
  { name: 'court_room2', kind: 'text', maxLength: 500 },
  { name: 'misc_1', kind: 'text', maxLength: 500 },
  { name: 'dob', kind: 'text', maxLength: 500 },
]

export const IMPORT_UPDATE_EMPTY: ImportUpdateWriteRequest = {
  id: null,
  client_id: null,
  lawfirm_filenumber: null,
  '3rdparty_filenumber': null,
  plaintiff: null,
  plaintiff2: null,
  defendant: null,
  defendant2: null,
  document_code: null,
  document_type: null,
  index_number: null,
  court_name: null,
  court_type: null,
  court_county: null,
  court_city: null,
  court_state: null,
  court_zip: null,
  servee_last_name: null,
  servee_name: null,
  servee_address: null,
  servee_apt: null,
  servee_city: null,
  servee_state: null,
  servee_zip: null,
  servee_last_name2: null,
  servee_name2: null,
  servee_address2: null,
  servee_apt2: null,
  servee_city2: null,
  servee_state2: null,
  servee_zip2: null,
  employer_name: null,
  employer_address1: null,
  employer_address2: null,
  employer_city: null,
  employer_state: null,
  employer_zip: null,
  special_instructions: null,
  additional_info1: null,
  additional_info2: null,
  additional_info3: null,
  additional_info4: null,
  additional_info5: null,
  kasebilling_checknum: null,
  kasebilling_amt: null,
  date_kase_filed: null,
  court_date: null,
  court_time: null,
  court_room: null,
  date_due: null,
  client_ref: null,
  creditor: null,
  chargeoff_date: null,
  suit_amt: null,
  principal: null,
  interest: null,
  court_cost: null,
  atty_cost: null,
  client_data1: null,
  client_data2: null,
  client_data3: null,
  client_data4: null,
  client_data5: null,
  client_data6: null,
  client_data7: null,
  client_data8: null,
  date_prepaid_check: null,
  def_ordinal: null,
  court_room2: null,
  misc_1: null,
  dob: null,
}
