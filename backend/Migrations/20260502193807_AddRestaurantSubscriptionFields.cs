using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace QrOrderSystem.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantSubscriptionFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Restaurants",
                type: "character varying(120)",
                maxLength: 120,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Plan",
                table: "Restaurants",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Basic");

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Restaurants",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Active");

            migrationBuilder.AddColumn<DateTime>(
                name: "SubscriptionEndsAt",
                table: "Restaurants",
                type: "timestamp with time zone",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "City",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "Plan",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "SubscriptionEndsAt",
                table: "Restaurants");
        }
    }
}
