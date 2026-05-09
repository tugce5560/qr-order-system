using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QrOrderSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddIyzicoCheckoutPaymentFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ProviderPaymentId",
                table: "Payments",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Token",
                table: "Payments",
                type: "character varying(160)",
                maxLength: 160,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_BillId_Provider_Status",
                table: "Payments",
                columns: new[] { "BillId", "Provider", "Status" },
                unique: true,
                filter: "\"BillId\" IS NOT NULL AND \"Provider\" = 'Iyzico' AND \"Status\" = 'Pending'");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_Token",
                table: "Payments",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_BillId_Provider_Status",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_Token",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "ProviderPaymentId",
                table: "Payments");

            migrationBuilder.DropColumn(
                name: "Token",
                table: "Payments");
        }
    }
}
