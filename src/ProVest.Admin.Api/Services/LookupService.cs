using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Data;

namespace ProVest.Admin.Api.Services;

public interface ILookupService
{
    Task<IReadOnlyList<StandardColumnLookup>> GetStandardColumnsAsync(CancellationToken ct);
    Task<IReadOnlyList<ProjectSetupLookup>> GetProjectSetupsAsync(CancellationToken ct);
    Task<IReadOnlyList<ClientLookup>> GetClientsAsync(CancellationToken ct);
}

/// <summary>Read-only dropdown sources. Small result sets, unpaged, no parameters.</summary>
public sealed class LookupService : ServiceBase, ILookupService
{
    private const string StandardColumnsSql = @"
        SELECT sc.Id, sc.ColumnName, sc.DataType, sc.SequenceNo
        FROM dbo.ProVestStandardColumn sc
        ORDER BY
            CASE WHEN sc.SequenceNo IS NULL THEN 1 ELSE 0 END,
            sc.SequenceNo,
            sc.ColumnName;";

    // ProjectSetup has no name of its own; the readable label comes from the joined Project.
    private const string ProjectSetupsSql = @"
        SELECT ps.Id, ps.ProjectId, p.Name AS ProjectName,
               ps.DepartmentId, ps.SubDepartmentId, ps.IsActive
        FROM dbo.ProjectSetup ps
        INNER JOIN dbo.Project p ON p.Id = ps.ProjectId
        WHERE ps.IsDeleted = 0
        ORDER BY p.Name, ps.Id;";

    // Inactive clients are included so a location pointing at an inactive client still
    // renders its name instead of a bare id. IsActive remains a real column the importer
    // reads -- it is just no longer used as a stand-in for deletion.
    private const string ClientsSql = @"
        SELECT c.Id, c.ClientName, c.ClientCode, c.IsActive
        FROM dbo.ProVestClient c
        ORDER BY c.ClientName, c.Id;";

    public LookupService(ISqlConnectionFactory connections) : base(connections) { }

    public Task<IReadOnlyList<StandardColumnLookup>> GetStandardColumnsAsync(CancellationToken ct) =>
        ListAsync<StandardColumnLookup>(StandardColumnsSql, ct);

    public Task<IReadOnlyList<ProjectSetupLookup>> GetProjectSetupsAsync(CancellationToken ct) =>
        ListAsync<ProjectSetupLookup>(ProjectSetupsSql, ct);

    public Task<IReadOnlyList<ClientLookup>> GetClientsAsync(CancellationToken ct) =>
        ListAsync<ClientLookup>(ClientsSql, ct);
}
