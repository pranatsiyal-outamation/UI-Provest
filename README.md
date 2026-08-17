# ProVest FM Admin Tool

Internal web app for viewing and editing the five SQL Server tables that configure the
ProVest importer. Development database, **authentication disabled**, prototype scope.

Design: [docs/ProVest-Admin-Design.md](docs/ProVest-Admin-Design.md)

```
React + TypeScript (Vite)  ->  ASP.NET Core 8 Web API  ->  Services  ->  parameterised queries  ->  SQL Server
```

Phase 1 runs on inline queries. **Nothing needs to be deployed to the database to run this** —
point it at a connection string and go. The stored procedures that replace those queries in
phase 2 are written and parked; see [db/phase2-stored-procedures/](db/phase2-stored-procedures/)
for what moving over buys you.

## Layout

```
db/phase2-stored-procedures/  25 procedures + _deploy.sql -- NOT deployed, not called
src/ProVest.Admin.Api/        ASP.NET Core 8, Dapper, controllers
src/provest-admin-web/        React 19 + TypeScript + Vite + MUI
docs/                         design document
```

## Tables

| Table | Access |
|---|---|
| `ProVestClient` | full CRUD; delete blocked by FK while locations or error-log rows reference it |
| `ProVestClientLocation` | full CRUD; delete freely |
| `ProVestColumnMapping` | **read-only**, plus a per-importer regenerate |
| `Import_Update` | full CRUD; hard delete, guarded |
| `ImportFileHeader` | full CRUD; hard delete, guarded |

`ProVestStandardColumn` and `ProjectSetup` are read for dropdowns only.

## Things worth knowing before you edit anything

**`ProVestColumnMapping` is generated, not authored.** `OQMS.Database/Scripts/Add_ProVestClientMapping_Data.sql`
rebuilds it wholesale from `Import_Update`, so `ImporterId` **is** `Import_Update.id` and
`ColumnName` **is** a client header copied out of an `Import_Update` cell. Editing rows there
directly would be discarded on the next rebuild, which is why the tool exposes a scoped
"regenerate for this importer" action instead. Edit `Import_Update`, then regenerate.

**`client_id` on the import tables is not `ProVestClient.Id`.** It is
`ProVestClientLocation.LocationId`:

```
ProVestClientLocation.LocationId  ==  ImportFileHeader.client_id  ==  Import_Update.client_id
ProVestClient.Id                  !=  either
```

No foreign key enforces it, so a wrong number here fails silently and only shows up later as
`ImporterIdNotFound` in `ProVestErrorLog`. The UI labels it "Location Id" throughout.

**`Import_Update` and `ImportFileHeader` have no primary key.** `id` is a nullable `int` with no
identity and no unique constraint. Every write procedure checks that exactly one row matches
before touching anything, and rows whose `id` is null or duplicated show in the grid greyed out
with edit and delete disabled — they cannot be addressed, so the tool refuses rather than
guessing.

**Comparisons are case-insensitive.** The database collation is CI and no procedure contains a
`COLLATE` clause, so searching `smith` matches `SMITH`. The application never changes the case of
anything it stores or displays.

## Setup

Prerequisites: .NET 8 SDK, Node 20+, access to the ProVest development database.

### 1. Configuration

Copy the template and fill it in — the real file is gitignored because it holds the database
server *and* the sign-in passwords in plaintext:

```
cd src/ProVest.Admin.Api
copy appsettings.Development.example.json appsettings.Development.json
```

#### Sign-in accounts

```json
"Auth": {
  "SessionHours": 8,
  "Users": [
    { "Username": "pranat", "Password": "change-me", "DisplayName": "Pranat Siyal" }
  ]
}
```

Every account has identical rights — this is a gate to stop casual access, not an
authorisation model. Give people separate accounts anyway: **the username is recorded in the
audit log against every write**, and "who changed this importer" is otherwise unanswerable.

Sessions are a plain cookie (no JWT, no SSO), valid for `SessionHours` with sliding renewal.

**Change the default passwords before sharing the app with anyone, including over ngrok.**

#### Connection string

Set it in `src/ProVest.Admin.Api/appsettings.Development.json`:

```json
"ConnectionStrings": {
  "OQMS": "Data Source=<server>,<port>;Initial Catalog=<database>;Integrated Security=True;TrustServerCertificate=True;"
}
```

Or leave the file blank and set the environment variable instead, which keeps the server name
out of a checked-in file:

```
$env:ConnectionStrings__OQMS = "Data Source=...;Initial Catalog=...;Integrated Security=True;TrustServerCertificate=True;"
```

