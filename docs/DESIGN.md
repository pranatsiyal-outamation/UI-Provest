# ProVest FM Admin Tool — Design (for review)

**Status:** Proposal. No implementation started.
**Reference solution inspected:** `C:\Users\Pranat.Siyal\Desktop\OutamateQMS_Product` (OQMS.ProVestFM, OQMS.Database, OQMS.Entities, OQMS.API)

---

## 1. Findings from schema inspection

These change the design, so they come first.

### F1 — `ProVestColumnMapping` is a *generated* table, not a source of truth ⚠️ BLOCKING

`OQMS.Database/Scripts/Add_ProVestClientMapping_Data.sql` is:

```sql
DELETE FROM ProVestColumnMapping;
INSERT INTO ProVestColumnMapping(ImporterId, ColumnName, ProVestStandardColumnId)
SELECT iu.id, v.ColumnValue, sc.Id
FROM Import_Update iu
CROSS APPLY (VALUES ('lawfirm_filenumber', iu.lawfirm_filenumber), ... ) v(ColumnName, ColumnValue)
INNER JOIN ProVestStandardColumn sc ON v.ColumnName = sc.ColumnName
WHERE sc.Id NOT IN (70,71,72)
  AND v.ColumnValue IS NOT NULL
  AND RTRIM(LTRIM(UPPER(v.ColumnValue))) <> 'NULL'
  AND RTRIM(LTRIM(UPPER(v.ColumnValue))) <> '0000-00-00';
```

Consequences:

- `ProVestColumnMapping.ImporterId` **is** `Import_Update.id`.
- `ProVestColumnMapping.ColumnName` **is** the client's raw file header, pulled from the `Import_Update` cell.
- Any edit made to `ProVestColumnMapping` through this admin tool is **silently destroyed** the next time that script runs.
- Any edit made to `Import_Update` has **no runtime effect** until that script is re-run.

So the two tables are one logical object with a manual, destructive sync step between them. Editing either one independently is a footgun.

### F2 — `Import_Update` and `ImportFileHeader` are configuration tables, not data tables

They do not hold case/service records. They hold **column header names**:

| Table | Seeded rows | One row = | Cell values are |
|---|---|---|---|
| `Import_Update` | 349 | one importer layout | the client's header name feeding each ProVest standard column |
| `ImportFileHeader` | 1502 | one importer layout | `col_1..col_60` = the client's header row; `unique_key` = those headers concatenated |

Example seeded row: `Import_Update(id=1, client_id=30, lawfirm_filenumber='ACCOUNT#', plaintiff='CLIENT NAME', ...)`.

The stated "10,000+ rows" premise does not hold for the seed data. Server-side paging is still the right design and costs nothing, so the plan below keeps it — but the performance envelope is much friendlier than assumed. **Action: confirm actual dev row counts** (`SELECT COUNT(*)` on each of the 5).

### F3 — `Import_Update` and `ImportFileHeader` have no PK, no unique constraint, no identity ⚠️ BLOCKING

`id` is a **nullable int**. There is nothing that guarantees a single row is addressable.

With "no schema changes" in scope, the only safe approach is a **runtime uniqueness guard** inside every write SP:

```sql
-- inside usp_ProVestAdmin_ImportUpdate_Update
DECLARE @Matches INT;
SELECT @Matches = COUNT(*) FROM dbo.Import_Update WHERE id = @Id;
IF @Matches = 0 THROW 51001, 'No row found for the supplied id.', 1;
IF @Matches > 1 THROW 51002, 'id is not unique; refusing to modify N rows.', 1;
-- ... then UPDATE ... WHERE id = @Id, inside a transaction
```

Rows where `id IS NULL`, or where `id` is duplicated, **cannot be targeted at all**. The grid must render those rows as read-only with an explanatory badge.

### F4 — Collation: the stated requirement contradicts the project ⚠️ BLOCKING

- `OQMS.Database.sqlproj` declares `<ModelCollation>1033, CI</ModelCollation>` — **case-insensitive**.
- There is **no `COLLATE` clause anywhere** in the DB project (`grep -ri collate` over all `.sql` → zero hits). Every column inherits the DB collation.
- The importer engine compares case-**insensitively** *and* strips spaces:
  `OQMS.ProVestFM/Services/Base/ProVestFMServiceBase.cs:257-274` —
  `string.Equals(x.UniqueKey?.Replace(" ",""), uniqueKey.Replace(" ",""), StringComparison.OrdinalIgnoreCase)`
  Same for state matching (`GetClientIdForRecord`, `OrdinalIgnoreCase`) and every client-code check in `FMService.cs`.

