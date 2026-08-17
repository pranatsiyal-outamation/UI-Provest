using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using ProVest.Admin.Api.Auth;

namespace ProVest.Admin.Api.Controllers;

public sealed class LoginRequest
{
    [Required]
    [MaxLength(100)]
    public string Username { get; set; } = string.Empty;

    [Required]
    [MaxLength(200)]
    public string Password { get; set; } = string.Empty;
}

public sealed class SessionResponse
{
    [JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string DisplayName { get; set; } = string.Empty;
}

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly AuthOptions _auth;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IOptions<AuthOptions> auth, ILogger<AuthController> logger)
    {
        _auth = auth.Value;
        _logger = logger;
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<SessionResponse>> Login(LoginRequest request)
    {
        var user = _auth.Find(request.Username, request.Password);

        if (user is null)
        {
            // Deliberately the same message whether the username or the password was
            // wrong -- no need to confirm which usernames exist.
            _logger.LogWarning("Failed sign-in attempt for {Username}", request.Username);

            return Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Sign-in failed",
                detail: "That username and password combination was not recognised.");
        }

        var displayName = string.IsNullOrWhiteSpace(user.DisplayName) ? user.Username : user.DisplayName;

        var identity = new ClaimsIdentity(
            new[]
            {
                new Claim(ClaimTypes.Name, user.Username),
                new Claim("displayName", displayName)
            },
            CookieAuthenticationDefaults.AuthenticationScheme);

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = true });

        _logger.LogInformation("{Username} signed in", user.Username);

        return Ok(new SessionResponse { Username = user.Username, DisplayName = displayName });
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var username = User.Identity?.Name;
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        _logger.LogInformation("{Username} signed out", username);
        return NoContent();
    }

    /// <summary>
    /// Who is signed in. Anonymous so the app can ask on load without a redirect --
    /// it returns 401 when there is no session, which is what the client checks.
    /// </summary>
    [AllowAnonymous]
    [HttpGet("me")]
    public ActionResult<SessionResponse> Me()
    {
        if (User.Identity?.IsAuthenticated != true)
        {
            return Unauthorized();
        }

        return Ok(new SessionResponse
        {
            Username = User.Identity.Name ?? string.Empty,
            DisplayName = User.FindFirst("displayName")?.Value ?? User.Identity.Name ?? string.Empty
        });
    }
}
