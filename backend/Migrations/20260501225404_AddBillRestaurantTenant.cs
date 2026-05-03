using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QrOrderSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddBillRestaurantTenant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "RestaurantId",
                table: "Bills",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "Bills"
                SET "RestaurantId" = "Branches"."RestaurantId"
                FROM "RestaurantTables"
                INNER JOIN "Branches" ON "RestaurantTables"."BranchId" = "Branches"."Id"
                WHERE "Bills"."TableId" = "RestaurantTables"."Id";
                """);

            migrationBuilder.AlterColumn<int>(
                name: "RestaurantId",
                table: "Bills",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Bills_RestaurantId",
                table: "Bills",
                column: "RestaurantId");

            migrationBuilder.AddForeignKey(
                name: "FK_Bills_Restaurants_RestaurantId",
                table: "Bills",
                column: "RestaurantId",
                principalTable: "Restaurants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Bills_Restaurants_RestaurantId",
                table: "Bills");

            migrationBuilder.DropIndex(
                name: "IX_Bills_RestaurantId",
                table: "Bills");

            migrationBuilder.DropColumn(
                name: "RestaurantId",
                table: "Bills");
        }
    }
}
