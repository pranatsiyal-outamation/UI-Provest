using Microsoft.AspNetCore.Mvc;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Services;

namespace ProVest.Admin.Api.Controllers;

/// <summary>
/// Import_Update has no primary key and [id] is a nullable int, so writes are guarded
/// inside the stored procedures: a missing id gives 404, a duplicated one gives 409.
/// </summary>
[ApiController]
[Route("api/admin/import-updates")]
public sealed class ImportUpdatesController : ControllerBase
{
    private readonly IImportUpdateService _importUpdates;

    public ImportUpdatesController(IImportUpdateService importUpdates) => _importUpdates = importUpdates;

    [HttpGet]
    public Task<PagedResult<ImportUpdateListItem>> List(
        [FromQuery] ImportUpdateListQuery query, CancellationToken ct) =>
        _importUpdates.SearchAsync(query, ct);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ImportUpdateDetail>> GetById(int id, CancellationToken ct)
    {
        var row = await _importUpdates.GetByIdAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<ImportUpdateDetail>> Create(
        ImportUpdateWriteRequest request, CancellationToken ct)
    {
        var id = await _importUpdates.CreateAsync(request, ct);

        // A row created without an id cannot be fetched back -- nothing identifies it.
        if (id is null)
        {
            return Ok();
        }

        var created = await _importUpdates.GetByIdAsync(id.Value, ct);
        return CreatedAtAction(nameof(GetById), new { id = id.Value }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ImportUpdateDetail>> Update(
        int id, ImportUpdateWriteRequest request, CancellationToken ct)
    {
        await _importUpdates.UpdateAsync(id, request, ct);
        return Ok(await _importUpdates.GetByIdAsync(id, ct));
    }

    /// <summary>Hard delete. This table has no IsActive column and no soft-delete concept.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _importUpdates.DeleteAsync(id, ct);
        return NoContent();
    }
}
