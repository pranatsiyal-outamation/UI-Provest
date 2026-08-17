using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace ProVest.Admin.Api.Contracts;

/// <summary>
/// Read-only. ProVestColumnMapping is generated from Import_Update by
/// Scripts/Add_ProVestClientMapping_Data.sql, so ImporterId is Import_Update.id and
/// ColumnName is a client header copied out of an Import_Update cell. Editing rows
/// here would be undone the next time that script runs, so the tool exposes a
/// scoped regenerate instead.
/// </summary>
public sealed class ColumnMappingListItem
{
    [JsonIgnore]
    public int TotalCount { get; set; }

    public int Id { get; set; }
    public int ImporterId { get; set; }
    public string ColumnName { get; set; } = string.Empty;
    public int ProVestStandardColumnId { get; set; }
    public string StandardColumnName { get; set; } = string.Empty;
}

public sealed class ColumnMappingListQuery : ListQuery
{
    public int? ImporterId { get; set; }
    public int? ProVestStandardColumnId { get; set; }
}

public sealed class RegenerateMappingsRequest
{
    /// <summary>Import_Update.id for the importer whose mappings should be rebuilt.</summary>
    [Required]
    public int ImporterId { get; set; }
}

public sealed class RegenerateMappingsResult
{
    public int ImporterId { get; set; }
    public int RowsInserted { get; set; }
}
