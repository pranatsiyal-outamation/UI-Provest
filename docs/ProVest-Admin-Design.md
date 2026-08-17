# ProVest FM Admin Tool — Design

Internal web app to view and edit 5 SQL Server tables. Dev database, auth disabled, prototype scope.

**Architecture:** React + TypeScript (Vite) → ASP.NET Core 8 Web API → Services → parameterised queries → SQL Server → IIS.

**Phase 1 uses inline queries, not stored procedures.** Procedures were the original plan
and are written and kept in [`db/phase2-stored-procedures/`](../db/phase2-stored-procedures/),
but deploying them is a schema write, and phase 1 needed to be testable without one. §4 covers
what that means, and §8 covers what it costs.

---

## 1. Facts that shape the design

**Collation is case-insensitive.** `sqlproj` declares `ModelCollation 1033, CI`, no `COLLATE` clause exists in the DB project, and the importer compares with `OrdinalIgnoreCase`. Searching `smith` matches `SMITH`. No SP contains a `COLLATE` clause — comparisons inherit the DB collation. The app never applies `UPPER`/`LOWER`/`ToUpperInvariant`; values are stored and returned exactly as entered.

**`ProVestColumnMapping` is generated from `Import_Update`.** `OQMS.Database/Scripts/Add_ProVestClientMapping_Data.sql` does `DELETE FROM ProVestColumnMapping; INSERT … SELECT FROM Import_Update`. So `ProVestColumnMapping.ImporterId` **is** `Import_Update.id`, and `ColumnName` **is** a client header copied out of an `Import_Update` cell. Edits to `ProVestColumnMapping` are wiped when that script runs.
→ **`ProVestColumnMapping` is read-only here.** `Import_Update` is the source of truth, with an explicit per-importer regenerate action.

**`Import_Update` and `ImportFileHeader` have no PK, no unique constraint, no identity.** `id` is a nullable int. Nothing guarantees a single row is addressable, and no schema changes are in scope.
→ Every write SP carries a runtime uniqueness guard. Rows with null or duplicate `id` are shown read-only.

**`client_id` on the import tables is not `ProVestClient.Id`.** Traced through `FMService.cs:1544`: `GetClientIdForRecord()` returns `ProVestClientLocation.LocationId`, which is matched against `ImportFileHeader.client_id`.

```
ProVestClientLocation.LocationId  ==  ImportFileHeader.client_id  ==  Import_Update.client_id
ProVestClient.Id                  !=  either
```

No FK enforces it. → **The UI labels this "Location Id", never "Client".**

**These two tables hold column header names, not case data.** One row = one importer layout. `Import_Update` cells hold the client header feeding each standard column; `ImportFileHeader.col_1..col_60` hold the raw header row and `unique_key` is those headers concatenated. → UI says "importer layouts", not "records".

**Enforced FKs** (drive dropdowns, produce SQL 547 to translate):
`ProVestColumnMapping.ProVestStandardColumnId` → `ProVestStandardColumn.Id` · `ProVestClientLocation.ProVestClientId` → `ProVestClient.Id` · `ProVestClient.ProjectSetupId` and `ProVestClientLocation.ProjectSetupId` → `ProjectSetup.Id` (both nullable).

**Unenforced links** (tool can create orphans; accepted for prototype):
`ProVestColumnMapping.ImporterId` and `ImportFileHeader.importer_id` → `Import_Update.id` · `client_id` on both import tables → `ProVestClientLocation.LocationId`.

**Column counts:** `Import_Update` has **71** columns (`id`, `client_id`, 68 × `nvarchar(500)`, and `special_instructions nvarchar(max)`). `ImportFileHeader` has **64** (`id`, `client_id`, `col_1..col_60`, `importer_id`, `unique_key nvarchar(max)`) — note `importer_id` sits *after* `col_60` in the DDL. Both verified against the `CREATE TABLE` statements in `QMS-771-Provest-Importer-Files-Migration-From-UAT.sql`.

