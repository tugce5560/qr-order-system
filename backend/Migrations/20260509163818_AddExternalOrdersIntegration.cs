using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace QrOrderSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddExternalOrdersIntegration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Products_ProductId",
                table: "OrderItems");

            migrationBuilder.AddColumn<string>(
                name: "ExternalCustomerName",
                table: "Orders",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalCustomerPhone",
                table: "Orders",
                type: "character varying(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalDeliveryAddress",
                table: "Orders",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalNote",
                table: "Orders",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalOrderId",
                table: "Orders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalPlatform",
                table: "Orders",
                type: "character varying(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalRawOrderId",
                table: "Orders",
                type: "character varying(120)",
                maxLength: 120,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ExternalStatus",
                table: "Orders",
                type: "character varying(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "OrderItems",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.CreateTable(
                name: "ExternalOrders",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RestaurantId = table.Column<int>(type: "integer", nullable: false),
                    BranchId = table.Column<int>(type: "integer", nullable: false),
                    Platform = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    ExternalOrderId = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    ExternalStatus = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    RawPayloadJson = table.Column<string>(type: "jsonb", nullable: false),
                    NormalizedPayloadJson = table.Column<string>(type: "jsonb", nullable: true),
                    InternalOrderId = table.Column<int>(type: "integer", nullable: true),
                    CustomerName = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    CustomerPhone = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: true),
                    DeliveryAddress = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    TotalAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false, defaultValue: "TRY"),
                    ErrorMessage = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ImportedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ExternalOrders", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ExternalOrders_Branches_BranchId",
                        column: x => x.BranchId,
                        principalTable: "Branches",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ExternalOrders_Orders_InternalOrderId",
                        column: x => x.InternalOrderId,
                        principalTable: "Orders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ExternalOrders_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExternalOrders_BranchId",
                table: "ExternalOrders",
                column: "BranchId");

            migrationBuilder.CreateIndex(
                name: "IX_ExternalOrders_InternalOrderId",
                table: "ExternalOrders",
                column: "InternalOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_ExternalOrders_RestaurantId_Platform_ExternalOrderId",
                table: "ExternalOrders",
                columns: new[] { "RestaurantId", "Platform", "ExternalOrderId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Products_ProductId",
                table: "OrderItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderItems_Products_ProductId",
                table: "OrderItems");

            migrationBuilder.DropTable(
                name: "ExternalOrders");

            migrationBuilder.DropColumn(
                name: "ExternalCustomerName",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalCustomerPhone",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalDeliveryAddress",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalNote",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalOrderId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalPlatform",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalRawOrderId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ExternalStatus",
                table: "Orders");

            migrationBuilder.AlterColumn<int>(
                name: "ProductId",
                table: "OrderItems",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItems_Products_ProductId",
                table: "OrderItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
