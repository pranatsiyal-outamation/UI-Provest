using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ProVest.Admin.Api.Contracts;

public sealed class ClientLocationListItem
{
    [JsonIgnore]
    public int TotalCount { get; set; }

    public int Id { get; set; }
    public int ProVestClientId { get; set; }

    /// <summary>Joined from ProVestClient for display. Not stored on this table.</summary>
    public string? ClientName { get; set; }

    /// <summary>
    /// NOT ProVestClient.Id. This is the value the importer matches against
    /// Import_Update.client_id and ImportFileHeader.client_id. Nothing enforces that
    /// relationship, so the UI labels this "Location Id" to keep the two apart.
    /// </summary>
    public int LocationId { get; set; }

    public string State { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int? ProjectSetupId { get; set; }
}

public sealed class ClientLocationDetail
{
    public int Id { get; set; }
    public int ProVestClientId { get; set; }
    public string? ClientName { get; set; }
    public int LocationId { get; set; }
    public string State { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public int? ProjectSetupId { get; set; }
}

public sealed class ClientLocationListQuery : ListQuery
{
    public int? ProVestClientId { get; set; }
    public int? LocationId { get; set; }

    [MaxLength(30)]
    public string? State { get; set; }

    public bool? IsActive { get; set; }
    public int? ProjectSetupId { get; set; }
}

public class ClientLocationWriteRequest
{
    [Required]
    public int ProVestClientId { get; set; }

    [Required]
    public int LocationId { get; set; }

    [Required]
    [MaxLength(30)]
    public string State { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    public int? ProjectSetupId { get; set; }
}