So the running system is CI + space-insensitive, and the project model is CI. The requirement says comparisons are case-sensitive.

**Action before I write any SP:** run against the dev DB and paste the result —

```sql
SELECT DATABASEPROPERTYEX(DB_NAME(),'Collation') AS DbCollation;

SELECT t.name AS TableName, c.name AS ColumnName, c.collation_name
FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id
WHERE t.name IN ('Import_Update','ImportFileHeader','ProVestClient',
                 'ProVestClientLocation','ProVestColumnMapping')
  AND c.collation_name IS NOT NULL
ORDER BY t.name, c.column_id;
```

This is not a detail — it decides whether searching `smith` returns `SMITH`, which is user-visible behaviour.

### F5 — `client_id` on the import tables is **not** `ProVestClient.Id`

Traced through `FMService.cs:1544` → `GetClientIdForRecord()` returns `ProVestClientLocation.LocationId` → that value is passed to `GetImporterId(clientId, uniqueKey)` → matched against `ImportFileHeader.client_id`.

So:

```
ProVestClientLocation.LocationId  ==  ImportFileHeader.client_id  ==  Import_Update.client_id
ProVestClient.Id                  !=  either
```

No FK enforces this. The UI must label the column `Location Id` (not "Client"), or users will pick the wrong number and quietly break an importer.

### F6 — Cross-table links that are *not* FK-enforced

| Link | Enforced? |
|---|---|
| `ProVestColumnMapping.ProVestStandardColumnId` → `ProVestStandardColumn.Id` | ✅ FK |
| `ProVestClientLocation.ProVestClientId` → `ProVestClient.Id` | ✅ FK |
| `ProVestClient.ProjectSetupId` → `ProjectSetup.Id` | ✅ FK (nullable) |
| `ProVestClientLocation.ProjectSetupId` → `ProjectSetup.Id` | ✅ FK (nullable) |
| `ProVestColumnMapping.ImporterId` → `Import_Update.id` | ❌ none |
| `ImportFileHeader.importer_id` → `Import_Update.id` | ❌ none |
| `ImportFileHeader.client_id` → `ProVestClientLocation.LocationId` | ❌ none |
| `Import_Update.client_id` → `ProVestClientLocation.LocationId` | ❌ none |

The tool can therefore create orphans that the importer will only reveal at 3am as `ImporterIdNotFound` in `ProVestErrorLog`. Mitigation: a read-only **Integrity Check** page (§6) plus soft warnings on save.

### F7 — Other schema traps

- `Import_Update.[3rdparty_filenumber]` starts with a digit → must be bracket-quoted in every SP, DTO name must differ (`ThirdPartyFileNumber`).
- `Import_Update` has columns named `interest`, `principal`, `key`-adjacent terms → bracket-quote all 70 consistently.
- `ImportFileHeader.unique_key` is `nvarchar(max)` → cannot be indexed; equality search is a scan. Fine at 1502 rows.
- `Import_Update.special_instructions` is `nvarchar(max)` → same.
- Deleting a `ProVestClient` will hit FK 547 from `ProVestClientLocation` **and** `ProVestErrorLog`. Soft delete (`IsActive = 0`) is the correct behaviour and the column already exists.

### F8 — Stack notes

- Reference solution is **.NET 8**, minimal-API-ish via `Ardalis.ApiEndpoints` (`EndpointBaseAsync`), `SharedKernal.Result` → `this.ToActionResult(result)`, EF Core for entities, **Dapper for raw SQL** (`ProVestFMServiceBase.cs:191-199`).
- Existing `OQMS.Web` is **Angular**, not React. The ask is React — fine as a standalone app, but confirm it should not live inside `OQMS.Web`.
- Connection string name in use: `ConnectionStrings:OQMS`.

---

## 2. Proposed CRUD matrix

The brief left this as `[provide matrix]`. Proposal:

