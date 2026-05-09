using Microsoft.EntityFrameworkCore;
using QrOrderSystem.Api.Entities;

namespace QrOrderSystem.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();
    public DbSet<Branch> Branches => Set<Branch>();
    public DbSet<RestaurantTable> RestaurantTables => Set<RestaurantTable>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<Bill> Bills => Set<Bill>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<Rating> Ratings => Set<Rating>();
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<TableSession> TableSessions => Set<TableSession>();
    public DbSet<WaiterCall> WaiterCalls => Set<WaiterCall>();
    public DbSet<OrderActivityLog> OrderActivityLogs => Set<OrderActivityLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Restaurant>(entity =>
        {
            entity.HasIndex(r => r.Slug).IsUnique();

            entity.Property(r => r.Name).HasMaxLength(200).IsRequired();
            entity.Property(r => r.Slug).HasMaxLength(120).IsRequired();
            entity.Property(r => r.LogoUrl).HasMaxLength(500);
            entity.Property(r => r.PrimaryColor).HasMaxLength(20);
            entity.Property(r => r.SecondaryColor).HasMaxLength(20);
            entity.Property(r => r.AccentColor).HasMaxLength(20);
            entity.Property(r => r.MenuBackgroundColor).HasMaxLength(20);
            entity.Property(r => r.ButtonColor).HasMaxLength(20);
            entity.Property(r => r.City).HasMaxLength(120).IsRequired();
            entity.Property(r => r.Status).HasMaxLength(30).HasDefaultValue("Active").IsRequired();
            entity.Property(r => r.Plan).HasMaxLength(30).HasDefaultValue("Basic").IsRequired();
        });

        modelBuilder.Entity<AppUser>(entity =>
        {
            entity.HasIndex(user => user.Email).IsUnique();

            entity.Property(user => user.FullName).HasMaxLength(200).IsRequired();
            entity.Property(user => user.Email).HasMaxLength(256).IsRequired();
            entity.Property(user => user.PasswordHash).HasMaxLength(500).IsRequired();
            entity.Property(user => user.Role).HasConversion<string>().HasMaxLength(40).IsRequired();

            entity.HasOne(user => user.Restaurant)
                .WithMany(restaurant => restaurant.Users)
                .HasForeignKey(user => user.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Branch>(entity =>
        {
            entity.Property(b => b.Name).HasMaxLength(200).IsRequired();
            entity.Property(b => b.Address).HasMaxLength(500).IsRequired();

            entity.HasOne(b => b.Restaurant)
                .WithMany(r => r.Branches)
                .HasForeignKey(b => b.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<RestaurantTable>(entity =>
        {
            entity.HasIndex(t => new { t.BranchId, t.TableNumber }).IsUnique();

            entity.Property(t => t.QrCodeUrl).HasMaxLength(500).IsRequired();

            entity.HasOne(t => t.Branch)
                .WithMany(b => b.Tables)
                .HasForeignKey(t => t.BranchId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<TableSession>(entity =>
        {
            entity.HasIndex(session => session.Token).IsUnique();
            entity.HasIndex(session => new { session.RestaurantId, session.TableId, session.IsActive });

            entity.Property(session => session.Token).HasMaxLength(128).IsRequired();

            entity.HasOne(session => session.Restaurant)
                .WithMany(restaurant => restaurant.TableSessions)
                .HasForeignKey(session => session.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(session => session.Table)
                .WithMany(table => table.Sessions)
                .HasForeignKey(session => session.TableId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Category>(entity =>
        {
            entity.Property(c => c.Name).HasMaxLength(200).IsRequired();

            entity.HasOne(c => c.Restaurant)
                .WithMany(r => r.Categories)
                .HasForeignKey(c => c.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Product>(entity =>
        {
            entity.Property(p => p.Name).HasMaxLength(200).IsRequired();
            entity.Property(p => p.Description).HasMaxLength(1000);
            entity.Property(p => p.Price).HasPrecision(18, 2);
            entity.Property(p => p.ImageUrl).HasMaxLength(500);
            entity.Property(p => p.Allergens).HasMaxLength(500);
            entity.Property(p => p.Ingredients).HasMaxLength(1000);
            entity.Property(p => p.RemovableIngredients).HasMaxLength(1000);

            entity.HasOne(p => p.Category)
                .WithMany(c => c.Products)
                .HasForeignKey(p => p.CategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Order>(entity =>
        {
            entity.HasIndex(o => o.OrderNumber);

            entity.Property(o => o.OrderNumber).HasMaxLength(50).IsRequired();
            entity.Property(o => o.Status).HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(o => o.Source).HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(o => o.PaymentStatus).HasConversion<string>().HasMaxLength(30);
            entity.Property(o => o.PaymentProvider).HasConversion<string>().HasMaxLength(30);
            entity.Property(o => o.IsPaid).HasDefaultValue(false);
            entity.Property(o => o.TotalAmount).HasPrecision(18, 2);

            entity.HasOne(o => o.Restaurant)
                .WithMany(r => r.Orders)
                .HasForeignKey(o => o.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(o => o.Branch)
                .WithMany(b => b.Orders)
                .HasForeignKey(o => o.BranchId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(o => o.Table)
                .WithMany(t => t.Orders)
                .HasForeignKey(o => o.TableId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(o => o.Bill)
                .WithMany(b => b.Orders)
                .HasForeignKey(o => o.BillId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<OrderItem>(entity =>
        {
            entity.Property(i => i.ProductName).HasMaxLength(200).IsRequired();
            entity.Property(i => i.UnitPrice).HasPrecision(18, 2);
            entity.Property(i => i.Note).HasMaxLength(500);
            entity.Property(i => i.RemovedIngredients).HasMaxLength(500);

            entity.HasOne(i => i.Order)
                .WithMany(o => o.Items)
                .HasForeignKey(i => i.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(i => i.Product)
                .WithMany(p => p.OrderItems)
                .HasForeignKey(i => i.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Bill>(entity =>
        {
            entity.Property(b => b.Status).HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(b => b.BillNumber).HasMaxLength(60).IsRequired();
            entity.Property(b => b.PaymentMethod).HasConversion<string>().HasMaxLength(30);
            entity.Property(b => b.SubTotal).HasPrecision(18, 2);
            entity.Property(b => b.TaxAmount).HasPrecision(18, 2);
            entity.Property(b => b.DiscountAmount).HasPrecision(18, 2);
            entity.Property(b => b.GrandTotal).HasPrecision(18, 2);
            entity.Property(b => b.TotalAmount).HasPrecision(18, 2);

            entity.HasOne(b => b.Restaurant)
                .WithMany()
                .HasForeignKey(b => b.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(b => b.Table)
                .WithMany(t => t.Bills)
                .HasForeignKey(b => b.TableId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<WaiterCall>(entity =>
        {
            entity.HasIndex(call => new { call.RestaurantId, call.TableId, call.Status });
            entity.Property(call => call.Status).HasMaxLength(30).IsRequired();
            entity.Property(call => call.Message).HasMaxLength(500);

            entity.HasOne(call => call.Restaurant)
                .WithMany()
                .HasForeignKey(call => call.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(call => call.Table)
                .WithMany()
                .HasForeignKey(call => call.TableId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(call => call.ResolvedByUser)
                .WithMany()
                .HasForeignKey(call => call.ResolvedByUserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.Property(p => p.Amount).HasPrecision(18, 2);
            entity.Property(p => p.Provider).HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(p => p.Status).HasConversion<string>().HasMaxLength(30).IsRequired();
            entity.Property(p => p.Currency).HasMaxLength(3).HasDefaultValue("TRY").IsRequired();
            entity.Property(p => p.TransactionId).HasMaxLength(120);
            entity.Property(p => p.ProviderPaymentId).HasMaxLength(120);
            entity.Property(p => p.Token).HasMaxLength(160);
            entity.Property(p => p.PaymentUrl).HasMaxLength(500);
            entity.Property(p => p.ErrorMessage).HasMaxLength(1000);
            entity.Property(p => p.Method).HasMaxLength(50).IsRequired();

            entity.HasIndex(p => p.Token).IsUnique();
            entity.HasIndex(p => p.BillId);
            entity.HasIndex(p => new { p.BillId, p.Provider, p.Status })
                .IsUnique()
                .HasFilter("\"BillId\" IS NOT NULL AND \"Provider\" = 'Iyzico' AND \"Status\" = 'Pending'");

            entity.HasOne(p => p.Order)
                .WithMany(o => o.Payments)
                .HasForeignKey(p => p.OrderId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(p => p.Restaurant)
                .WithMany(r => r.Payments)
                .HasForeignKey(p => p.RestaurantId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(p => p.Table)
                .WithMany(t => t.Payments)
                .HasForeignKey(p => p.TableId)
                .OnDelete(DeleteBehavior.SetNull);

            entity.HasOne(p => p.Bill)
                .WithMany(b => b.Payments)
                .HasForeignKey(p => p.BillId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Rating>(entity =>
        {
            entity.Property(r => r.Comment).HasMaxLength(1000);

            entity.HasOne(r => r.Table)
                .WithMany(t => t.Ratings)
                .HasForeignKey(r => r.TableId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<OrderActivityLog>(entity =>
        {
            entity.Property(log => log.Action).HasMaxLength(50).IsRequired();
            entity.Property(log => log.OldSummary).HasMaxLength(2000);
            entity.Property(log => log.NewSummary).HasMaxLength(2000);

            entity.HasOne(log => log.Order)
                .WithMany()
                .HasForeignKey(log => log.OrderId)
                .OnDelete(DeleteBehavior.Cascade);

            entity.HasOne(log => log.User)
                .WithMany()
                .HasForeignKey(log => log.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
