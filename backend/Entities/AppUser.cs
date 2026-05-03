using QrOrderSystem.Api.Enums;

namespace QrOrderSystem.Api.Entities;

public class AppUser
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public int? RestaurantId { get; set; }

    public Restaurant? Restaurant { get; set; }
}
