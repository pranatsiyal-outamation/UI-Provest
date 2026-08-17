using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Data;
using ProVest.Admin.Api.Infrastructure;

namespace ProVest.Admin.Api.Services;

public interface IClientService
{
    Task<PagedResult<ClientListItem>> SearchAsync(ClientListQuery query, CancellationToken ct);
    Task<ClientDetail?> GetByIdAsync(int id, CancellationToken ct);
    Task<int> CreateAsync(ClientWriteRequest request, CancellationToken ct);
    Task UpdateAsync(int id, ClientWriteRequest request, CancellationToken ct);
    Task DeleteAsync(int id, CancellationToken ct);
}

public sealed class ClientService : ServiceBase, IClientService
{
    private const string TableName = "ProVestClient";

    /// <summary>
    /// Sortable columns. The request supplies a key; the SQL fragment is always one of
    /// these constants, never caller text.
    /// </summary>
    private static readonly Dictionary<string, string> Sortable = new(StringComparer.OrdinalIgnoreCase)
    {
        ["Id"]         = "t.Id",
        ["ClientName"] = "t.ClientName",
        ["ClientCode"] = "t.ClientCode",
        ["IsActive"]   = "t.IsActive",
    };

    // InboundFolder / OutboundFolder are varchar(max) and deliberately absent from the
    // grid query; they come from GetById.
    private const string SearchSql = @"
        SELECT
            t.Id,
            t.ClientName,
            t.ClientCode,
            t.IsMergingEnabled,
            t.IsActive,
            t.StateColumn,
            t.UniqueColumns,
            t.IsZipExtractionEnabled,
            t.FileNumberColumn,
            t.ProjectSetupId,
            COUNT(*) OVER () AS TotalCount
        FROM dbo.ProVestClient t
        WHERE (@IsActive               IS NULL OR t.IsActive = @IsActive)
          AND (@IsMergingEnabled       IS NULL OR ISNULL(t.IsMergingEnabled, 0) = @IsMergingEnabled)
          AND (@IsZipExtractionEnabled IS NULL OR ISNULL(t.IsZipExtractionEnabled, 0) = @IsZipExtractionEnabled)
          AND (@ProjectSetupId         IS NULL OR t.ProjectSetupId = @ProjectSetupId)
          AND (@Term IS NULL OR
                  t.ClientName       LIKE @Term ESCAPE '\'
               OR t.ClientCode       LIKE @Term ESCAPE '\'
               OR t.StateColumn      LIKE @Term ESCAPE '\'
               OR t.UniqueColumns    LIKE @Term ESCAPE '\'
               OR t.FileNumberColumn LIKE @Term ESCAPE '\')
        ";

    private const string GetByIdSql = @"
        SELECT
            t.Id, t.ClientName, t.ClientCode, t.InboundFolder, t.OutboundFolder,
            t.IsMergingEnabled, t.IsActive, t.StateColumn, t.UniqueColumns,
            t.IsZipExtractionEnabled, t.FileNumberColumn, t.ProjectSetupId
        FROM dbo.ProVestClient t
        WHERE t.Id = @Id;";

    private const string InsertSql = @"
        INSERT INTO dbo.ProVestClient
            (ClientName, ClientCode, InboundFolder, OutboundFolder, IsMergingEnabled,
             IsActive, StateColumn, UniqueColumns, IsZipExtractionEnabled,
             FileNumberColumn, ProjectSetupId)
        VALUES
            (@ClientName, @ClientCode, @InboundFolder, @OutboundFolder, @IsMergingEnabled,
             @IsActive, @StateColumn, @UniqueColumns, @IsZipExtractionEnabled,
             @FileNumberColumn, @ProjectSetupId);

        SELECT CAST(SCOPE_IDENTITY() AS INT);";

    private const string UpdateSql = @"
        UPDATE dbo.ProVestClient
           SET ClientName             = @ClientName,
               ClientCode             = @ClientCode,
               InboundFolder          = @InboundFolder,
               OutboundFolder         = @OutboundFolder,
               IsMergingEnabled       = @IsMergingEnabled,
               IsActive               = @IsActive,
               StateColumn            = @StateColumn,
               UniqueColumns          = @UniqueColumns,
               IsZipExtractionEnabled = @IsZipExtractionEnabled,
               FileNumberColumn       = @FileNumberColumn,
               ProjectSetupId         = @ProjectSetupId
         WHERE Id = @Id;";

    // Hard delete. ProVestClientLocation and ProVestErrorLog both have foreign keys to
    // this table, so the database will reject the delete with error 547 while any of
    // those rows exist. That rejection is the feature: the error names the blocking
    // table so the user knows what to clear first.
    private const string DeleteSql = @"
        DELETE FROM dbo.ProVestClient WHERE Id = @Id;";

    private readonly IAuditLog _audit;

    public ClientService(ISqlConnectionFactory connections, IAuditLog audit) : base(connections)
        => _audit = audit;

    public Task<PagedResult<ClientListItem>> SearchAsync(ClientListQuery query, CancellationToken ct)
    {
        var page = ClampPage(query.Page);
        var pageSize = ClampPageSize(query.PageSize);
        var orderBy = OrderBy(query.SortBy, query.SortDir, Sortable, "ClientName", "t.Id");

        return PagedAsync<ClientListItem>(
            SearchSql + orderBy + Paging,
            new
            {
                Term = SearchTerm(query.Search),
                query.IsActive,
                query.IsMergingEnabled,
                query.IsZipExtractionEnabled,
                query.ProjectSetupId,
                Page = page,
                PageSize = pageSize
            },
            page,
            pageSize,
            row => row.TotalCount,
            ct);
    }

    public Task<ClientDetail?> GetByIdAsync(int id, CancellationToken ct) =>
        SingleAsync<ClientDetail>(GetByIdSql, new { Id = id }, ct);

    public async Task<int> CreateAsync(ClientWriteRequest request, CancellationToken ct)
    {
        var newId = await ScalarAsync<int>(InsertSql, ToParameters(request), ct);
        _audit.Write(TableName, "INSERT", newId, before: null, after: request);
        return newId;
    }

    public async Task UpdateAsync(int id, ClientWriteRequest request, CancellationToken ct)
    {
        // Before-image for the audit trail: these rows drive live importer behaviour, so
        // knowing what a value used to be is the point of the log.
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
        // Captured before the delete so the audit log holds what was removed -- there
        // is nothing to look up afterwards.
        var before = await GetByIdAsync(id, ct);

        var affected = await ExecuteAsync(DeleteSql, new { Id = id }, ct);
        if (affected == 0)
        {
            throw new RecordNotFoundException(TableName);
        }

        _audit.Write(TableName, "DELETE", id, before, after: null);
    }

    private static Dictionary<string, object?> ToParameters(ClientWriteRequest r) => new()
    {
        ["ClientName"]             = r.ClientName,
        ["ClientCode"]             = r.ClientCode,
        ["InboundFolder"]          = r.InboundFolder,
        ["OutboundFolder"]         = r.OutboundFolder,
        ["IsMergingEnabled"]       = r.IsMergingEnabled,
        ["IsActive"]               = r.IsActive,
        ["StateColumn"]            = r.StateColumn,
        ["UniqueColumns"]          = r.UniqueColumns,
        ["IsZipExtractionEnabled"] = r.IsZipExtractionEnabled,
        ["FileNumberColumn"]       = r.FileNumberColumn,
        ["ProjectSetupId"]         = r.ProjectSetupId
    };
}
