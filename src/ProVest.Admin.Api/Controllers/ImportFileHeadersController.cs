using Microsoft.AspNetCore.Mvc;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Services;

namespace ProVest.Admin.Api.Controllers;

/// <summary>
/// Same no-primary-key situation as Import_Update: writes are guarded in the stored
/// procedures and rows with a null or duplicated [id] are read-only.
/// </summary>
[ApiController]
[Route("api/admin/import-file-headers")]
public sealed class ImportFileHeadersController : ControllerBase
{
    private readonly IImportFileHeaderService _headers;

    public ImportFileHeadersController(IImportFileHeaderService headers) => _headers = headers;

    [HttpGet]
    public Task<PagedResult<ImportFileHeaderListItem>> List(
        [FromQuery] ImportFileHeaderListQuery query, CancellationToken ct) =>
        _headers.SearchAsync(query, ct);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ImportFileHeaderDetail>> GetById(int id, CancellationToken ct)
    {
        var row = await _headers.GetByIdAsync(id, ct);
        return row is null ? NotFound() : Ok(row);
    }

    [HttpPost]
    public async Task<ActionResult<ImportFileHeaderDetail>> Create(
        ImportFileHeaderWriteRequest request, CancellationToken ct)
    {
        var id = await _headers.CreateAsync(request, ct);

        if (id is null)
        {
            return Ok();
        }

        var created = await _headers.GetByIdAsync(id.Value, ct);
        return CreatedAtAction(nameof(GetById), new { id = id.Value }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ImportFileHeaderDetail>> Update(
        int id, ImportFileHeaderWriteRequest request, CancellationToken ct)
    {
        await _headers.UpdateAsync(id, request, ct);
        return Ok(await _headers.GetByIdAsync(id, ct));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _headers.DeleteAsync(id, ct);
        return NoContent();
    }
}
