using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QrOrderSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProductDetailFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EstimatedPreparationMinutes",
                table: "Products",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Ingredients",
                table: "Products",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "EstimatedPreparationMinutes",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Ingredients",
                table: "Products");
        }
    }
}
