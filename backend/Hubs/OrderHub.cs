using Microsoft.AspNetCore.SignalR;

namespace QrOrderSystem.Api.Hubs;

public class OrderHub : Hub
{
    public override async Task OnConnectedAsync()
    {
        var user = Context.User;
        if (user?.Identity?.IsAuthenticated == true)
        {
            var restaurantId = user.Claims
                .FirstOrDefault(c => string.Equals(c.Type, "RestaurantId", StringComparison.OrdinalIgnoreCase))
                ?.Value;

            if (restaurantId != null)
            {
                await Groups.AddToGroupAsync(Context.ConnectionId, $"restaurant:{restaurantId}");

                var roles = user.FindAll("http://schemas.microsoft.com/ws/2008/06/identity/claims/role");
                foreach (var role in roles)
                {
                    if (role.Value == "Kitchen" || role.Value == "Waiter" || role.Value == "RestaurantAdmin")
                    {
                        await Groups.AddToGroupAsync(Context.ConnectionId, $"restaurant:{restaurantId}:{role.Value.ToLower()}");
                    }
                }
            }
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await base.OnDisconnectedAsync(exception);
    }
}
