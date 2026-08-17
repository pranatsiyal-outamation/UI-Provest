using Dapper;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Data;
using ProVest.Admin.Api.Infrastructure;

namespace ProVest.Admin.Api.Services;

public interface IImportUpdateService
{
    Task<PagedResult<ImportUpdateListItem>> SearchAsync(ImportUpdateListQuery query, CancellationToken ct);
    Task<ImportUpdateDetail?> GetByIdAsync(int id, CancellationToken ct);
    Task<int?> CreateAsync(ImportUpdateWriteRequest request, CancellationToken ct);
    Task UpdateAsync(int id, ImportUpdateWriteRequest request, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}

/// <summary>
/// Import_Update has no primary key and [id] is a nullable int, so every write first
/// checks that exactly one row matches. Rows whose id is null or duplicated cannot be
/// addressed at all and are reported as such rather than being guessed at.
/// </summary>
public sealed class ImportUpdateService : ServiceBase, IImportUpdateService
{
    private const string TableName = "Import_Update";

    private static readonly Dictionary<string, string> Sortable = new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"]                 = "t.id",
        ["client_id"]          = "t.client_id",
        ["lawfirm_filenumber"] = "t.lawfirm_filenumber",
        ["plaintiff"]          = "t.plaintiff",
    };

    // No primary key exists, so a fully deterministic order is not achievable. This
    // composite tiebreaker keeps paging stable for every row except exact duplicates,
    // which are flagged IsAddressable = 0 anyway. OrderBy drops whichever of these is
    // also the chosen sort column.
    private static readonly string[] Tiebreaker =
        ["t.id", "t.client_id", "t.lawfirm_filenumber"];

