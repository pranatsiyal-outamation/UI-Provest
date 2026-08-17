using System.ComponentModel.DataAnnotations;

namespace ProVest.Admin.Api.Contracts;

/// <summary>
/// Shared list parameters. These bounds are also enforced inside every search
/// stored procedure -- this is the convenient check, not the authoritative one.
/// </summary>
public abstract class ListQuery
{
    public const int DefaultPageSize = 50;
    public const int MaxPageSize = 100;

    [Range(1, int.MaxValue)]
    public int Page { get; set; } = 1;

    [Range(1, MaxPageSize)]
    public int PageSize { get; set; } = DefaultPageSize;

    [MaxLength(200)]
    public string? Search { get; set; }

    [MaxLength(50)]
    public string? SortBy { get; set; }

    /// <summary>"asc" or "desc". Anything else is coerced to "ASC" by the procedure.</summary>
    [MaxLength(4)]
    public string? SortDir { get; set; }

    public string NormalisedSortDir =>
        string.Equals(SortDir, "desc", StringComparison.OrdinalIgnoreCase) ? "DESC" : "ASC";
}
