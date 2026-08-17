using Microsoft.AspNetCore.Mvc;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Services;

namespace ProVest.Admin.Api.Controllers;

/// <summary>
/// Read-only, plus a regenerate action. There is deliberately no POST/PUT/DELETE for
/// individual rows: this table is generated from Import_Update, so per-row edits would
/// be silently discarded the next time the mappings are rebuilt.
/// </summary>
[ApiController]
[Route("api/admin/column-mappings")]
public sealed class ColumnMappingsController : ControllerBase
{
    private readonly IColumnMappingService _mappings;

    public ColumnMappingsController(IColumnMappingService mappings) => _mappings = mappings;

    [HttpGet]
    public Task<PagedResult<ColumnMappingListItem>> List(
        [FromQuery] ColumnMappingListQuery query, CancellationToken ct) =>
        _mappings.SearchAsync(query, ct);

    [HttpPost("regenerate")]
    public async Task<ActionResult<RegenerateMappingsResult>> Regenerate(
        RegenerateMappingsRequest request, CancellationToken ct) =>
        Ok(await _mappings.RegenerateAsync(request.ImporterId, ct));
}