No database name is hardcoded anywhere in the app and every query uses two-part names, so this
connection string alone decides what the tool reads and writes. Point it carefully.

The account needs `SELECT`, `INSERT`, `UPDATE` and `DELETE` on the five tables, plus `SELECT` on
`ProVestStandardColumn`, `ProjectSetup` and `Project` for the dropdowns. That is broader than it
will be after phase 2 — see [Security](#security).

### 2. Run

Two terminals:

```
dotnet run --project src/ProVest.Admin.Api      # https://localhost:7001, Swagger at /swagger
```

```
cd src/provest-admin-web && npm install && npm run dev   # http://localhost:5173
```

Open <http://localhost:5173>. Vite proxies `/api` to the API, so the browser sees a single
origin and there is no CORS configuration anywhere.

If the browser rejects the API certificate, trust the ASP.NET Core development certificate once:

```
dotnet dev-certs https --trust
```

## Sharing for review over ngrok

Because `/api` is proxied through Vite, tunnelling the dev server tunnels the whole application —
one tunnel, one origin, API included.

```
cd src/provest-admin-web && npm run dev:tunnel
ngrok http 5173
```

`dev:tunnel` passes `--mode tunnel`, which turns on the host allow-list and the `wss` HMR
settings the tunnel needs. Plain `npm run dev` leaves those off, because they break local HMR.

**The tunnel is a public URL, authentication is disabled, and every write endpoint is live
against the database the connection string names.** Anyone with the link can create, edit and
delete. Bring it up for the review and take it down afterwards.

## Security

Authentication is off, and in phase 1 the application code is the **only** thing constraining
what reaches the database. Everything below lives in `Services/ServiceBase.cs` and the per-table
services:

- Every value is a Dapper parameter; nothing caller-supplied is concatenated into SQL.
- `ORDER BY` cannot be parameterised, so a sort request is used only as a key into a fixed
  dictionary — the fragment that reaches SQL is always a compile-time constant.
- Page size is clamped to 100 in the service, not just the controller.
- `LIKE` metacharacters are escaped, so a `%` typed into a search box is a literal `%`.
- Routes are fixed per table; no table or column name is ever accepted from the client.

What phase 1 gives up: the original design had the app account hold `EXECUTE` on 25 stored
procedures and **no table rights**, so a bug in the API could not become a bug against the
tables. Inline queries need table-level permissions, so that backstop is gone until phase 2.
Worth weighing before this points at anything but a dev database.

## Verification checklist

Per table: the list loads, paging moves correctly (check a row does not repeat between pages 1
and 2 — that is the sort tiebreaker doing its job), search filters server-side, sort flips, page
size switches between 50 and 100.

Then the error paths, which are the parts worth deliberately provoking:

| Try this | Expect |
|---|---|
| Save a client with a non-existent Project Setup | 409, "The referenced Project Setup does not exist." |
| Type past a field's length limit | Blocked at the input; if it reaches SQL, 400 against that field |
| Open a row shown greyed out | Edit and delete are disabled, tooltip explains the duplicate/null id |
| Delete a client that has locations | 409, "rows in ProVestClientLocation still reference it" |
| Delete those locations, then the client | Both succeed |
| Regenerate mappings for an importer | Only that importer's `ProVestColumnMapping` rows change |

## Notes

**Auditing** is Serilog only, to `src/ProVest.Admin.Api/logs/`. Every write logs the table,
operation, id, and the before and after images. No audit table, no schema change.

**Performance.** Paging, filtering and sorting are all server-side; the browser never holds more
than one page. Page size is capped at 100 inside the procedures, not just in the controller.
`Import_Update` and `ImportFileHeader` are unindexed heaps, so every query against them —
including the uniqueness check on each write — is a full scan. That is fine at current volume;
if it stops being fine, four nonclustered indexes on `(id)` and `(client_id)` are the fix.

**Regenerating the wide code.** The SQL fragments (`Data/*Sql.g.cs`), C# contracts
(`Contracts/*Contracts.g.cs`) and TypeScript types (`src/api/import*Types.ts`) for
`Import_Update` (71 columns) and `ImportFileHeader` (64) are all generated from the `CREATE TABLE`
statements in the UAT migration script, so the layers cannot drift apart. If those tables ever
change, regenerate rather than hand-editing.

**Phase 2.** Move the queries into the parked stored procedures and narrow the app account to
`EXECUTE`-only. See [db/phase2-stored-procedures/README.md](db/phase2-stored-procedures/README.md).

**Not built:** bulk edit, file/CSV import, CSV export, clone-an-importer, integrity reporting,
and any authorization layer. See §10 of the design document.
