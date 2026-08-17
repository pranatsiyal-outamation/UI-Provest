using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using ProVest.Admin.Api.Auth;
using ProVest.Admin.Api.Data;
using ProVest.Admin.Api.Infrastructure;
using ProVest.Admin.Api.Services;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

builder.Host.UseSerilog((context, services, configuration) => configuration
    .ReadFrom.Configuration(context.Configuration)
    .ReadFrom.Services(services)
    .Enrich.FromLogContext());

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // DTO properties mirror database column spelling exactly -- PascalCase for the
        // ProVest* tables, snake_case for Import_Update and ImportFileHeader. Leaving the
        // naming policy null means those names reach the browser unchanged, so what the
        // UI shows matches what someone would see in SSMS.
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
        options.JsonSerializerOptions.DictionaryKeyPolicy = null;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();

// ---------------------------------------------------------------------------
// Authentication: a cookie session, no JWT and no external identity provider.
//
// This is a gate, not an authorisation model -- every signed-in user can do
// everything. Its job is to stop casual access, particularly over the ngrok tunnel.
// ---------------------------------------------------------------------------
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection(AuthOptions.SectionName));

var sessionHours = builder.Configuration.GetValue<int?>($"{AuthOptions.SectionName}:SessionHours") ?? 8;

builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "provest.admin";
        options.Cookie.HttpOnly = true;              // not readable from JavaScript
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
        options.ExpireTimeSpan = TimeSpan.FromHours(sessionHours);
        options.SlidingExpiration = true;

        // This serves an API, not server-rendered pages: answer with status codes so
        // the client can react, rather than 302-ing to a login URL that does not exist
        // on this side.
        options.Events.OnRedirectToLogin = context =>
        {
            context.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = context =>
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });

// Everything requires a signed-in user unless it opts out with [AllowAnonymous].
// A fallback policy is used rather than per-controller attributes so that a new
// controller is protected by default instead of by remembering.
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddHttpContextAccessor();

builder.Services.AddSingleton<ISqlConnectionFactory, SqlConnectionFactory>();
builder.Services.AddSingleton<IAuditLog, AuditLog>();

builder.Services.AddScoped<IClientService, ClientService>();
builder.Services.AddScoped<IClientLocationService, ClientLocationService>();
builder.Services.AddScoped<IColumnMappingService, ColumnMappingService>();
builder.Services.AddScoped<IImportUpdateService, ImportUpdateService>();
builder.Services.AddScoped<IImportFileHeaderService, ImportFileHeaderService>();
builder.Services.AddScoped<ILookupService, LookupService>();

var app = builder.Build();

// Serves the built React app (index.html, JS/CSS bundles) from wwwroot. Must run
// before the API middleware below so asset requests never touch auth or logging.
app.UseDefaultFiles();
app.UseStaticFiles();

// First in the pipeline so it catches everything downstream.
app.UseMiddleware<SqlErrorMiddleware>();

// One line per request, including the query string. Without this a successful
// request logs nothing, which makes "the search returned no rows" and "the search
// never ran" impossible to tell apart from the log alone.
app.UseSerilogRequestLogging(options =>
{
    options.MessageTemplate =
        "{RequestMethod} {RequestPath}{QueryString} responded {StatusCode} in {Elapsed:0} ms";

    options.EnrichDiagnosticContext = (diagnosticContext, httpContext) =>
        diagnosticContext.Set("QueryString", httpContext.Request.QueryString.Value ?? string.Empty);
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

// No CORS configuration anywhere: in development Vite proxies /api, and in
// production the API is served from the same origin as the static files. That also
// keeps the session cookie same-origin, so it needs no cross-site relaxation.
app.MapControllers();

// Any path that isn't an API route or a real static file falls back to the SPA
// shell, so React Router can handle client-side routes like /clients on refresh.
// Anonymous, or the fallback policy above would 401 before the login page can load.
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();