**Schema traps:** `[3rdparty_filenumber]` starts with a digit — bracket-quote everywhere; the C# property is `thirdparty_filenumber` with `[JsonPropertyName("3rdparty_filenumber")]`. Bracket-quote all 71 `Import_Update` columns. `special_instructions` and `unique_key` are `nvarchar(max)` — never in list queries. Deleting a `ProVestClient` hits FK 547 from `ProVestClientLocation` and `ProVestErrorLog`.

**Target DB varies by connection string** → no hardcoded database name, two-part SP names (`dbo.X`), no `USE` statements.

---

## 2. CRUD matrix

| Table | Create | Read | Update | Delete |
|---|:--:|:--:|:--:|---|
| `ProVestClient` | ✅ | ✅ | ✅ | Hard — blocked by FK while referenced |
| `ProVestClientLocation` | ✅ | ✅ | ✅ | Hard |
| `ProVestColumnMapping` | ❌ | ✅ | ❌ | ❌ read-only |
| `Import_Update` | ✅ | ✅ | ✅ | Hard, guarded |
| `ImportFileHeader` | ✅ | ✅ | ✅ | Hard, guarded |
| `ProVestStandardColumn` | ❌ | ✅ | ❌ | ❌ lookup only |
| `ProjectSetup` | ❌ | ✅ | ❌ | ❌ lookup only |

**All five tables hard-delete.** An earlier revision soft-deleted the two client tables via
`IsActive`; that was dropped because it conflated two different things — "the importer should
skip this" and "this record should not exist". `IsActive` remains an editable column on the
form, because the importer genuinely reads it.

The foreign keys are left to do the work rather than being worked around. Deleting a
`ProVestClient` fails with SQL 547 while any `ProVestClientLocation` or `ProVestErrorLog` row
references it, and the API turns that into a 409 naming the blocking table, so the sequence is
"delete the locations, then the client". Nothing references `ProVestClientLocation`, so those
delete freely.

Note 547 arrives in two flavours and they mean opposite things: a blocked DELETE is a
**REFERENCE constraint** ("something still points at this row"), while a bad INSERT/UPDATE is a
**FOREIGN KEY constraint** ("this row points at nothing"). The middleware distinguishes them —
identical advice for both would be wrong half the time. The raw database message is attached as
a `sqlError` extension either way.

`ProVestStandardColumn` and `ProjectSetup` are the two extra tables needed read-only for FK dropdowns.

---

## 3. Search, filter, sort

`search` = `LIKE '%term%'` OR'd across the listed columns. `filters` = exact match. `sort` = whitelist validated **inside the SP**.

| Table | Search | Filters | Sortable | Default |
|---|---|---|---|---|
| `ProVestClient` | `ClientName`, `ClientCode`, `StateColumn`, `UniqueColumns`, `FileNumberColumn` | `IsActive`, `IsMergingEnabled`, `IsZipExtractionEnabled`, `ProjectSetupId` | `Id`, `ClientName`, `ClientCode`, `IsActive` | `ClientName ASC` |
| `ProVestClientLocation` | `State`, joined `ProVestClient.ClientName` and `.ClientCode` | `ProVestClientId`, `LocationId`, `State`, `IsActive`, `ProjectSetupId` | `Id`, `ProVestClientId`, `LocationId`, `State`, `IsActive` | `ProVestClientId, State` |
| `ProVestColumnMapping` | `ColumnName`, joined `ProVestStandardColumn.ColumnName` | `ImporterId`, `ProVestStandardColumnId` | `Id`, `ImporterId`, `ColumnName` | `ImporterId, Id` |
| `ImportFileHeader` | `unique_key` | `id`, `client_id`, `importer_id` | `id`, `client_id`, `importer_id` | `client_id, importer_id` |
| `Import_Update` | `lawfirm_filenumber`, `plaintiff`, `defendant`, `document_type`, `index_number`, `court_name`, `servee_name`, `client_ref`, `creditor` | `id`, `client_id` | `id`, `client_id`, `lawfirm_filenumber`, `plaintiff` | `id ASC` |

