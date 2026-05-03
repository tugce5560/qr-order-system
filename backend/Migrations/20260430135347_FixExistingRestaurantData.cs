using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QrOrderSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixExistingRestaurantData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                INSERT INTO "Restaurants" ("Id", "Name", "Slug", "CreatedAt")
                SELECT 1, 'Demo Restaurant', 'demo-restaurant', NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM "Restaurants" WHERE "Id" = 1
                );
                """);

            migrationBuilder.Sql("""
                UPDATE "Branches"
                SET "RestaurantId" = 1
                WHERE "RestaurantId" IS NULL OR "RestaurantId" <> 1;
                """);

            migrationBuilder.Sql("""
                UPDATE "Categories"
                SET "RestaurantId" = 1
                WHERE "RestaurantId" IS NULL OR "RestaurantId" <> 1;
                """);

            migrationBuilder.Sql("""
                UPDATE "Orders"
                SET "RestaurantId" = 1
                WHERE "RestaurantId" IS NULL OR "RestaurantId" <> 1;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
