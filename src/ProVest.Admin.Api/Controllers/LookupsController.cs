using Microsoft.AspNetCore.Mvc;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Services;

namespace ProVest.Admin.Api.Controllers;

/// <summary>Read-only dropdown sources for the foreign keys the forms need to fill.</summary>
[ApiController]
[Route("api/admin/lookups")]
public sealed class LookupsController : ControllerBase
{
    private readonly ILookupService _lookups;

    public LookupsController(ILookupService lookups) => _lookups = lookups;

    [HttpGet("standard-columns")]
    public Task<IReadOnlyList<StandardColumnLookup>> StandardColumns(CancellationToken ct) =>
        _lookups.GetStandardColumnsAsync(ct);

    [HttpGet("project-setups")]
    public Task<IReadOnlyList<ProjectSetupLookup>> ProjectSetups(CancellationToken ct) =>
        _lookups.GetProjectSetupsAsync(ct);

    [HttpGet("clients")]
    public Task<IReadOnlyList<ClientLookup>> Clients(CancellationToken ct) =>
        _lookups.GetClientsAsync(ct);
}
