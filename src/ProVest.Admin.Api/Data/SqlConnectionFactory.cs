using System.Data;
using Microsoft.Data.SqlClient;

namespace ProVest.Admin.Api.Data;

public interface ISqlConnectionFactory
{
    Task<IDbConnection> OpenAsync(CancellationToken cancellationToken = default);
}

/// <summary>
/// Opens connections to whichever database the connection string names. No database
/// name is hardcoded anywhere in this app, and the stored procedures use two-part
/// names only, so the target is entirely determined by configuration.
/// </summary>
public sealed class SqlConnectionFactory : ISqlConnectionFactory
{
    public const string ConnectionStringName = "OQMS";

    private readonly string _connectionString;

    public SqlConnectionFactory(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString(ConnectionStringName)
            ?? throw new InvalidOperationException(
                $"Connection string '{ConnectionStringName}' is not configured. Set it in " +
                $"appsettings.Development.json or via the ConnectionStrings__{ConnectionStringName} environment variable.");
    }

    public async Task<IDbConnection> OpenAsync(CancellationToken cancellationToken = default)
    {
        var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        return connection;
    }
}