- `ImportFileHeader` searches `unique_key` alone — it's the concatenation of `col_1..col_60`, so one predicate covers all 60.
- `Import_Update` sort is limited to 4 columns. A `CASE`-based `ORDER BY` over 71 columns × 2 directions is 142 branches.
- Every sort appends a deterministic tiebreaker (`Id`/`id`), or `OFFSET/FETCH` repeats and skips rows across pages.

---

## 4. Data access

SQL lives in the service classes as `const` strings, one service per table. Every value is a
Dapper parameter — nothing caller-supplied is ever concatenated into SQL.

Four properties used to be enforced by the procedures and are now enforced in
`Services/ServiceBase.cs`. They are worth naming individually, because in phase 1 this file is
the only thing enforcing them:

| Property | Where it lives now |
|---|---|
| Values parameterised | Dapper, everywhere |
| Sort whitelist | `ServiceBase.OrderBy` — see below |
| Page size clamped to 100 | `ServiceBase.ClampPageSize` |
| `LIKE` metacharacters escaped | `ServiceBase.SearchTerm` |
| Row-uniqueness guard on the no-PK tables | C# transaction + `UPDLOCK, HOLDLOCK` |

**`ORDER BY` cannot be parameterised**, which is the one place a query is assembled rather than
fixed. The request string is used *only as a dictionary key*; the fragment that reaches SQL is
always a compile-time constant:

```csharp
private static readonly Dictionary<string, string> Sortable = new(StringComparer.OrdinalIgnoreCase)
{
    ["Id"]         = "t.Id",
    ["ClientName"] = "t.ClientName",
    ["ClientCode"] = "t.ClientCode",
    ["IsActive"]   = "t.IsActive",
};

// requested is user input; mapped is not. An unrecognised key falls back to the default.
var column = requested is not null && allowed.TryGetValue(requested, out var mapped)
    ? mapped
    : allowed[defaultKey];
var dir = string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC";
return $"ORDER BY {column} {dir}, {tiebreaker}";
```

Guard failures raise `RecordNotFoundException` / `RecordNotUniqueException` /
`RecordIdInUseException`, which `SqlErrorMiddleware` maps to the same 404/409 responses the
`THROW 51001/51002/51003` used to produce. The API contract is unchanged.

The 25 stored procedures that would replace all of this are written and kept in
[`db/phase2-stored-procedures/`](../db/phase2-stored-procedures/).

### Canonical search — phase 2 form, for reference

The procedure below is the phase 2 equivalent of `ClientService.SearchSql`. The phase 1 query is
the same text with `@SortBy`/`@SortDir` resolved in C# instead of a `CASE`-based `ORDER BY`.

