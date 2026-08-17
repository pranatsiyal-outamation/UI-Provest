# Phase 2 — stored procedures

**These are not deployed and the application does not call them.**

Phase 1 runs on parameterised inline queries in the service layer
(`src/ProVest.Admin.Api/Services/`), which removed the deploy step and let the tool be
tested against a database without any schema write at all.

These 25 procedures are the phase 2 target. They are complete and mirror what the
services currently do, so moving over is a matter of pointing the services at them
rather than rewriting logic.

## Why bother moving

Phase 1 keeps every safety property, but keeps them **in C# only**:

| Property | Phase 1 | Phase 2 |
|---|---|---|
| Values parameterised | Dapper parameters | Procedure parameters |
| Sort whitelist | `Dictionary` lookup in `ServiceBase.OrderBy` | `IF @SortBy NOT IN (...)` |
| Page size clamp | `ServiceBase.ClampPageSize` | Clamped in the procedure |
| `LIKE` escaping | `ServiceBase.SearchTerm` | Escaped in the procedure |
| Row uniqueness guard | C# transaction + `UPDLOCK, HOLDLOCK` | Same, inside the procedure |
| **Database can't be misused if the API is wrong** | **no** | **yes** |

That last row is the whole point. Phase 1 requires the application account to hold
`SELECT`/`INSERT`/`UPDATE`/`DELETE` on the five tables, so a bug in the API is a bug
against the tables directly. Phase 2 lets you grant `EXECUTE` on these 25 procedures and
**no table-level rights**, at which point "no arbitrary SQL, no arbitrary table access"
is enforced by SQL Server rather than by code review.

## Deploying, when you get there

```
sqlcmd -S <server> -d <database> -E -i _deploy.sql
```

Or in SSMS with **Query > SQLCMD Mode** enabled — the `:r` directives need it.

Then swap each service's inline SQL for a `CommandType.StoredProcedure` call and change
the grant:

```sql
GRANT EXECUTE ON OBJECT::dbo.usp_ProVestAdmin_Client_Search TO [<app-login>];
-- ... one per procedure ...
REVOKE SELECT, INSERT, UPDATE, DELETE ON dbo.ProVestClient FROM [<app-login>];
-- ... one per table ...
```

## Note on the generated ones

The ten wide procedures (`ImportUpdate_*`, `ImportFileHeader_*`) were generated from the
`CREATE TABLE` statements in `QMS-771-Provest-Importer-Files-Migration-From-UAT.sql` —
71 and 64 columns respectively. If those tables change, regenerate rather than editing
by hand, and regenerate the C# contracts and TypeScript types along with them.
