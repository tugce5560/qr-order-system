DO $$
DECLARE
    restaurant_id integer;
    branch_id integer;
    drinks_category_id integer;
    food_category_id integer;
BEGIN
    INSERT INTO "Restaurants" (
        "Name",
        "Slug",
        "City",
        "Status",
        "Plan",
        "CreatedAt"
    )
    SELECT
        'Demo Restaurant',
        'demo-restaurant',
        'Istanbul',
        'Active',
        'Basic',
        NOW()
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Restaurants"
        WHERE "Slug" = 'demo-restaurant'
    );

    SELECT "Id"
    INTO restaurant_id
    FROM "Restaurants"
    WHERE "Slug" = 'demo-restaurant';

    INSERT INTO "Branches" (
        "RestaurantId",
        "Name",
        "Address"
    )
    SELECT
        restaurant_id,
        'Main Branch',
        ''
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Branches"
        WHERE "RestaurantId" = restaurant_id
          AND "Name" = 'Main Branch'
    );

    SELECT "Id"
    INTO branch_id
    FROM "Branches"
    WHERE "RestaurantId" = restaurant_id
      AND "Name" = 'Main Branch'
    ORDER BY "Id"
    LIMIT 1;

    INSERT INTO "RestaurantTables" (
        "BranchId",
        "TableNumber",
        "QrCodeUrl",
        "IsActive"
    )
    SELECT
        branch_id,
        1,
        '/customer/r/demo-restaurant/table/1',
        TRUE
    WHERE NOT EXISTS (
        SELECT 1
        FROM "RestaurantTables"
        WHERE "BranchId" = branch_id
          AND "TableNumber" = 1
    );

    INSERT INTO "Categories" (
        "RestaurantId",
        "Name",
        "DisplayOrder",
        "IsActive"
    )
    SELECT
        restaurant_id,
        'Drinks',
        1,
        TRUE
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Categories"
        WHERE "RestaurantId" = restaurant_id
          AND "Name" = 'Drinks'
    );

    INSERT INTO "Categories" (
        "RestaurantId",
        "Name",
        "DisplayOrder",
        "IsActive"
    )
    SELECT
        restaurant_id,
        'Food',
        2,
        TRUE
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Categories"
        WHERE "RestaurantId" = restaurant_id
          AND "Name" = 'Food'
    );

    SELECT "Id"
    INTO drinks_category_id
    FROM "Categories"
    WHERE "RestaurantId" = restaurant_id
      AND "Name" = 'Drinks'
    ORDER BY "Id"
    LIMIT 1;

    SELECT "Id"
    INTO food_category_id
    FROM "Categories"
    WHERE "RestaurantId" = restaurant_id
      AND "Name" = 'Food'
    ORDER BY "Id"
    LIMIT 1;

    INSERT INTO "Products" (
        "CategoryId",
        "Name",
        "Description",
        "Price",
        "ImageUrl",
        "Calories",
        "Allergens",
        "Ingredients",
        "RemovableIngredients",
        "EstimatedPreparationMinutes",
        "IsAvailable",
        "CreatedAt"
    )
    SELECT
        drinks_category_id,
        'Water',
        'Bottle water',
        25.00,
        '',
        0,
        NULL,
        'Water',
        NULL,
        1,
        TRUE,
        NOW()
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Products"
        WHERE "CategoryId" = drinks_category_id
          AND "Name" = 'Water'
    );

    INSERT INTO "Products" (
        "CategoryId",
        "Name",
        "Description",
        "Price",
        "ImageUrl",
        "Calories",
        "Allergens",
        "Ingredients",
        "RemovableIngredients",
        "EstimatedPreparationMinutes",
        "IsAvailable",
        "CreatedAt"
    )
    SELECT
        drinks_category_id,
        'Lemonade',
        'Fresh homemade lemonade',
        95.00,
        '',
        120,
        NULL,
        'Lemon, mint, sugar',
        'Mint, sugar',
        4,
        TRUE,
        NOW()
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Products"
        WHERE "CategoryId" = drinks_category_id
          AND "Name" = 'Lemonade'
    );

    INSERT INTO "Products" (
        "CategoryId",
        "Name",
        "Description",
        "Price",
        "ImageUrl",
        "Calories",
        "Allergens",
        "Ingredients",
        "RemovableIngredients",
        "EstimatedPreparationMinutes",
        "IsAvailable",
        "CreatedAt"
    )
    SELECT
        food_category_id,
        'Burger',
        'Classic beef burger with cheddar',
        220.00,
        '',
        720,
        'Gluten, dairy',
        'Beef patty, cheddar, bun, lettuce, tomato',
        'Lettuce, tomato',
        12,
        TRUE,
        NOW()
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Products"
        WHERE "CategoryId" = food_category_id
          AND "Name" = 'Burger'
    );

    INSERT INTO "Products" (
        "CategoryId",
        "Name",
        "Description",
        "Price",
        "ImageUrl",
        "Calories",
        "Allergens",
        "Ingredients",
        "RemovableIngredients",
        "EstimatedPreparationMinutes",
        "IsAvailable",
        "CreatedAt"
    )
    SELECT
        food_category_id,
        'Pizza',
        'Cheese pizza with tomato sauce',
        260.00,
        '',
        840,
        'Gluten, dairy',
        'Dough, tomato sauce, mozzarella',
        NULL,
        15,
        TRUE,
        NOW()
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Products"
        WHERE "CategoryId" = food_category_id
          AND "Name" = 'Pizza'
    );
END $$;