```sql
CREATE PROCEDURE [dbo].[usp_ProVestAdmin_Client_Search]
    @Search         NVARCHAR(200) = NULL,
    @IsActive       BIT           = NULL,
    @ProjectSetupId INT           = NULL,
    @SortBy         VARCHAR(50)   = 'ClientName',
    @SortDir        VARCHAR(4)    = 'ASC',
    @Page           INT           = 1,
    @PageSize       INT           = 50
AS
BEGIN
    SET NOCOUNT ON;

    -- The SP is the last line of defence, not the API.
    IF @Page < 1 SET @Page = 1;
    IF @PageSize IS NULL OR @PageSize < 1 SET @PageSize = 50;
    IF @PageSize > 100 SET @PageSize = 100;
    IF @SortDir NOT IN ('ASC','DESC') SET @SortDir = 'ASC';
    IF @SortBy NOT IN ('Id','ClientName','ClientCode','IsActive') SET @SortBy = 'ClientName';

    -- LIKE metacharacters neutralised here so the API never has to.
    DECLARE @Term NVARCHAR(210) = NULL;
    IF @Search IS NOT NULL AND LTRIM(RTRIM(@Search)) <> ''
        SET @Term = '%' + REPLACE(REPLACE(REPLACE(@Search,'\','\\'),'%','\%'),'_','\_') + '%';

    SELECT
        c.Id, c.ClientName, c.ClientCode, c.IsMergingEnabled, c.IsActive,
        c.StateColumn, c.UniqueColumns, c.IsZipExtractionEnabled,
        c.FileNumberColumn, c.ProjectSetupId,
        COUNT(*) OVER () AS TotalCount
    FROM dbo.ProVestClient c
    WHERE (@IsActive       IS NULL OR c.IsActive = @IsActive)
      AND (@ProjectSetupId IS NULL OR c.ProjectSetupId = @ProjectSetupId)
      AND (@Term IS NULL OR
              c.ClientName       LIKE @Term ESCAPE '\'
           OR c.ClientCode       LIKE @Term ESCAPE '\'
           OR c.StateColumn      LIKE @Term ESCAPE '\'
           OR c.UniqueColumns    LIKE @Term ESCAPE '\'
           OR c.FileNumberColumn LIKE @Term ESCAPE '\')
    ORDER BY
        CASE WHEN @SortDir='ASC'  AND @SortBy='ClientName' THEN c.ClientName END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ClientName' THEN c.ClientName END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='ClientCode' THEN c.ClientCode END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='ClientCode' THEN c.ClientCode END DESC,
        CASE WHEN @SortDir='ASC'  AND @SortBy='IsActive'   THEN c.IsActive   END ASC,
        CASE WHEN @SortDir='DESC' AND @SortBy='IsActive'   THEN c.IsActive   END DESC,
        CASE WHEN @SortDir='DESC' AND @SortBy='Id'         THEN c.Id         END DESC,
        c.Id ASC                                  -- default + tiebreaker
    OFFSET (@Page - 1) * @PageSize ROWS
    FETCH NEXT @PageSize ROWS ONLY
    OPTION (RECOMPILE);
END
```

`COUNT(*) OVER ()` returns the pre-paging total in one pass — no second query. `OPTION (RECOMPILE)` prevents the `(@Param IS NULL OR col = @Param)` pattern from caching one plan built for whichever parameter combination ran first. `InboundFolder`/`OutboundFolder` are `varchar(max)` and come from `_GetById`, not the list.

### Canonical guarded write (no-PK tables)

`Import_Update` and `ImportFileHeader` have no primary key, so every write checks that exactly
one row matches before touching anything:

```csharp
await InTransactionAsync(async (connection, transaction) =>
{
    await GuardSingleRowAsync(connection, transaction, id);
    return await connection.ExecuteAsync(DeleteSql, new { Id = id }, transaction);
}, ct);

// UPDLOCK, HOLDLOCK closes the race where a concurrent insert makes the id
// non-unique between this check and the write that follows it.
private static async Task GuardSingleRowAsync(IDbConnection connection, IDbTransaction transaction, int id)
{
    var matches = await connection.ExecuteScalarAsync<int>(
        "SELECT COUNT(*) FROM dbo.Import_Update WITH (UPDLOCK, HOLDLOCK) WHERE id = @Id",
        new { Id = id }, transaction);

    if (matches == 0) throw new RecordNotFoundException(TableName);
    if (matches > 1) throw new RecordNotUniqueException(TableName);
}
```

Insert additionally refuses an id that already exists — creating a duplicate would make *both*
rows uneditable afterwards.

### `IsAddressable`

Both no-PK list queries return a flag so the grid doesn't have to infer it. Uniqueness is a
property of the **whole table**, not of the filtered page — a window function over the filtered
set would report a duplicated id as addressable whenever a filter happened to isolate one of its
rows, so duplicates are collected first:

```sql
WITH Dups AS (
    SELECT id FROM dbo.Import_Update
    WHERE id IS NOT NULL GROUP BY id HAVING COUNT(*) > 1
)
SELECT ...,
    CAST(CASE WHEN t.id IS NULL THEN 0
              WHEN EXISTS (SELECT 1 FROM Dups d WHERE d.id = t.id) THEN 0
              ELSE 1 END AS BIT) AS IsAddressable
```

### Generated SQL

The `SELECT`, `INSERT` and `UPDATE` fragments for the two wide tables (71 and 64 columns) are
generated into `Data/ImportUpdateSql.g.cs` and `Data/ImportFileHeaderSql.g.cs` from the same
`CREATE TABLE` extraction that produces the C# contracts and the TypeScript types, so the three
layers cannot drift apart. Regenerate rather than hand-editing.

