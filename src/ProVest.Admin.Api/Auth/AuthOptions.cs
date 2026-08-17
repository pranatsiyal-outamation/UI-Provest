using System.Security.Cryptography;
using System.Text;

namespace ProVest.Admin.Api.Auth;

/// <summary>
/// Logins, from the "Auth" section of configuration.
///
/// Passwords are plaintext here. That is a deliberate choice for this stage, not an
/// oversight: anyone who can read this file can already read the database connection
/// string next to it, so hashing would protect very little. It does mean the file must
/// stay out of source control -- appsettings.Development.json is gitignored.
///
/// This gate exists to stop casual access, particularly over the ngrok tunnel. It is
/// not a substitute for real authentication, and it does not authorise anything: every
/// signed-in user can do everything.
/// </summary>
public sealed class AuthOptions
{
    public const string SectionName = "Auth";

    public List<AuthUser> Users { get; set; } = new();

    /// <summary>How long a session lasts before the user has to sign in again.</summary>
    public int SessionHours { get; set; } = 8;

    /// <summary>
    /// Returns the matching user, or null. The username is matched case-insensitively
    /// (people capitalise inconsistently); the password is not.
    /// </summary>
    public AuthUser? Find(string? username, string? password)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrEmpty(password))
        {
            return null;
        }

        var user = Users.FirstOrDefault(u =>
            string.Equals(u.Username, username, StringComparison.OrdinalIgnoreCase));

        if (user is null)
        {
            return null;
        }

        // Fixed-time comparison so a wrong password cannot be narrowed down by timing
        // how long the response takes.
        var supplied = Encoding.UTF8.GetBytes(password);
        var expected = Encoding.UTF8.GetBytes(user.Password);

        return CryptographicOperations.FixedTimeEquals(supplied, expected) ? user : null;
    }
}

public sealed class AuthUser
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    /// <summary>Optional friendly name for the header and the audit log.</summary>
    public string? DisplayName { get; set; }
}
