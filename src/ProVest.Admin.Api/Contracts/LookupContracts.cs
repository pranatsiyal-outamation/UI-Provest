namespace ProVest.Admin.Api.Contracts;

public sealed class StandardColumnLookup
{
    public int Id { get; set; }
    public string ColumnName { get; set; } = string.Empty;
    public string? DataType { get; set; }
    public int? SequenceNo { get; set; }
}

/// <summary>
/// ProjectSetup has no name column of its own; the readable label comes from the
/// joined Project.
/// </summary>
public sealed class ProjectSetupLookup
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public string? ProjectName { get; set; }
    public int? DepartmentId { get; set; }
    public int? SubDepartmentId { get; set; }
    public bool IsActive { get; set; }
}

public sealed class ClientLookup
{
    public int Id { get; set; }
    public string? ClientName { get; set; }
    public string? ClientCode { get; set; }
    public bool IsActive { get; set; }
}