---

## 5. API

```
GET /api/admin/{resource}
  ?page=1&pageSize=50&search=<term>&sortBy=<col>&sortDir=asc|desc&<filter>=<value>

{ "items": [...], "page": 1, "pageSize": 50, "totalCount": 349, "totalPages": 7 }
```

Five explicit resources, one route per table. No registry or discovery endpoint — the frontend knows its own tables.

| Method | Route |
|---|---|
| `GET` `POST` | `/api/admin/clients` |
| `GET` `PUT` `DELETE` | `/api/admin/clients/{id}` |
| `GET` `POST` | `/api/admin/client-locations` |
| `GET` `PUT` `DELETE` | `/api/admin/client-locations/{id}` |
| `GET` | `/api/admin/column-mappings` |
| `POST` | `/api/admin/column-mappings/regenerate` — body `{ importerId }` |
| `GET` `POST` | `/api/admin/import-updates` |
| `GET` `PUT` `DELETE` | `/api/admin/import-updates/{id}` |
| `GET` `POST` | `/api/admin/import-file-headers` |
| `GET` `PUT` `DELETE` | `/api/admin/import-file-headers/{id}` |
| `GET` | `/api/admin/lookups/standard-columns` |
| `GET` | `/api/admin/lookups/project-setups` |
| `GET` | `/api/admin/lookups/clients` |

### Errors

RFC 7807 `ProblemDetails` with a field-level `errors` extension. Raw `SqlException` text never reaches the browser.

| Condition | HTTP | Shown as |
|---|:--:|---|
| Model validation | 400 | Inline field errors |
| Not found | 404 | "Record no longer exists — refresh." |
| `id` not unique | 409 | "This row can't be edited: `id` is not unique." |
| FK violation (547) | 409 | "Project Setup 42 does not exist." |
| Truncation (2628/8152) | 400 | Mapped to the offending field |
| Other | 500 | Generic message + correlation id; detail to Serilog |

---

## 6. Performance

`OFFSET/FETCH` pagination, done properly, from the start:

- Server-side pagination, search, and sort. The browser never receives more than one page.
- `pageSize` default 50, max 100, **clamped in the SP** — not just the controller.
- Deterministic sort tiebreaker on every query, or paging repeats and skips rows.
- `COUNT(*) OVER ()` for the total, in the same pass as the page.
- `OPTION (RECOMPILE)` on search SPs.
- No `nvarchar(max)` column in any list query.
- List SPs return grid columns only — `Import_Update` returns ~11, not 71.
- Search debounced 300 ms client-side.

`Import_Update` and `ImportFileHeader` are unindexed heaps, so every query against them — including the write-path uniqueness guard — is a full scan. That's fine at current volume. If it stops being fine, four additive nonclustered indexes on `(id)` and `(client_id)` are the fix.

---

## 7. Structure

```
UI-Provest/
├─ docs/
├─ db/phase2-stored-procedures/  # 25 .sql + _deploy.sql, not deployed (see §4)
└─ src/
   ├─ ProVest.Admin.Api/         # ASP.NET Core 8
   │  ├─ Endpoints/
   │  │  ├─ Clients/             # List, GetById, Create, Update, Deactivate
   │  │  ├─ ClientLocations/
   │  │  ├─ ColumnMappings/      # List, Regenerate
   │  │  ├─ ImportUpdates/
   │  │  ├─ ImportFileHeaders/
   │  │  └─ Lookups/
   │  ├─ Contracts/              # request/response DTOs + validation, per table
   │  ├─ Services/               # I*Service → Dapper → SP, per table
   │  ├─ Data/                   # SqlConnectionFactory, SP name constants
   │  ├─ Infrastructure/         # ProblemDetails middleware
   │  └─ web.config              # ANCM v2, InProcess
   └─ provest-admin-web/         # React 18 + TS + Vite
      └─ src/
         ├─ api/
         │  ├─ http.ts           # fetch wrapper + ProblemDetails parsing
         │  ├─ clients.ts        # one typed module per resource
         │  ├─ clientLocations.ts
         │  ├─ columnMappings.ts
         │  ├─ importUpdates.ts
         │  ├─ importFileHeaders.ts
         │  └─ lookups.ts
         ├─ components/          # the shared four + confirm dialog
         │  ├─ DataGrid.tsx
         │  ├─ Pagination.tsx
         │  ├─ SearchBar.tsx
         │  ├─ ErrorBanner.tsx
         │  └─ ConfirmDialog.tsx
         ├─ hooks/useListState.ts   # page / pageSize / search / sort → query params
         ├─ pages/
         │  ├─ ClientsPage.tsx           ClientForm.tsx
         │  ├─ ClientLocationsPage.tsx   ClientLocationForm.tsx
         │  ├─ ColumnMappingsPage.tsx    # read-only, no form
         │  ├─ ImportUpdatesPage.tsx     ImportUpdateForm.tsx
         │  └─ ImportFileHeadersPage.tsx ImportFileHeaderForm.tsx
         └─ App.tsx              # nav + routes
```

