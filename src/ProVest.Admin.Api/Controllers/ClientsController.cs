using Microsoft.AspNetCore.Mvc;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Services;

namespace ProVest.Admin.Api.Controllers;

[ApiController]
[Route("api/admin/clients")]
public sealed class ClientsController : ControllerBase
{
    private readonly IClientService _clients;

    public ClientsController(IClientService clients) => _clients = clients;

    [HttpGet]
    public Task<PagedResult<ClientListItem>> List([FromQuery] ClientListQuery query, CancellationToken ct) =>
        _clients.SearchAsync(query, ct);

    [HttpGet("{id:int}")]
    public async Task<ActionResult<ClientDetail>> GetById(int id, CancellationToken ct)
    {
        var client = await _clients.GetByIdAsync(id, ct);
        return client is null ? NotFound() : Ok(client);
    }

    [HttpPost]
    public async Task<ActionResult<ClientDetail>> Create(ClientWriteRequest request, CancellationToken ct)
    {
        var id = await _clients.CreateAsync(request, ct);
        var created = await _clients.GetByIdAsync(id, ct);
        return CreatedAtAction(nameof(GetById), new { id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ActionResult<ClientDetail>> Update(int id, ClientWriteRequest request, CancellationToken ct)
    {
        await _clients.UpdateAsync(id, request, ct);
        return Ok(await _clients.GetByIdAsync(id, ct));
    }

    /// <summary>
    /// Hard delete. ProVestClientLocation and ProVestErrorLog both reference this table,
    /// so the database rejects the delete with 547 while any of those rows exist. The
    /// response names the blocking table so the caller knows what to clear first.
    /// </summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await _clients.DeleteAsync(id, ct);
        return NoContent();
    }
}