| Table | Create | Read | Update | Delete | Notes |
|---|:--:|:--:|:--:|:--:|---|
| `ProVestClient` | ✅ | ✅ | ✅ | **Soft** (`IsActive=0`) | Hard delete blocked by FK children |
| `ProVestClientLocation` | ✅ | ✅ | ✅ | **Soft** (`IsActive=0`) | `IsActive` already drives importer behaviour |
| `ProVestColumnMapping` | ❌ | ✅ | ❌ | ❌ | **Read-only** — regenerated from `Import_Update` (F1) |
| `Import_Update` | ✅ | ✅ | ✅ | ✅ hard, guarded | Guarded by F3 uniqueness check |
| `ImportFileHeader` | ✅ | ✅ | ✅ | ✅ hard, guarded | Guarded by F3 uniqueness check |
| `ProVestStandardColumn` | ❌ | ✅ | ❌ | ❌ | Lookup only (6th table, needed for dropdowns) |
| `ProjectSetup` | ❌ | ✅ | ❌ | ❌ | Lookup only |

Rationale for `ProVestColumnMapping` being read-only: per F1 it is a projection. Making it writable ships a UI that appears to work and then loses the user's edits. Instead the tool offers an explicit **"Regenerate mappings from Import_Update"** action (scoped to one `ImporterId`) so the derivation is visible rather than hidden. Confirmed as **D1** (§10).

---

## 3. Proposed search / filter / sort surface

