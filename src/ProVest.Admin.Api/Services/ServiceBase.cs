using System.Data;
using System.Reflection;
using Dapper;
using ProVest.Admin.Api.Contracts;
using ProVest.Admin.Api.Data;

namespace ProVest.Admin.Api.Services;

/// <summary>
/// Shared plumbing for the per-table services.
///
/// Phase 1 uses parameterised inline queries rather than stored procedures. The safety
/// properties that previously lived in T-SQL now live here, and they are the only thing
/// standing between the API and the database:
///
///   * Every value is a Dapper parameter. No caller-supplied value is ever concatenated
///     into SQL.
///   * ORDER BY cannot be parameterised, so a sort request is used only as a lookup KEY
///     into a fixed dictionary. The SQL fragment that ends up in the query is always a
///     compile-time constant from that dictionary -- see <see cref="OrderBy"/>.
///   * Page size is clamped here, not just in the controller.
///   * LIKE metacharacters are escaped so a '%' typed into a search box is a literal.
///
/// Phase 2 moves these statements into stored procedures, at which point the database
/// can enforce them too (GRANT EXECUTE, no table rights). Until then, this file is it.
/// </summary>
public abstract class ServiceBase
{
    protected readonly ISqlConnectionFactory Connections;

    protected ServiceBase(ISqlConnectionFactory connections) => Connections = connections;

    // ---------------------------------------------------------------------
    // Query building
    // ---------------------------------------------------------------------

    /// <summary>
    /// Builds an ORDER BY clause from a whitelist.
    ///
    /// <paramref name="requested"/> comes from the query string and is used ONLY to look
    /// up a key. If it is missing or unrecognised the default is used. The returned
    /// string is assembled from dictionary values and two literal direction keywords, so
    /// no caller-supplied text reaches the database.
    /// </summary>
    protected static string OrderBy(
        string? requested,
        string? direction,
        IReadOnlyDictionary<string, string> allowed,
        string defaultKey,
        params string[] tiebreakerColumns)
    {
        var column = requested is not null && allowed.TryGetValue(requested, out var mapped)
            ? mapped
            : allowed[defaultKey];

        var dir = string.Equals(direction, "desc", StringComparison.OrdinalIgnoreCase)
            ? "DESC"
            : "ASC";

        // SQL Server rejects the same column appearing twice in ORDER BY (error 169),
        // so drop any tiebreaker that is already the sort column. The tables with no
        // primary key need several tiebreakers, and every one of them is also sortable,
        // which makes the collision the normal case rather than an edge case.
        var tiebreakers = tiebreakerColumns
            .Where(c => !string.Equals(c, column, StringComparison.OrdinalIgnoreCase))
            .Select(c => $"{c} ASC");

        var terms = new[] { $"{column} {dir}" }.Concat(tiebreakers);
        return "ORDER BY " + string.Join(", ", terms);
    }

    /// <summary>
    /// Wraps a search term for LIKE, escaping the metacharacters first so that typing
    /// '%' or '_' searches for those characters rather than turning into a wildcard.
    /// Returns null for a blank search, which the queries treat as "no filter".
    ///
    /// No COLLATE clause is used anywhere: the database collation is case-insensitive and
    /// comparisons inherit it, which also means behaviour follows whichever database the
    /// connection string names.
    /// </summary>
    protected static string? SearchTerm(string? search)
    {
        if (string.IsNullOrWhiteSpace(search))
        {
            return null;
        }

        var escaped = search
            .Replace("\\", "\\\\")
            .Replace("%", "\\%")
            .Replace("_", "\\_");

        return $"%{escaped}%";
    }

    protected static int ClampPage(int page) => page < 1 ? 1 : page;

    protected static int ClampPageSize(int pageSize) => pageSize switch
    {
        < 1 => ListQuery.DefaultPageSize,
        > ListQuery.MaxPageSize => ListQuery.MaxPageSize,
        _ => pageSize
    };

