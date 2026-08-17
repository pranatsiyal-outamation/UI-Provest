using System.Text.Json.Serialization;

namespace ProVest.Admin.Api.Contracts;

/// <summary>
/// The list envelope.
///
/// The member names are pinned with [JsonPropertyName] rather than left to the
/// serializer. Program.cs sets PropertyNamingPolicy = null so that the snake_case
/// columns on Import_Update and ImportFileHeader reach the browser spelled exactly as
/// they are in the database -- but that also means PascalCase properties would ship as
/// PascalCase, which is not what the client reads. Pinning them keeps the envelope
/// camelCase regardless of what the global policy does.
/// </summary>
public sealed class PagedResult<T>
{
    [JsonPropertyName("items")]
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();

    [JsonPropertyName("page")]
    public int Page { get; init; }

    [JsonPropertyName("pageSize")]
    public int PageSize { get; init; }

    [JsonPropertyName("totalCount")]
    public int TotalCount { get; init; }

    [JsonPropertyName("totalPages")]
    public int TotalPages => PageSize > 0 ? (int)Math.Ceiling(TotalCount / (double)PageSize) : 0;

    public static PagedResult<T> Create(IReadOnlyList<T> items, int page, int pageSize, int totalCount) =>
        new() { Items = items, Page = page, PageSize = pageSize, TotalCount = totalCount };
}