Per table. `search` = free-text `LIKE '%term%'` across the listed columns (OR'd). `filters` = exact-match, typed. `sort` = whitelist, validated **inside the SP** so the API layer can't be the only guard.

### `ProVestClient`
- **search:** `ClientName`, `ClientCode`, `StateColumn`, `UniqueColumns`, `FileNumberColumn`, `InboundFolder`, `OutboundFolder`
- **filters:** `IsActive`, `IsMergingEnabled`, `IsZipExtractionEnabled`, `ProjectSetupId`
- **sort:** `Id`, `ClientName`, `ClientCode`, `IsActive`, `ProjectSetupId` (default `ClientName ASC`)

### `ProVestClientLocation`
- **search:** `State`
- **filters:** `ProVestClientId`, `LocationId`, `State`, `IsActive`, `ProjectSetupId`
- **sort:** `Id`, `ProVestClientId`, `LocationId`, `State`, `IsActive` (default `ProVestClientId ASC, State ASC`)

### `ProVestColumnMapping` (read)
- **search:** `ColumnName`, joined `ProVestStandardColumn.ColumnName`
- **filters:** `ImporterId`, `ProVestStandardColumnId`
- **sort:** `Id`, `ImporterId`, `ColumnName`, `StandardColumnName` (default `ImporterId ASC, Id ASC`)

### `ImportFileHeader`
- **search:** `unique_key` — because `unique_key` is the concatenation of `col_1..col_60`, one `LIKE` on it is equivalent to searching every column, without 60 predicates. Optional `searchColumn=col_N` narrows to a single slot.
- **filters:** `id`, `client_id`, `importer_id`
- **sort:** `id`, `client_id`, `importer_id` (default `client_id ASC, importer_id ASC`)

### `Import_Update`
- **search:** `lawfirm_filenumber`, `plaintiff`, `defendant`, `document_type`, `index_number`, `court_name`, `servee_name`, `client_ref`, `creditor`
- **filters:** `id`, `client_id`
- **sort:** `id`, `client_id`, `lawfirm_filenumber`, `plaintiff`, `defendant` (default `id ASC`)
- Sorting is deliberately **not** offered on all 70 columns — a whitelisted `CASE`-based `ORDER BY` with 70 columns × 2 directions is 140 branches and unusable. If arbitrary sort is genuinely needed, say so and I'll design a keyset variant.

Every sort gets a **deterministic tiebreaker** appended (`Id` / `id`), otherwise `OFFSET/FETCH` paging is unstable and rows appear twice across pages.

---

## 4. Proposed API

Base: `/api/admin`. All list endpoints share one query contract.

### Shared list contract

```
GET /api/admin/{resource}
  ?page=1              # 1-based, default 1
  &pageSize=50         # default 50, max 100, clamped server-side
  &search=<term>       # optional free text
  &sortBy=<column>     # optional, whitelist-validated
  &sortDir=asc|desc    # default asc
  &<filter>=<value>    # per-table typed filters, see §3
```

Response:

```jsonc
{
  "items": [ /* rows */ ],
  "page": 1,
  "pageSize": 50,
  "totalCount": 349,
  "totalPages": 7
}
```

### Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/admin/tables` | Table registry: names, labels, permissions, column metadata (drives the generic UI) |
| `GET` | `/api/admin/clients` | List ProVestClient |
| `GET` | `/api/admin/clients/{id}` | Single |
| `POST` | `/api/admin/clients` | Create |
| `PUT` | `/api/admin/clients/{id}` | Update |
| `DELETE` | `/api/admin/clients/{id}` | Soft delete (`IsActive=0`) |
| `GET` | `/api/admin/client-locations` | List ProVestClientLocation |
| `GET` | `/api/admin/client-locations/{id}` | Single |
| `POST` | `/api/admin/client-locations` | Create |
| `PUT` | `/api/admin/client-locations/{id}` | Update |
| `DELETE` | `/api/admin/client-locations/{id}` | Soft delete |
| `GET` | `/api/admin/column-mappings` | List ProVestColumnMapping (read-only) |
| `POST` | `/api/admin/column-mappings/regenerate` | Regenerate for `{ importerId }` — see D1 |
| `GET` | `/api/admin/import-updates` | List Import_Update |
| `GET` | `/api/admin/import-updates/{id}` | Single |
| `POST` | `/api/admin/import-updates` | Create |
| `PUT` | `/api/admin/import-updates/{id}` | Update (uniqueness-guarded) |
| `DELETE` | `/api/admin/import-updates/{id}` | Delete (uniqueness-guarded) |
| `GET` | `/api/admin/import-file-headers` | List ImportFileHeader |
| `GET` | `/api/admin/import-file-headers/{id}` | Single |
| `POST` | `/api/admin/import-file-headers` | Create |
| `PUT` | `/api/admin/import-file-headers/{id}` | Update (uniqueness-guarded) |
| `DELETE` | `/api/admin/import-file-headers/{id}` | Delete (uniqueness-guarded) |
| `GET` | `/api/admin/lookups/standard-columns` | `ProVestStandardColumn` for dropdowns |
| `GET` | `/api/admin/lookups/project-setups` | `ProjectSetup` for dropdowns |
| `GET` | `/api/admin/lookups/clients` | Id + name, for FK pickers |
| `GET` | `/api/admin/integrity-check` | Read-only orphan report (§6) |

### Error contract

RFC 7807 `ProblemDetails`, with a field-level extension so the form can highlight inputs:

```jsonc
{
  "type": "https://oqms/errors/validation",
  "title": "Validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "errors": { "State": ["State must be 30 characters or fewer."] }
}
```

Mapping:

| Condition | HTTP | Shown as |
|---|---|---|
| DTO/model validation fails | 400 | Inline field errors |
| Row not found | 404 | "Record no longer exists — refresh." |
| `id` not unique (F3) | 409 | "This row cannot be edited: `id` is not unique in the table." |
| FK violation (SQL 547) | 409 | Translated: "Project Setup 42 does not exist." |
| String truncation (SQL 2628/8152) | 400 | Translated to the offending field |
| Anything else | 500 | Generic message + correlation id; full detail to Serilog only |

Raw `SqlException` text is never returned to the browser.

---

## 5. Proposed stored procedures

Naming: `usp_ProVestAdmin_<Entity>_<Action>`. All are `SET NOCOUNT ON`, all parameterised, **zero dynamic SQL**, all writes in an explicit transaction with `TRY/CATCH` + `THROW`.

| SP | Purpose |
|---|---|
| `usp_ProVestAdmin_Client_Search` | Page/filter/sort ProVestClient |
| `usp_ProVestAdmin_Client_GetById` | |
| `usp_ProVestAdmin_Client_Insert` | Returns new `Id` |
| `usp_ProVestAdmin_Client_Update` | |
| `usp_ProVestAdmin_Client_Deactivate` | `IsActive = 0` |
| `usp_ProVestAdmin_ClientLocation_Search` | Joins client name for display |
| `usp_ProVestAdmin_ClientLocation_GetById` | |
| `usp_ProVestAdmin_ClientLocation_Insert` | |
| `usp_ProVestAdmin_ClientLocation_Update` | |
| `usp_ProVestAdmin_ClientLocation_Deactivate` | |
| `usp_ProVestAdmin_ColumnMapping_Search` | Joins `ProVestStandardColumn.ColumnName` |
| `usp_ProVestAdmin_ColumnMapping_RegenerateForImporter` | Scoped port of `Add_ProVestClientMapping_Data.sql` (Q1) |
| `usp_ProVestAdmin_ImportUpdate_Search` | |
| `usp_ProVestAdmin_ImportUpdate_GetById` | |
| `usp_ProVestAdmin_ImportUpdate_Insert` | 70 params |
| `usp_ProVestAdmin_ImportUpdate_Update` | 70 params + uniqueness guard |
| `usp_ProVestAdmin_ImportUpdate_Delete` | uniqueness guard |
| `usp_ProVestAdmin_ImportFileHeader_Search` | |
| `usp_ProVestAdmin_ImportFileHeader_GetById` | |
| `usp_ProVestAdmin_ImportFileHeader_Insert` | 64 params |
| `usp_ProVestAdmin_ImportFileHeader_Update` | 64 params + uniqueness guard |
| `usp_ProVestAdmin_ImportFileHeader_Delete` | uniqueness guard |
| `usp_ProVestAdmin_Lookup_StandardColumns` | |
| `usp_ProVestAdmin_Lookup_ProjectSetups` | |
| `usp_ProVestAdmin_Lookup_Clients` | |
| `usp_ProVestAdmin_IntegrityCheck` | Orphan report |

### Canonical search SP shape

```sql
CREATE PROCEDURE [dbo].[usp_ProVestAdmin_Client_Search]
    @Search        NVARCHAR(200) = NULL,
    @IsActive      BIT           = NULL,
    @ProjectSetupId INT          = NULL,
    @SortBy        VARCHAR(50)   = 'ClientName',
    @SortDir       VARCHAR(4)    = 'ASC',
    @Page          INT           = 1,
    @PageSize      INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    -- Server-side clamping: the SP is the last line of defence, not the API.
    IF @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
    IF @PageSize > 100 SET @PageSize = 100;
    IF @SortDir NOT IN ('ASC','DESC') SET @SortDir = 'ASC';
    IF @SortBy NOT IN ('Id','ClientName','ClientCode','IsActive','ProjectSetupId')
        SET @SortBy = 'ClientName';

    -- LIKE metacharacters are neutralised here so the API never has to.
    DECLARE @Term NVARCHAR(210) = NULL;
    IF @Search IS NOT NULL AND LTRIM(RTRIM(@Search)) <> ''
        SET @Term = '%' + REPLACE(REPLACE(REPLACE(@Search,'\','\\'),'%','\%'),'_','\_') + '%';

    SELECT
        c.Id, c.ClientName, c.ClientCode, c.InboundFolder, c.OutboundFolder,
        c.IsMergingEnabled, c.IsActive, c.StateColumn, c.UniqueColumns,
        c.IsZipExtractionEnabled, c.FileNumberColumn, c.ProjectSetupId,
        COUNT(*) OVER () AS TotalCount
    FROM dbo.ProVestClient c
    WHERE (@IsActive       IS NULL OR c.IsActive = @IsActive)
      AND (@ProjectSetupId IS NULL OR c.ProjectSetupId = @ProjectSetupId)
      AND (@Term IS NULL OR
              c.ClientName      LIKE @Term ESCAPE '\'
           OR c.ClientCode      LIKE @Term ESCAPE '\'
           OR c.StateColumn     LIKE @Term ESCAPE '\'
           OR c.UniqueColumns   LIKE @Term ESCAPE '\'
           OR c.FileNumberColumn LIKE @Term ESCAPE '\'
           OR c.InboundFolder   LIKE @Term ESCAPE '\'
           OR c.OutboundFolder  LIKE @Term ESCAPE '\')
    ORDER BY
        CASE WHEN @SortDir='ASC'  AND @SortBy='ClientName'     THEN c.ClientName     END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ClientName'     THEN c.ClientName     END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='ClientCode'     THEN c.ClientCode     END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ClientCode'     THEN c.ClientCode     END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='IsActive'       THEN c.IsActive       END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='IsActive'       THEN c.IsActive       END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='ProjectSetupId' THEN c.ProjectSetupId END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ProjectSetupId' THEN c.ProjectSetupId END DESC,
        CASE WHEN @SortDir='DESC' AND @SortBy='Id'             THEN c.Id             END DESC,
        c.Id ASC                              -- default + deterministic tiebreaker
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY;
END
```

Notes:
- `COUNT(*) OVER ()` gives the pre-paging total in a single pass — no second query, no `OUTPUT` param to thread through Dapper.
- If F4 resolves to *case-sensitive*, every `LIKE` above gains an explicit `COLLATE Latin1_General_CS_AS` (exact suffix depends on the verified collation). That decision is one edit per SP and is why it needs settling before I write them.

### Canonical guarded-write shape (no-PK tables)

```sql
CREATE PROCEDURE [dbo].[usp_ProVestAdmin_ImportUpdate_Delete]
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        BEGIN TRANSACTION;

        DECLARE @Matches INT;
        SELECT @Matches = COUNT(*) FROM dbo.Import_Update WITH (UPDLOCK, HOLDLOCK) WHERE id = @Id;

        IF @Matches = 0
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, 'No Import_Update row found for the supplied id.', 1;
        END
        IF @Matches > 1
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51002, 'Import_Update.id is not unique; refusing to delete multiple rows.', 1;
        END

        DELETE FROM dbo.Import_Update WHERE id = @Id;

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END
```

`UPDLOCK, HOLDLOCK` closes the race where a concurrent insert makes `id` non-unique between the check and the delete.

---

## 6. Integrity Check page (read-only)

Because F6's links have no FKs, one screen surfaces what the importer will trip over:

| Check | Query shape |
|---|---|
| `ProVestColumnMapping.ImporterId` with no `Import_Update.id` | anti-join |
| `ImportFileHeader.importer_id` with no `Import_Update.id` | anti-join |
| `ImportFileHeader.client_id` not in `ProVestClientLocation.LocationId` | anti-join |
| `Import_Update.client_id` not in `ProVestClientLocation.LocationId` | anti-join |
| `Import_Update` rows with `id IS NULL` or duplicated `id` | group-by-having |
| `ImportFileHeader` rows with `id IS NULL` or duplicated `id` | group-by-having |
| `ImportFileHeader.unique_key` collisions within a `client_id` | group-by-having |
| Active `ProVestClientLocation` whose `LocationId` has no importer at all | anti-join |

This is cheap to build, uses no writes, and is the single highest-value screen in the tool for the people who currently debug `ProVestErrorLog` by hand.

---

## 7. Proposed project structure

```
UI-Provest/
├─ docs/
│  └─ DESIGN.md                          # this file
├─ db/
│  └─ StoredProcedures/                  # 26 .sql files, one per SP
│     └─ _deploy.sql                      # ordered runner for dev
├─ src/
│  ├─ ProVest.Admin.Api/                  # ASP.NET Core 8 Web API
│  │  ├─ Program.cs
│  │  ├─ Endpoints/                       # mirrors OQMS.API's per-feature folders
│  │  │  ├─ Clients/{List,GetById,Create,Update,Deactivate}.cs
│  │  │  ├─ ClientLocations/…
│  │  │  ├─ ColumnMappings/…
│  │  │  ├─ ImportUpdates/…
│  │  │  ├─ ImportFileHeaders/…
│  │  │  ├─ Lookups/…
│  │  │  └─ Integrity/Check.cs
│  │  ├─ Contracts/                       # request/response DTOs + FluentValidation
│  │  ├─ Services/                        # I*Service + implementations (Dapper → SP)
│  │  ├─ Data/                            # SqlConnectionFactory, SP name constants
│  │  ├─ Infrastructure/
│  │  │  ├─ ProblemDetailsMiddleware.cs   # SqlException → ProblemDetails
│  │  │  └─ SortWhitelist.cs              # mirrors the SP whitelists
│  │  ├─ appsettings.json
│  │  └─ web.config                       # ANCM v2, InProcess
│  └─ provest-admin-web/                  # React 18 + TS + Vite
│     ├─ src/
│     │  ├─ api/                          # typed fetch client, one module per resource
│     │  ├─ tables/                       # per-table column metadata + zod schemas
│     │  │  ├─ registry.ts                # TABLE_REGISTRY drives selector + grid
│     │  │  ├─ provestClient.ts
│     │  │  ├─ provestClientLocation.ts
│     │  │  ├─ provestColumnMapping.ts
│     │  │  ├─ importUpdate.ts
│     │  │  └─ importFileHeader.ts
│     │  ├─ components/
│     │  │  ├─ TableSelector.tsx
│     │  │  ├─ DataGrid.tsx               # generic, metadata-driven
│     │  │  ├─ FilterBar.tsx
│     │  │  ├─ RecordForm.tsx             # generic create/edit
│     │  │  ├─ DeleteDialog.tsx
│     │  │  └─ ErrorBanner.tsx
│     │  ├─ pages/{TablePage,IntegrityPage}.tsx
│     │  └─ hooks/useTableQuery.ts
│     └─ vite.config.ts
└─ README.md
```

### Frontend approach

One **metadata-driven** grid and form rather than five hand-written pairs. Each `tables/*.ts` module declares:

```ts
export const importUpdateTable: TableDef = {
  key: 'import-updates',
  label: 'Import_Update',
  resource: '/api/admin/import-updates',
  permissions: { create: true, update: true, delete: true },
  idField: 'id',
  columns: [
    { field: 'id',                 label: 'Id',              type: 'int',  sortable: true,  gridWidth: 80 },
    { field: 'client_id',          label: 'Location Id',     type: 'int',  sortable: true,  help: 'ProVestClientLocation.LocationId — NOT ProVestClient.Id' },
    { field: 'lawfirm_filenumber', label: 'Lawfirm File #',  type: 'text', sortable: true,  maxLength: 500, searchable: true },
    // … 70 total, grouped for the form
  ],
  formGroups: [
    { title: 'Identity',   fields: ['id','client_id','lawfirm_filenumber','3rdparty_filenumber'] },
    { title: 'Parties',    fields: ['plaintiff','plaintiff2','defendant','defendant2'] },
    { title: 'Court',      fields: ['court_name','court_type','court_county','court_city','court_state','court_zip','court_date','court_time','court_room','court_room2'] },
    { title: 'Servee 1',   fields: ['servee_last_name','servee_name','servee_address','servee_apt','servee_city','servee_state','servee_zip'] },
    { title: 'Servee 2',   fields: ['servee_last_name2','servee_name2','servee_address2','servee_apt2','servee_city2','servee_state2','servee_zip2'] },
    { title: 'Employer',   fields: ['employer_name','employer_address1','employer_address2','employer_city','employer_state','employer_zip'] },
    { title: 'Financial',  fields: ['suit_amt','principal','interest','court_cost','atty_cost','chargeoff_date','kasebilling_checknum','kasebilling_amt','date_prepaid_check'] },
    { title: 'Additional', fields: ['additional_info1','…','client_data8','misc_1','dob','special_instructions'] },
  ],
};
```

A 70-column form is unusable as one flat list; the `formGroups` split makes it a tabbed/accordion form. `Import_Update` is the only table that needs this treatment.

Libraries: **TanStack Query** (server state + cache invalidation on mutate), **TanStack Table** (headless, controlled — pagination/sort state lives in the URL so a filtered view is shareable), **react-hook-form + zod** (schemas generated from the same column metadata, so `maxLength` is enforced client- and server-side from one declaration), **MUI** for components.

Grid is always controlled server-side: `pagination`, `sorting`, `columnFilters`, and `globalFilter` are query params, never client-side array operations. Nothing beyond one page of rows ever enters memory.

---

## 8. Hosting on IIS

- API published self-contained or framework-dependent to `C:\inetpub\ProVestAdmin\api`, IIS app pool **No Managed Code**, ANCM v2 **InProcess** (matching `OQMS.API/web.config`).
- App pool identity must be a Windows account with `EXECUTE` on the 26 SPs and **no** table-level `SELECT/INSERT/UPDATE/DELETE`. This is what actually enforces "no arbitrary SQL / no arbitrary table access" — the API code alone does not.
- React built to static assets served from the same site under `/` with the API at `/api`, so there is no CORS surface at all.
- `web.config` rewrite rule for SPA fallback to `index.html`.
- Connection string via `appsettings.Development.json` + environment variable override; `Integrated Security=True` matching the existing solution.

---

## 9. Security posture with auth disabled

Auth is intentionally off, so the defence is entirely in the data layer:

1. **DB permissions** — `GRANT EXECUTE` on the 26 SPs only. No direct table rights. A SQL-injection bug then has nothing to reach.
2. **No dynamic SQL** — every SP is static text; `@SortBy` is a whitelist `IF`, never concatenated.
3. **No table/column names on the wire** — the API exposes fixed resource routes; the client cannot name a table or column.
4. **`pageSize` clamped in the SP**, not just the controller.
5. **`LIKE` metacharacters escaped in the SP**, so a `%` in a search box is a literal `%`, not a full scan.
6. **Bind the site to the internal network / a non-public IIS binding**, and note in the README that this must not be deployed with the current auth posture to anything reachable outside.

I'd add a `[HasPermission]`-shaped seam now (a no-op attribute) so wiring the existing `SharedKernal.AuthorizeHandler` later is a one-line change per endpoint rather than a refactor.

---

## 10. Decisions and open questions

### Settled (2026-08-13)

**D1 — `ProVestColumnMapping` (F1): read-only + explicit regenerate action.**
The grid and detail view are read-only. `POST /api/admin/column-mappings/regenerate` takes `{ importerId }` and calls `usp_ProVestAdmin_ColumnMapping_RegenerateForImporter`, a scoped port of `Add_ProVestClientMapping_Data.sql` that deletes and reinserts only that importer's rows. `Import_Update` remains the source of truth; the derivation stays visible to the user instead of being a background surprise. The UI shows the regenerate action on the `Import_Update` detail view as well, since that's where the edit that necessitates it happens.

**D2 — Row identity (F3): guarded `id`, unaddressable rows visible but read-only.**
All write SPs use the `COUNT(*) … WITH (UPDLOCK, HOLDLOCK)` guard shown in §5. Rows with `id IS NULL` or a duplicated `id` render in the grid with a badge, edit/delete disabled, tooltip explaining why, and are listed on the Integrity Check page (§6) so they can be fixed at the DB level. The list SPs return an `IsAddressable` computed column so the grid doesn't have to infer it:

```sql
CASE WHEN iu.id IS NULL THEN 0
     WHEN COUNT(*) OVER (PARTITION BY iu.id) > 1 THEN 0
     ELSE 1 END AS IsAddressable
```

**D3 — Delete semantics: soft for the client tables, hard for the import tables.**
`ProVestClient` and `ProVestClientLocation` → `IsActive = 0` via `_Deactivate` SPs. `Import_Update` and `ImportFileHeader` → hard `DELETE` under the D2 guard. The UI wording differs accordingly: "Deactivate" vs. "Delete permanently", and the delete dialog for the import tables states that the row is unrecoverable.

**D4 — Audit trail: Serilog only, no schema change.**
Every mutating endpoint logs a structured event before and after the SP call: table, operation, target id, the full before-image (fetched via the `_GetById` SP inside the same transaction scope), the after-image, and outcome. Sinks match the reference solution's Serilog configuration. No new tables, nothing added to the five in scope.

**D5 — Standalone project.** Confirmed by the brief — a fresh repo at `UI-Provest`, not a module inside the Angular `OQMS.Web`.

### Still open

**Q1 — Collation (F4). Blocking.** The project declares CI, there is no `COLLATE` clause anywhere in the DB project, and the importer compares `OrdinalIgnoreCase` + space-stripped; the brief says case-sensitive. Please run the query in F4 and paste the output. This decides whether every `LIKE` in the search SPs carries an explicit `COLLATE … _CS_AS`.

**Q2 — Row counts.** Please run `SELECT COUNT(*)` on all five. Seed data is 349 / 1502 / small — if dev really holds 10,000+ in `Import_Update`, something outside this solution is writing to it and I need to know what before designing around it.

**Q3 — Concurrency.** No `rowversion` on any of the five. Proposal: last-write-wins, with the D2 uniqueness guard as the only protection. Reasonable for an internal dev tool with few concurrent users; say so if not.

**Q4 — `ImportFileHeader.col_1..col_60` in the grid.** Proposal: show `id`, `client_id`, `importer_id`, `col_1..col_8`, and a truncated `unique_key`; all 60 in the detail/edit view. Alternative is a horizontally scrolling 64-column grid.

**Q5 — Bulk operations.** Any need for bulk edit, CSV export of a filtered view, or clone-an-importer? Out of current scope; cheap to fold into the design now, expensive to retrofit later.

---

## 11. Suggested build order (post-approval)

1. `db/StoredProcedures` — all 26 SPs + deploy runner; verify each against dev with `SET STATISTICS IO`.
2. API skeleton: `Program.cs`, `SqlConnectionFactory`, `ProblemDetailsMiddleware`, `/api/admin/tables`.
3. `ProVestClient` end-to-end (SP → service → endpoints → grid → form → delete) as the vertical slice that proves the pattern.
4. `ProVestClientLocation` + FK lookups.
5. `ProVestColumnMapping` (read + regenerate).
6. `ImportFileHeader`.
7. `Import_Update` (largest form; last, once `formGroups` is proven).
8. Integrity Check page.
9. IIS publish profile + `web.config` + README deployment steps.
