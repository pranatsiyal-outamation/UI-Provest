using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Data;
using ProVest.Admin.Api.Infrastructure;

namespace ProVest.Admin.Api.Services;

public interface IClientLocationService
{
    Task<PagedResult<ClientLocationListItem>> SearchAsync(ClientLocationListQuery query, CancellationToken ct);
    Task<ClientLocationDetail?> GetByIdAsync(int id, CancellationToken ct);
    Task<int> CreateAsync(ClientLocationWriteRequest request, CancellationToken ct);
    Task UpdateAsync(int id, ClientLocationWriteRequest request, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}

public sealed class ClientLocationService : ServiceBase, IClientLocationService
{
    private const string TableName = "ProVestClientLocation";

    private static readonly Dictionary<string, string> Sortable = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Id"]              = "t.Id",
        ["ProVestClientId"] = "t.ProVestClientId",
        ["LocationId"]      = "t.LocationId",
        ["State"]           = "t.State",
        ["IsActive"]        = "t.IsActive",
    };

    // LocationId is NOT ProVestClient.Id -- it is the value the importer matches against
    // Import_Update.client_id and ImportFileHeader.client_id. ClientName is joined for
    // display only.
    private const string SearchSql = @"
        SELECT
            t.Id,
            t.ProVestClientId,
            c.ClientName,
            t.LocationId,
            t.State,
            t.IsActive,
            t.ProjectSetupId,
            COUNT(*) OVER () AS TotalCount
        FROM dbo.ProVestClientLocation t
        INNER JOIN dbo.ProVestClient c ON c.Id = t.ProVestClientId
        WHERE (@ProVestClientId IS NULL OR t.ProVestClientId = @ProVestClientId)
          AND (@LocationId      IS NULL OR t.LocationId      = @LocationId)
          AND (@State           IS NULL OR t.State           = @State)
          AND (@IsActive        IS NULL OR t.IsActive        = @IsActive)
          AND (@ProjectSetupId  IS NULL OR t.ProjectSetupId  = @ProjectSetupId)
          AND (@Term IS NULL OR
                  t.State      LIKE @Term ESCAPE '\'
               OR c.ClientName LIKE @Term ESCAPE '\'
               OR c.ClientCode LIKE @Term ESCAPE '\')
        ";

    private const string GetByIdSql = @"
        SELECT
            t.Id, t.ProVestClientId, c.ClientName, t.LocationId,
            t.State, t.IsActive, t.ProjectSetupId
        FROM dbo.ProVestClientLocation t
        INNER JOIN dbo.ProVestClient c ON c.Id = t.ProVestClientId
        WHERE t.Id = @Id;";

    private const string InsertSql = @"
        INSERT INTO dbo.ProVestClientLocation
            (ProVestClientId, LocationId, State, IsActive, ProjectSetupId)
        VALUES
            (@ProVestClientId, @LocationId, @State, @IsActive, @ProjectSetupId);

        SELECT CAST(SCOPE_IDENTITY() AS INT);";

    private const string UpdateSql = @"
        UPDATE dbo.ProVestClientLocation
           SET ProVestClientId = @ProVestClientId,
               LocationId      = @LocationId,
               State           = @State,
               IsActive        = @IsActive,
               ProjectSetupId  = @ProjectSetupId
         WHERE Id = @Id;";

    // Hard delete. Nothing has a foreign key to this table, so it normally succeeds --
    // which is what unblocks deleting the parent ProVestClient.
    private const string DeleteSql = @"
        DELETE FROM dbo.ProVestClientLocation WHERE Id = @Id;";

    private readonly IAuditLog _audit;

    public ClientLocationService(ISqlConnectionFactory connections, IAuditLog audit) : base(connections)
        => _audit = audit;

    public Task<PagedResult<ClientLocationListItem>> SearchAsync(
        ClientLocationListQuery query, CancellationToken ct)
    {
        var page = ClampPage(query.Page);
        var pageSize = ClampPageSize(query.PageSize);
        var orderBy = OrderBy(
            query.SortBy, query.SortDir, Sortable, "ProVestClientId", "t.State", "t.Id");

        return PagedAsync<ClientLocationListItem>(
            SearchSql + orderBy + Paging,
            new
            {
                Term = SearchTerm(query.Search),
                query.ProVestClientId,
                query.LocationId,
                query.State,
                query.IsActive,
                query.ProjectSetupId,
                Page = page,
                PageSize = pageSize
            },
            page,
            pageSize,
            row => row.TotalCount,
            ct);
    }

    public Task<ClientLocationDetail?> GetByIdAsync(int id, CancellationToken ct) =>
        SingleAsync<ClientLocationDetail>(GetByIdSql, new { Id = id }, ct);

    public async Task<int> CreateAsync(ClientLocationWriteRequest request, CancellationToken ct)
    {
        var newId = await ScalarAsync<int>(InsertSql, ToParameters(request), ct);
        _audit.Write(TableName, "INSERT", newId, before: null, after: request);
        return newId;
    }

    public async Task UpdateAsync(int id, ClientLocationWriteRequest request, CancellationToken ct)
    {
        var before = await GetByIdAsync(id, ct);

        var parameters = ToParameters(request);
        parameters["Id"] = id;

        var affected = await ExecuteAsync(UpdateSql, parameters, ct);
        if (affected == 0)
        {
            throw new RecordNotFoundException(TableName);
        }

        _audit.Write(TableName, "UPDATE", id, before, request);
    }

    public async Task DeleteAsync(int id, CancellationToken ct)
    {
        var before = await GetByIdAsync(id, ct);

        var affected = await ExecuteAsync(DeleteSql, new { Id = id }, ct);
        if (affected == 0)
        {
            throw new RecordNotFoundException(TableName);
        }

        _audit.Write(TableName, "DELETE", id, before, after: null);
    }

    private static Dictionary<string, object?> ToParameters(ClientLocationWriteRequest r) => new()
    {
        ["ProVestClientId"] = r.ProVestClientId,
        ["LocationId"]      = r.LocationId,
        ["State"]           = r.State,
        ["IsActive"]        = r.IsActive,
        ["ProjectSetupId"]  = r.ProjectSetupId
    };
}