**Shared plumbing, table-specific pages.** Four shared pieces carry everything repetitive:

| Component | Responsibility |
|---|---|
| `DataGrid` | Takes `columns` and `rows` as props, renders the table, emits sort clicks. Knows nothing about any specific table. |
| `Pagination` | Page controls + page-size selector (50 / 100), driven by `totalCount`. |
| `SearchBar` | Debounced text input. |
| `ErrorBanner` | Renders a `ProblemDetails` — top-level message plus per-field errors. |

`useListState` holds page / pageSize / search / sort and turns them into query params, so all five pages get identical server-side list behaviour without a framework.

Everything else is written per table, explicitly. Each page declares its own column array and passes it to `DataGrid`; each form is a plain component with its own fields and validation. Five small explicit files beat one clever abstraction at this size, and when one table needs to behave differently, it just does — no metadata schema to extend.

`ImportUpdateForm` is the only unusual one: 71 fields in a flat form is unusable, so it groups them into sections (Identity, Parties, Court, Servee 1, Servee 2, Employer, Financial, Additional) as an accordion. That grouping lives in that one form, not in a shared config.

Libraries: **TanStack Query** for server state and cache invalidation on mutate, **react-hook-form** for form state, **MUI** for controls. No table/grid library — `DataGrid` is a plain component.

Audit is Serilog only — structured before/after images on each write. No schema change.

---

## 8. Security

**Authentication (added after the first build).** A cookie session — no JWT, no external
identity provider. Accounts live in the `Auth` section of `appsettings.Development.json`,
passwords in plaintext, which is why that file is gitignored and shipped as
`appsettings.Development.example.json`. Reasoning: anyone who can read that file can already
read the database connection string beside it, so hashing would protect very little.

An authorization *policy* is deliberately absent — every signed-in user can do everything.
This is a gate to stop casual access, especially over the ngrok tunnel, not an access-control
model. The one thing it buys beyond that: **the audit log now records who**, which matters
because these edits break client file imports and "who changed this importer" was previously
unanswerable.

Protection is applied as an authorization **fallback policy**, so a newly added controller is
protected by default rather than by someone remembering an attribute. `/api/auth/login` and
`/api/auth/me` opt out with `[AllowAnonymous]`; `me` returns 401 rather than redirecting, so
the client can probe for a session on load.

### Data-layer controls

1. **The application code is the only control.** With inline queries the app account needs
   `SELECT`/`INSERT`/`UPDATE`/`DELETE` on the five tables. The original design put enforcement in
   the database — `GRANT EXECUTE` on 25 procedures and no table rights — so that a bug in the API
   could not become a bug against the tables. **Phase 1 does not have that property.** It is the
   deliberate trade for removing the deploy step, and reinstating it is the point of phase 2.
2. No caller-supplied value is ever concatenated into SQL — everything is a Dapper parameter.
3. `ORDER BY` is the one assembled fragment, and the request string is used only as a key into a
   fixed dictionary (§4). An unrecognised sort falls back to the default.
