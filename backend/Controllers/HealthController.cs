using Microsoft.AspNetCore.Mvc;

namespace QrOrderSystem.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            Status = "ok",
            Time = DateTime.UtcNow
        });
    }
}
