using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using QrOrderSystem.Api.Data;
using QrOrderSystem.Api.Entities;
using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController(
    IConfiguration configuration,
    AppDbContext dbContext,
    IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        await EnsureDevelopmentUsers();

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user => user.Email.ToLower() == normalizedEmail);

        if (user is null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized();
        }

        return Ok(CreateLoginResponse(user));
    }

    [HttpPost("admin-login")]
    public async Task<IActionResult> AdminLogin(AdminLoginRequest request)
    {
        var restaurantSlug = string.IsNullOrWhiteSpace(request.RestaurantSlug)
            ? "demo-restaurant"
            : request.RestaurantSlug.Trim();

        var restaurant = await dbContext.Restaurants
            .AsNoTracking()
            .FirstOrDefaultAsync(restaurant => restaurant.Slug == restaurantSlug);

        if (restaurant is null)
        {
            return Unauthorized();
        }

        await EnsureDevelopmentUsers();

        var user = await dbContext.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(user =>
                user.RestaurantId == restaurant.Id &&
                user.Role == UserRole.RestaurantAdmin);

        if (user is null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized();
        }

        return Ok(CreateLoginResponse(user));
    }

    private AdminLoginResponse CreateLoginResponse(AppUser user)
    {
        var jwtKey = configuration["Jwt:Key"]
            ?? throw new InvalidOperationException("JWT key is not configured.");
        var issuer = configuration["Jwt:Issuer"]
            ?? throw new InvalidOperationException("JWT issuer is not configured.");
        var audience = configuration["Jwt:Audience"]
            ?? throw new InvalidOperationException("JWT audience is not configured.");
        var expiresMinutes = configuration.GetValue<int>("Jwt:ExpiresMinutes");

        var expiresAt = DateTime.UtcNow.AddMinutes(expiresMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new("userId", user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.Role.ToString())
        };

        if (user.RestaurantId.HasValue)
        {
            claims.Add(new Claim("restaurantId", user.RestaurantId.Value.ToString()));
        }

        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));
        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        var tokenValue = new JwtSecurityTokenHandler().WriteToken(token);

        return new AdminLoginResponse(
            tokenValue,
            expiresAt,
            user.Id,
            user.FullName,
            user.Email,
            user.Role.ToString(),
            user.RestaurantId);
    }

    private async Task EnsureDevelopmentUsers()
    {
        if (!environment.IsDevelopment() || await dbContext.Users.AnyAsync())
        {
            return;
        }

        var restaurant = await dbContext.Restaurants
            .OrderBy(restaurant => restaurant.Id)
            .FirstOrDefaultAsync();

        dbContext.Users.AddRange(
            new AppUser
            {
                FullName = "Super Admin",
                Email = "superadmin@qrorder.local",
                PasswordHash = HashPassword("admin123"),
                Role = UserRole.SuperAdmin
            },
            new AppUser
            {
                FullName = "Restaurant Admin",
                Email = "admin@qrorder.local",
                PasswordHash = HashPassword("admin123"),
                Role = UserRole.RestaurantAdmin,
                RestaurantId = restaurant?.Id
            },
            new AppUser
            {
                FullName = "Kitchen User",
                Email = "kitchen@qrorder.local",
                PasswordHash = HashPassword("admin123"),
                Role = UserRole.Kitchen,
                RestaurantId = restaurant?.Id
            },
            new AppUser
            {
                FullName = "Waiter User",
                Email = "waiter@qrorder.local",
                PasswordHash = HashPassword("admin123"),
                Role = UserRole.Waiter,
                RestaurantId = restaurant?.Id
            },
            new AppUser
            {
                FullName = "Customer User",
                Email = "customer@qrorder.local",
                PasswordHash = HashPassword("admin123"),
                Role = UserRole.Customer,
                RestaurantId = restaurant?.Id
            });

        await dbContext.SaveChangesAsync();
    }

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            100_000,
            HashAlgorithmName.SHA256,
            32);

        return $"{Convert.ToBase64String(salt)}.{Convert.ToBase64String(hash)}";
    }

    private static bool VerifyPassword(string password, string passwordHash)
    {
        var parts = passwordHash.Split('.');

        if (parts.Length != 2)
        {
            return false;
        }

        var salt = Convert.FromBase64String(parts[0]);
        var expectedHash = Convert.FromBase64String(parts[1]);
        var actualHash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            100_000,
            HashAlgorithmName.SHA256,
            32);

        return CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
    }

    public record LoginRequest(string Email, string Password);

    public record AdminLoginRequest(
        string Username,
        string Password,
        string? RestaurantSlug);

    public record AdminLoginResponse(
        string Token,
        DateTime ExpiresAt,
        int UserId,
        string FullName,
        string Email,
        string Role,
        int? RestaurantId);
}
