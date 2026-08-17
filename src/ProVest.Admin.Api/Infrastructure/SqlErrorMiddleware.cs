using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace ProVest.Admin.Api.Infrastructure;

/// <summary>
/// Turns database errors into RFC 7807 ProblemDetails the UI can render.
///
/// Raw SqlException text never reaches the browser: every branch below either
/// produces a message written here, or falls through to a generic 500 carrying
/// only a correlation id. The full exception goes to the log.
/// </summary>
public sealed class SqlErrorMiddleware
{
    // SQL Server built-ins.
    private const int ForeignKeyViolation   = 547;
    private const int TruncationWithColumn  = 2628;
    private const int TruncationLegacy      = 8152;
    private const int DuplicateKeyUnique    = 2601;
    private const int DuplicateKeyPk        = 2627;
    private const int CannotInsertNull      = 515;

    private static readonly Regex ConflictTable =
        new(@"table\s+""(?<schema>[^""\.]+)\.(?<table>[^""]+)""", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private static readonly Regex TruncatedColumn =
        new(@"column\s+'(?<column>[^']+)'", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    /// <summary>
    /// SQL Server reports a DELETE blocked by a child row as a REFERENCE constraint, and
    /// an INSERT/UPDATE pointing at a missing parent as a FOREIGN KEY constraint. Both
    /// arrive as error 547 but mean opposite things, so they need opposite advice:
    /// "something still points at this row" versus "this row points at nothing".
    /// </summary>
    private static readonly Regex ReferenceConstraint =
        new(@"conflicted with the REFERENCE constraint", RegexOptions.Compiled | RegexOptions.IgnoreCase);

    private readonly RequestDelegate _next;
    private readonly ILogger<SqlErrorMiddleware> _logger;

    public SqlErrorMiddleware(RequestDelegate next, ILogger<SqlErrorMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (AdminException ex)
        {
            _logger.LogWarning(
                "Guard rejected {Method} {Path}: {Reason}",
                context.Request.Method, context.Request.Path, ex.Message);

            await WriteAsync(context, Translate(ex));
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex,
                "SQL error {Number} on {Method} {Path} (correlation {CorrelationId})",
                ex.Number, context.Request.Method, context.Request.Path, context.TraceIdentifier);

            var problem = Translate(ex, context.TraceIdentifier);
            await WriteAsync(context, problem);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex,
                "Unhandled error on {Method} {Path} (correlation {CorrelationId})",
                context.Request.Method, context.Request.Path, context.TraceIdentifier);

            await WriteAsync(context, Generic(context.TraceIdentifier));
        }
    }

    private static ProblemDetails Translate(AdminException ex) => ex switch
    {
        RecordNotFoundException => new ProblemDetails
        {
            Status = StatusCodes.Status404NotFound,
            Title  = "Record not found",
            Detail = "This record no longer exists. Refresh the list and try again."
        },

        RecordNotUniqueException => new ProblemDetails
        {
            Status = StatusCodes.Status409Conflict,
            Title  = "Record cannot be edited",
            Detail = "More than one row shares this id. Because these tables have no primary key, "
                   + "a duplicated id cannot identify a single row, so it cannot be edited or deleted here. "
                   + "Resolve the duplicate in the database first."
        },

        RecordIdInUseException => new ProblemDetails
        {
            Status = StatusCodes.Status409Conflict,
            Title  = "Id already in use",
            Detail = "A row with that id already exists. Ids on these tables are supplied by hand and must be unique, "
                   + "otherwise neither row can be edited afterwards."
        },

        _ => new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title  = "Request rejected",
            Detail = ex.Message
        }
    };

    private static ProblemDetails Translate(SqlException ex, string correlationId) => ex.Number switch
    {
        ForeignKeyViolation => ForeignKeyProblem(ex),

        TruncationWithColumn or TruncationLegacy => TruncationProblem(ex.Message),

        DuplicateKeyUnique or DuplicateKeyPk => new ProblemDetails
        {
            Status = StatusCodes.Status409Conflict,
            Title  = "Duplicate value",
            Detail = "A record with these values already exists."
        },

        CannotInsertNull => new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title  = "Required value missing",
            Detail = RequiredColumnDetail(ex.Message)
        },

        _ => Generic(correlationId)
    };

    /// <summary>
    /// Error 547, in both its directions. The table named in "The conflict occurred in
    /// ... table" is the one holding the offending rows, so on a blocked delete it is
    /// exactly the table the user has to clear out first.
    /// </summary>
    private static ProblemDetails ForeignKeyProblem(SqlException ex)
    {
        var match = ConflictTable.Match(ex.Message);
        var table = match.Success ? match.Groups["table"].Value : null;

        var problem = ReferenceConstraint.IsMatch(ex.Message)
            ? new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title  = "Record is still referenced",
                Detail = table is null
                    ? "This record cannot be deleted because other records still reference it."
                    : $"This record cannot be deleted because rows in {table} still reference it. "
                    + $"Delete the {table} rows first, then try again."
            }
            : new ProblemDetails
            {
                Status = StatusCodes.Status409Conflict,
                Title  = "Related record not found",
                Detail = table is null
                    ? "A referenced record does not exist. Check the related fields and try again."
                    : $"The referenced {Humanise(table)} does not exist. Pick an existing one."
            };

        // The exact database message, for when the summary above is not enough.
        problem.Extensions["sqlError"] = ex.Message;
        problem.Extensions["sqlErrorNumber"] = ex.Number;

        return problem;
    }

    private static ProblemDetails TruncationProblem(string message)
    {
        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title  = "Value too long"
        };

        var match = TruncatedColumn.Match(message);
        if (match.Success)
        {
            var column = match.Groups["column"].Value;
            problem.Detail = $"The value supplied for '{column}' is longer than the column allows.";
            problem.Extensions["errors"] = new Dictionary<string, string[]>
            {
                [column] = new[] { "This value is too long for the database column." }
            };
        }
        else
        {
            // SQL Server 2016 and earlier report truncation without naming the column.
            problem.Detail = "One of the values is longer than its database column allows.";
        }

        return problem;
    }

    private static string RequiredColumnDetail(string message)
    {
        var match = TruncatedColumn.Match(message);
        return match.Success
            ? $"'{match.Groups["column"].Value}' is required and cannot be empty."
            : "A required value was not supplied.";
    }

    private static ProblemDetails Generic(string correlationId) => new()
    {
        Status = StatusCodes.Status500InternalServerError,
        Title  = "Something went wrong",
        Detail = $"The request could not be completed. Quote reference {correlationId} when reporting this."
    };

    /// <summary>"ProVestClientLocation" -> "ProVest Client Location", for message text only.</summary>
    private static string Humanise(string identifier) =>
        Regex.Replace(identifier, "(?<!^)([A-Z][a-z]|(?<=[a-z])[A-Z])", " $1").Trim();

    private static async Task WriteAsync(HttpContext context, ProblemDetails problem)
    {
        if (context.Response.HasStarted)
        {
            return;
        }

        problem.Instance = context.Request.Path;
        problem.Extensions["traceId"] = context.TraceIdentifier;

        context.Response.Clear();
        context.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/problem+json";

        await context.Response.WriteAsync(JsonSerializer.Serialize(problem, JsonOptions));
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        // Matches Program.cs: property names pass through verbatim so DTO
        // properties keep their database column spelling.
        PropertyNamingPolicy = null
    };
}