    // Uniqueness of [id] is a property of the WHOLE table, not of the filtered page.
    // Computing it with a window function over the filtered set would report a duplicated
    // id as addressable whenever a filter happened to isolate one of its rows.
    private static readonly string SearchSql = $@"
        WITH Dups AS (
            SELECT id
            FROM dbo.Import_Update
            WHERE id IS NOT NULL
            GROUP BY id
            HAVING COUNT(*) > 1
        )
        SELECT
{ImportUpdateSql.GridColumns},
            CAST(CASE WHEN t.id IS NULL THEN 0
                      WHEN EXISTS (SELECT 1 FROM Dups d WHERE d.id = t.id) THEN 0
                      ELSE 1 END AS BIT) AS IsAddressable,
            COUNT(*) OVER () AS TotalCount
        FROM dbo.Import_Update t
        WHERE (@id        IS NULL OR t.id        = @id)
          AND (@client_id IS NULL OR t.client_id = @client_id)
          AND (@Term IS NULL OR
                  t.lawfirm_filenumber LIKE @Term ESCAPE '\'
               OR t.plaintiff          LIKE @Term ESCAPE '\'
               OR t.defendant          LIKE @Term ESCAPE '\'
               OR t.document_type      LIKE @Term ESCAPE '\'
               OR t.index_number       LIKE @Term ESCAPE '\'
               OR t.court_name         LIKE @Term ESCAPE '\'
               OR t.servee_name        LIKE @Term ESCAPE '\'
               OR t.client_ref         LIKE @Term ESCAPE '\'
               OR t.creditor           LIKE @Term ESCAPE '\')
        ";

    private static readonly string GetByIdSql = $@"
        SELECT
{ImportUpdateSql.DetailColumns}
        FROM dbo.Import_Update t
        WHERE t.id = @Id;";

    /// <summary>Read-only count, for deciding whether a row can be opened for editing.</summary>
    private const string CountByIdSql = @"
        SELECT COUNT(*) FROM dbo.Import_Update WHERE id = @Id;";

    /// <summary>
    /// Locking count, used inside the write transactions. UPDLOCK/HOLDLOCK closes the
    /// race where a concurrent insert makes the id non-unique between the check and the
    /// write that follows it.
    /// </summary>
    private const string CountByIdForWriteSql = @"
        SELECT COUNT(*)
        FROM dbo.Import_Update WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @Id;";

    private const string DeleteSql = @"
        DELETE FROM dbo.Import_Update WHERE id = @Id;";

    private readonly IAuditLog _audit;

    public ImportUpdateService(ISqlConnectionFactory connections, IAuditLog audit) : base(connections)
        => _audit = audit;

    public Task<PagedResult<ImportUpdateListItem>> SearchAsync(
        ImportUpdateListQuery query, CancellationToken ct)
    {
        var page = ClampPage(query.Page);
        var pageSize = ClampPageSize(query.PageSize);
        var orderBy = OrderBy(query.SortBy, query.SortDir, Sortable, "id", Tiebreaker);

        return PagedAsync<ImportUpdateListItem>(
            SearchSql + orderBy + Paging,
            new
            {
                Term = SearchTerm(query.Search),
                id = query.id,
                client_id = query.client_id,
                Page = page,
                PageSize = pageSize
            },
            page,
            pageSize,
            row => row.TotalCount,
            ct);
    }

    /// <summary>
    /// A duplicated id cannot identify a single row, so the edit form must not open on
    /// one. Not found returns null and the controller maps that to 404.
    /// </summary>
    public async Task<ImportUpdateDetail?> GetByIdAsync(int id, CancellationToken ct)
    {
        var matches = await ScalarAsync<int>(CountByIdSql, new { Id = id }, ct);

        if (matches > 1)
        {
            throw new RecordNotUniqueException(TableName);
        }

        return await SingleAsync<ImportUpdateDetail>(GetByIdSql, new { Id = id }, ct);
    }

    public async Task<int?> CreateAsync(ImportUpdateWriteRequest request, CancellationToken ct)
    {
        var parameters = ColumnParameters(request);

        var newId = await InTransactionAsync(async (connection, transaction) =>
        {
            // [id] is supplied by the caller -- there is no identity on this table.
            // Refuse to create a second row with an id that already exists; that would
            // make both rows uneditable.
            if (request.id is not null)
            {
                var existing = await connection.ExecuteScalarAsync<int>(
                    CountByIdForWriteSql, new { Id = request.id }, transaction);

                if (existing > 0)
                {
                    throw new RecordIdInUseException(TableName);
                }
            }

            await connection.ExecuteAsync(ImportUpdateSql.InsertStatement, parameters, transaction);
            return request.id;
        }, ct);

        _audit.Write(TableName, "INSERT", newId, before: null, after: request);
        return newId;
    }

    public async Task UpdateAsync(int id, ImportUpdateWriteRequest request, CancellationToken ct)
    {
        var before = await GetByIdAsync(id, ct);

        // [id] is excluded: the row is identified by @TargetId and the id column itself is
        // never rewritten.
        var parameters = ColumnParameters(request, exclude: "id");
        parameters["TargetId"] = id;

        await InTransactionAsync(async (connection, transaction) =>
        {
            await GuardSingleRowAsync(connection, transaction, id);
            return await connection.ExecuteAsync(
                ImportUpdateSql.UpdateStatement, parameters, transaction);
        }, ct);

        _audit.Write(TableName, "UPDATE", id, before, request);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var before = await GetByIdAsync(id, ct);

        await InTransactionAsync(async (connection, transaction) =>
        {
            await GuardSingleRowAsync(connection, transaction, id);
            return await connection.ExecuteAsync(DeleteSql, new { Id = id }, transaction);
        }, ct);

        _audit.Write(TableName, "DELETE", id, before, after: null);
    }

    /// <summary>Refuses the write unless exactly one row carries this id.</summary>
    private static async Task GuardSingleRowAsync(
        System.Data.IDbConnection connection, System.Data.IDbTransaction transaction, int id)
    {
        var matches = await connection.ExecuteScalarAsync<int>(
            CountByIdForWriteSql, new { Id = id }, transaction);

        if (matches == 0) throw new RecordNotFoundException(TableName);
        if (matches > 1) throw new RecordNotUniqueException(TableName);
    }
}
