using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ProVest.Admin.Api.Contracts;

/// <summary>Grid row. Excludes the two varchar(max) folder columns -- those come from GetById.</summary>
public sealed class ClientListItem
{
    /// <summary>
    /// Every search procedure returns the pre-paging total as a column on each row
    /// (COUNT(*) OVER ()), so one round trip yields both the page and the count.
    /// It is lifted into PagedResult and never serialised on the row itself.
    /// </summary>
    [JsonIgnore]
    public int TotalCount { get; set; }

    public int Id { get; set; }
    public string? ClientName { get; set; }
    public string? ClientCode { get; set; }
    public bool? IsMergingEnabled { get; set; }
    public bool IsActive { get; set; }
    public string? StateColumn { get; set; }
    public string? UniqueColumns { get; set; }
    public bool? IsZipExtractionEnabled { get; set; }
    public string? FileNumberColumn { get; set; }
    public int? ProjectSetupId { get; set; }
}

public sealed class ClientDetail
{
    public int Id { get; set; }
    public string? ClientName { get; set; }
    public string? ClientCode { get; set; }
    public string? InboundFolder { get; set; }
    public string? OutboundFolder { get; set; }
    public bool? IsMergingEnabled { get; set; }
    public bool IsActive { get; set; }
    public string? StateColumn { get; set; }
    public string? UniqueColumns { get; set; }
    public bool? IsZipExtractionEnabled { get; set; }
    public string? FileNumberColumn { get; set; }
    public int? ProjectSetupId { get; set; }
}

public sealed class ClientListQuery : ListQuery
{
    public bool? IsActive { get; set; }
    public bool? IsMergingEnabled { get; set; }
    public bool? IsZipExtractionEnabled { get; set; }
    public int? ProjectSetupId { get; set; }
}

/// <summary>
/// MaxLength mirrors the column widths so an over-long value is rejected with a
/// field-level message rather than a SQL truncation error.
/// </summary>
public class ClientWriteRequest
{
    [MaxLength(100)]
    public string? ClientName { get; set; }

    [MaxLength(100)]
    public string? ClientCode { get; set; }

    public string? InboundFolder { get; set; }

    public string? OutboundFolder { get; set; }

    public bool IsMergingEnabled { get; set; }

    public bool IsActive { get; set; } = true;

    [MaxLength(500)]
    public string? StateColumn { get; set; }

    [MaxLength(500)]
    public string? UniqueColumns { get; set; }

    public bool IsZipExtractionEnabled { get; set; }

    [MaxLength(200)]
    public string? FileNumberColumn { get; set; }

    public int? ProjectSetupId { get; set; }
}