    /// <summary>OFFSET/FETCH for the requested page. Both values are parameters.</summary>
    protected const string Paging = @"
        OFFSET (@Page - 1) * @PageSize ROWS
        FETCH NEXT @PageSize ROWS ONLY
        OPTION (RECOMPILE);";

    // ---------------------------------------------------------------------
    // Execution
    // ---------------------------------------------------------------------

    /// <summary>
    /// Runs a paged query and lifts TotalCount off the first row. Every search query
    /// selects COUNT(*) OVER () so the page and the total arrive together. An empty page
    /// carries no row and therefore no count, which correctly means zero matches.
    /// </summary>
    protected async Task<PagedResult<T>> PagedAsync<T>(
        string sql,
        object parameters,
        int page,
        int pageSize,
        Func<T, int> totalSelector,
        CancellationToken cancellationToken)
    {
        using var connection = await Connections.OpenAsync(cancellationToken);

        var rows = (await connection.QueryAsync<T>(
            new CommandDefinition(sql, parameters, cancellationToken: cancellationToken))).ToList();

        var total = rows.Count > 0 ? totalSelector(rows[0]) : 0;
        return PagedResult<T>.Create(rows, page, pageSize, total);
    }

    protected async Task<T?> SingleAsync<T>(
        string sql,
        object parameters,
        CancellationToken cancellationToken)
    {
        using var connection = await Connections.OpenAsync(cancellationToken);

        return await connection.QueryFirstOrDefaultAsync<T>(
            new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
    }

    protected async Task<IReadOnlyList<T>> ListAsync<T>(
        string sql,
        CancellationToken cancellationToken)
    {
        using var connection = await Connections.OpenAsync(cancellationToken);

        return (await connection.QueryAsync<T>(
            new CommandDefinition(sql, null, cancellationToken: cancellationToken))).ToList();
    }

    protected async Task<int> ExecuteAsync(
        string sql,
        object parameters,
        CancellationToken cancellationToken)
    {
        using var connection = await Connections.OpenAsync(cancellationToken);

        return await connection.ExecuteAsync(
            new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
    }

    protected async Task<TScalar?> ScalarAsync<TScalar>(
        string sql,
        object parameters,
        CancellationToken cancellationToken)
    {
        using var connection = await Connections.OpenAsync(cancellationToken);

        return await connection.ExecuteScalarAsync<TScalar>(
            new CommandDefinition(sql, parameters, cancellationToken: cancellationToken));
    }

    /// <summary>
    /// Runs work inside a transaction. Used by the writes that have to check something
    /// before acting -- the row-uniqueness guards on the two tables with no primary key.
    /// </summary>
    protected async Task<T> InTransactionAsync<T>(
        Func<IDbConnection, IDbTransaction, Task<T>> work,
        CancellationToken cancellationToken)
    {
        using var connection = await Connections.OpenAsync(cancellationToken);
        using var transaction = connection.BeginTransaction();

        try
        {
            var result = await work(connection, transaction);
            transaction.Commit();
            return result;
        }
        catch
        {
            transaction.Rollback();
            throw;
        }
    }

    // ---------------------------------------------------------------------
    // Parameters
    // ---------------------------------------------------------------------

    /// <summary>
    /// Turns a write request into query parameters by property name.
    ///
    /// Only used for Import_Update (71 columns) and ImportFileHeader (64), where the DTOs
    /// and the generated SQL come from the same CREATE TABLE extraction and therefore
    /// carry identical names. Listing 135 assignments by hand would be the more likely
    /// source of a mismatch, not the less.
    /// </summary>
    protected static Dictionary<string, object?> ColumnParameters(object request, params string[] exclude)
    {
        var skip = new HashSet<string>(exclude, StringComparer.OrdinalIgnoreCase);
        var parameters = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);

        foreach (var property in request.GetType().GetProperties(BindingFlags.Public | BindingFlags.Instance))
        {
            if (skip.Contains(property.Name))
            {
                continue;
            }

            parameters[property.Name] = property.GetValue(request);
        }

        return parameters;
    }
}
