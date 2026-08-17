using Dapper;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Data;
using ProVest.Admin.Api.Infrastructure;

namespace ProVest.Admin.Api.Services;

public interface IImportFileHeaderService
{
    Task<PagedResult<ImportFileHeaderListItem>> SearchAsync(ImportFileHeaderListQuery query, CancellationToken ct);
    Task<ImportFileHeaderDetail?> GetByIdAsync(int id, CancellationToken ct);
    Task<int?> CreateAsync(ImportFileHeaderWriteRequest request, CancellationToken ct);
    Task UpdateAsync(int id, ImportFileHeaderWriteRequest request, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}

/// <summary>
/// Same no-primary-key situation as Import_Update: writes are guarded, and rows with a
/// null or duplicated id cannot be addressed.
/// </summary>
public sealed class ImportFileHeaderService : ServiceBase, IImportFileHeaderService
{
    private const string TableName = "ImportFileHeader";

    private static readonly Dictionary<string, string> Sortable = new(StringComparer.OrdinalIgnoreCase)
    {
        ["id"]          = "t.id",
        ["client_id"]   = "t.client_id",
        ["importer_id"] = "t.importer_id",
    };

    // OrderBy drops whichever of these is also the chosen sort column -- all three are
    // sortable, so the collision is the normal case here.
    private static readonly string[] Tiebreaker = ["t.id", "t.client_id", "t.importer_id"];

    // unique_key is the concatenation of col_1..col_60, so one predicate covers every
    // column. It is searched but not returned -- the grid gets a truncated preview.
    private static readonly string SearchSql = $@"
        WITH Dups AS (
            SELECT id
            FROM dbo.ImportFileHeader
            WHERE id IS NOT NULL
            GROUP BY id
            HAVING COUNT(*) > 1
        )
        SELECT
{ImportFileHeaderSql.GridColumns},
            CAST(CASE WHEN t.id IS NULL THEN 0
                      WHEN EXISTS (SELECT 1 FROM Dups d WHERE d.id = t.id) THEN 0
                      ELSE 1 END AS BIT) AS IsAddressable,
            COUNT(*) OVER () AS TotalCount
        FROM dbo.ImportFileHeader t
        WHERE (@id          IS NULL OR t.id          = @id)
          AND (@client_id   IS NULL OR t.client_id   = @client_id)
          AND (@importer_id IS NULL OR t.importer_id = @importer_id)
          AND (@Term IS NULL OR t.unique_key LIKE @Term ESCAPE '\')
        ";

    private static readonly string GetByIdSql = $@"
        SELECT
{ImportFileHeaderSql.DetailColumns}
        FROM dbo.ImportFileHeader t
        WHERE t.id = @Id;";

    private const string CountByIdSql = @"
        SELECT COUNT(*) FROM dbo.ImportFileHeader WHERE id = @Id;";

    private const string CountByIdForWriteSql = @"
        SELECT COUNT(*)
        FROM dbo.ImportFileHeader WITH (UPDLOCK, HOLDLOCK)
        WHERE id = @Id;";

    private const string DeleteSql = @"
        DELETE FROM dbo.ImportFileHeader WHERE id = @Id;";

    private readonly IAuditLog _audit;

    public ImportFileHeaderService(ISqlConnectionFactory connections, IAuditLog audit) : base(connections)
        => _audit = audit;

    public Task<PagedResult<ImportFileHeaderListItem>> SearchAsync(
        ImportFileHeaderListQuery query, CancellationToken ct)
    {
        var page = ClampPage(query.Page);
        var pageSize = ClampPageSize(query.PageSize);
        var orderBy = OrderBy(query.SortBy, query.SortDir, Sortable, "client_id", Tiebreaker);

        return PagedAsync<ImportFileHeaderListItem>(
            SearchSql + orderBy + Paging,
            new
            {
                Term = SearchTerm(query.Search),
                id = query.id,
                client_id = query.client_id,
                importer_id = query.importer_id,
                Page = page,
                PageSize = pageSize
            },
            page,
            pageSize,
            row => row.TotalCount,
            ct);
    }

    public async Task<ImportFileHeaderDetail?> GetByIdAsync(int id, CancellationToken ct)
    {
        var matches = await ScalarAsync<int>(CountByIdSql, new { Id = id }, ct);

        if (matches > 1)
        {
            throw new RecordNotUniqueException(TableName);
        }

        return await SingleAsync<ImportFileHeaderDetail>(GetByIdSql, new { Id = id }, ct);
    }

    public async Task<int?> CreateAsync(ImportFileHeaderWriteRequest request, CancellationToken ct)
    {
        var parameters = ColumnParameters(request);

        var newId = await InTransactionAsync(async (connection, transaction) =>
        {
            if (request.id is not null)
            {
                var existing = await connection.ExecuteScalarAsync<int>(
                    CountByIdForWriteSql, new { Id = request.id }, transaction);

                if (existing > 0)
                {
                    throw new RecordIdInUseException(TableName);
                }
            }

            await connection.ExecuteAsync(ImportFileHeaderSql.InsertStatement, parameters, transaction);
            return request.id;
        }, ct);

        _audit.Write(TableName, "INSERT", newId, before: null, after: request);
        return newId;
    }

    public async Task UpdateAsync(int id, ImportFileHeaderWriteRequest request, CancellationToken ct)
    {
        var before = await GetByIdAsync(id, ct);

        var parameters = ColumnParameters(request, exclude: "id");
        parameters["TargetId"] = id;

        await InTransactionAsync(async (connection, transaction) =>
        {
            await GuardSingleRowAsync(connection, transaction, id);
            return await connection.ExecuteAsync(
                ImportFileHeaderSql.UpdateStatement, parameters, transaction);
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

    private static async Task GuardSingleRowAsync(
        System.Data.IDbConnection connection, System.Data.IDbTransaction transaction, int id)
    {
        var matches = await connection.ExecuteScalarAsync<int>(
            CountByIdForWriteSql, new { Id = id }, transaction);

        if (matches == 0) throw new RecordNotFoundException(TableName);
        if (matches > 1) throw new RecordNotUniqueException(TableName);
    }
}
