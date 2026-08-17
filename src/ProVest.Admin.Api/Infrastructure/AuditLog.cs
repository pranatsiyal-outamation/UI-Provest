using Serilog.Events;

namespace ProVest.Admin.Api.Infrastructure;

public interface IAuditLog
{
    /// <summary>
    /// Records a write against one of the five in-scope tables. These rows drive live
    /// importer behaviour, so every change is logged with who made it and what it
    /// looked like before and after. Serilog only -- no schema change, no audit table.
    /// </summary>
    void Write(string table, string operation, object? id, object? before, object? after);

    void Failed(string table, string operation, object? id, string reason);
}

public sealed class AuditLog : IAuditLog
{
    private static readonly Serilog.ILogger Log =
        Serilog.Log.ForContext("Audit", true).ForContext("SourceContext", "ProVestAdmin.Audit");

    private readonly IHttpContextAccessor _httpContext;

    public AuditLog(IHttpContextAccessor httpContext) => _httpContext = httpContext;

    /// <summary>
    /// The signed-in username. "unknown" should not occur while authentication is
    /// enabled -- if it appears in the log, something reached a write path without a
    /// session and that is worth investigating.
    /// </summary>
    private string CurrentUser =>
        _httpContext.HttpContext?.User.Identity?.Name ?? "unknown";

    public void Write(string table, string operation, object? id, object? before, object? after) =>
        Log.Write(LogEventLevel.Information,
            "AUDIT {User} {Operation} {Table} id={RecordId} before={@Before} after={@After}",
            CurrentUser, operation, table, id, before, after);

    public void Failed(string table, string operation, object? id, string reason) =>
        Log.Write(LogEventLevel.Warning,
            "AUDIT-FAILED {User} {Operation} {Table} id={RecordId} reason={Reason}",
            CurrentUser, operation, table, id, reason);
}