4. No table or column names on the wire — fixed resource routes, no discovery endpoint.
5. `pageSize` clamped in `ServiceBase`, not just the controller.
6. `LIKE` metacharacters escaped in `ServiceBase.SearchTerm`.
7. No persistent public exposure. The ngrok tunnel in §9 is a deliberate, temporary exception for
   review — public URL, no auth, live writes — and comes down afterwards. Nothing gets a standing
   public binding in this auth posture.

Accepted for prototype: orphans on the four unenforced links, and the connection string being the only thing selecting the target database.

---

## 9. Running it

### Local (this is where we start)

Two processes:

```
dotnet run --project src/ProVest.Admin.Api     # https://localhost:7001
npm run dev  (in src/provest-admin-web)        # http://localhost:5173
```

Vite proxies `/api` → the API, so the browser sees **one origin**. No CORS config anywhere, and the local setup matches the eventual hosted layout:

```ts
// vite.config.ts
server: {
  proxy: { '/api': { target: 'https://localhost:7001', secure: false, changeOrigin: true } }
}
```

Connection string in `appsettings.Development.json`, `Integrated Security=True` — your Windows account connects to the dev DB.

### ngrok, for review

Because `/api` is proxied through Vite, **tunnel only the dev server** — one tunnel, one origin, API included:

```
ngrok http 5173
```

Vite rejects requests carrying an unfamiliar `Host` header, so the tunnel domain has to be
allowed. ngrok hands out several TLDs (`.ngrok-free.dev`, `.ngrok-free.app`, `.ngrok.io`…)
depending on account and vintage, so `vite.config.ts` allows all of them, always — a missing
TLD surfaces only as an opaque "Blocked request" page.

Only the HMR override is gated behind `--mode tunnel`, because `wss` on :443 is right through
the tunnel and wrong locally. Plain `npm run dev` works through ngrok; it just won't
live-reload.

**Worth being deliberate about:** the tunnel is a public URL, auth is disabled, and every write endpoint is live against the dev database. Anyone with the link can create, edit, and delete. Bring it up for the review, take it down after — don't leave it running.

### IIS

Deferred until the local review passes. It's a known shape — one site with the React build at `/` and the API as an application at `/api`, app pool on **No Managed Code**, ANCM v2 InProcess, URL Rewrite for SPA fallback, and a domain service account for the SQL connection. Details get worked out when we get there.

Note that the app pool identity currently needs table-level rights (§8). Narrowing it to
`EXECUTE`-only is phase 2 work, and worth doing before this is hosted anywhere shared.

---

## 10. Out of scope

Bulk edit · file/CSV import · CSV export · clone-an-importer · integrity/orphan reporting · arbitrary sort across all 71 `Import_Update` columns.

## 11. Open

**Concurrency** — no `rowversion` on any of the five tables. Proposal: last-write-wins, with the uniqueness guard as the only protection. Fine for few concurrent editors.

**`ImportFileHeader` grid columns** — proposal: `id`, `client_id`, `importer_id`, `col_1..col_8`, truncated `unique_key`; all 60 in the detail view. Alternative is a horizontally scrolling 64-column grid.

---

## 12. Status

Phase 1 is built. Both projects compile clean; **no SQL has been executed**, so the queries are
unproven until they run against a real database.

| | |
|---|---|
| ✅ | API — services, contracts, 6 controllers, ProblemDetails middleware, Serilog audit |
| ✅ | Shared frontend — `http.ts`, `DataGrid`, `Pagination`, `SearchBar`, `ErrorBanner`, `ConfirmDialog`, `useListState` |
| ✅ | All five page/form pairs, including the 71-field grouped form |
| ✅ | 25 stored procedures written, parked in `db/phase2-stored-procedures/` |
| ⬜ | End-to-end test against the dev database |
| ⬜ | Review over ngrok |
| ⬜ | IIS |

### Phase 2

- Move the queries into the parked stored procedures.
- Narrow the app account to `EXECUTE`-only, no table rights — this is the security property phase 1 gives up (§8).
- Revisit indexes on the two heaps if volume makes the full scans hurt (§6).
