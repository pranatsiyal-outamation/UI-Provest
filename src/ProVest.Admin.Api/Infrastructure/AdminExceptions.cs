namespace ProVest.Admin.Api.Infrastructure;

/// <summary>
/// Guard failures the services raise. These previously came back as T-SQL THROW 51001/2/3
/// from the stored procedures; with inline queries the checks live in C#, so they need
/// exception types the error middleware can map to the same HTTP responses.
/// </summary>
public abstract class AdminException : Exception
{
    protected AdminException(string message) : base(message) { }
}

/// <summary>No row matched the supplied id.</summary>
public sealed class RecordNotFoundException : AdminException
{
    public RecordNotFoundException(string table)
        : base($"No {table} row found for the supplied id.") { }
}

/// <summary>
/// More than one row shares the id. Import_Update and ImportFileHeader have no primary
/// key, so a duplicated id cannot identify a single row and the write is refused rather
/// than applied to all of them.
/// </summary>
public sealed class RecordNotUniqueException : AdminException
{
    public RecordNotUniqueException(string table)
        : base($"{table}.id is not unique; refusing to modify or delete multiple rows.") { }
}

/// <summary>An insert would create a second row with an id that already exists.</summary>
public sealed class RecordIdInUseException : AdminException
{
    public RecordIdInUseException(string table)
        : base($"A {table} row with that id already exists.") { }
}
