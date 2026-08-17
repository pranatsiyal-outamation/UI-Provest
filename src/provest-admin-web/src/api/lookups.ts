import { http } from './http'

const BASE = '/api/admin/lookups'

export interface StandardColumnLookup {
  Id: number
  ColumnName: string
  DataType: string | null
  SequenceNo: number | null
}

/** ProjectSetup has no name of its own; ProjectName comes from the joined Project. */
export interface ProjectSetupLookup {
  Id: number
  ProjectId: number
  ProjectName: string | null
  DepartmentId: number | null
  SubDepartmentId: number | null
  IsActive: boolean
}

export interface ClientLookup {
  Id: number
  ClientName: string | null
  ClientCode: string | null
  IsActive: boolean
}

export const lookupsApi = {
  standardColumns: () => http.get<StandardColumnLookup[]>(`${BASE}/standard-columns`),
  projectSetups: () => http.get<ProjectSetupLookup[]>(`${BASE}/project-setups`),
  clients: () => http.get<ClientLookup[]>(`${BASE}/clients`),
}

/** Label for a project setup option. */
export function projectSetupLabel(setup: ProjectSetupLookup): string {
  return setup.ProjectName ? `${setup.ProjectName} (#${setup.Id})` : `Project setup #${setup.Id}`
}

/** Label for a client option. */
export function clientLabel(client: ClientLookup): string {
  const name = client.ClientName ?? `Client #${client.Id}`
  const code = client.ClientCode ? ` [${client.ClientCode}]` : ''
  return `${name}${code}${client.IsActive ? '' : ' (inactive)'}`
}
