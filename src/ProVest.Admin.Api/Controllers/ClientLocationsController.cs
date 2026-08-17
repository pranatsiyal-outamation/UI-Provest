using Microsoft.AspNetCore.Mvc;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Services;

namespace ProVest.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/client-locations")]
public sealed class ClientLocationsController : ControllerBase
{
    private readonly IClientLocationService _locations;

    public ClientLocationsController(IClientLocationService locations) => _locations = locations;

    [HttpGet]
    public Task<PagedResult<ClientLocationListItem>> List(
        [FromQuery] ClientLocationListQuery query, CancellationToken ct) =>
        _locations.SearchAsync(query, ct);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ClientLocationDetail>> GetById(int id, CancellationToken ct)
    {
        var location = await _locations.GetByIdAsync(id, ct);
        return location is null ? NotFound() : Ok(location);
    }

    [HttpPost]
    public async Task<ActionResult<ClientLocationDetail>> Create(
        ClientLocationWriteRequest request, CancellationToken ct)
    {
        var id = await _locations.CreateAsync(request, ct);
        var created = await _locations.GetByIdAsync(id, ct);
        return CreatedAtAction(nameof(GetById), new { id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ClientLocationDetail>> Update(
        int id, ClientLocationWriteRequest request, CancellationToken ct)
    {
        await _locations.UpdateAsync(id, request, ct);
        return Ok(await _locations.GetByIdAsync(id, ct));
    }

    /// <summary>
    /// Hard delete. Nothing references this table, so it normally succeeds -- which is
    /// what unblocks deleting the parent client.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _locations.DeleteAsync(id, ct);
        return NoContent();
    }
}
