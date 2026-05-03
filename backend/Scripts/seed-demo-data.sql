DO $$
DECLARE
    restaurant_id integer;
    branch_id integer;
    starters_category_id integer;
    mains_category_id integer;
    burgers_category_id integer;
    pizzas_category_id integer;
    drinks_category_id integer;
    desserts_category_id integer;
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

    UPDATE "Restaurants"
    SET
        "Name" = 'Demo Restaurant',
        "City" = COALESCE(NULLIF("City", ''), 'Istanbul'),
        "Status" = COALESCE(NULLIF("Status", ''), 'Active'),
        "Plan" = COALESCE(NULLIF("Plan", ''), 'Basic')
    WHERE "Id" = restaurant_id;

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

    UPDATE "RestaurantTables"
    SET
        "QrCodeUrl" = '/customer/r/demo-restaurant/table/1',
        "IsActive" = TRUE
    WHERE "BranchId" = branch_id
      AND "TableNumber" = 1;

    INSERT INTO "Categories" ("RestaurantId", "Name", "DisplayOrder", "IsActive")
    SELECT restaurant_id, 'Başlangıçlar', 1, TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM "Categories"
        WHERE "RestaurantId" = restaurant_id AND "Name" = 'Başlangıçlar'
    );

    INSERT INTO "Categories" ("RestaurantId", "Name", "DisplayOrder", "IsActive")
    SELECT restaurant_id, 'Ana Yemekler', 2, TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM "Categories"
        WHERE "RestaurantId" = restaurant_id AND "Name" = 'Ana Yemekler'
    );

    INSERT INTO "Categories" ("RestaurantId", "Name", "DisplayOrder", "IsActive")
    SELECT restaurant_id, 'Burgerler', 3, TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM "Categories"
        WHERE "RestaurantId" = restaurant_id AND "Name" = 'Burgerler'
    );

    INSERT INTO "Categories" ("RestaurantId", "Name", "DisplayOrder", "IsActive")
    SELECT restaurant_id, 'Pizzalar', 4, TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM "Categories"
        WHERE "RestaurantId" = restaurant_id AND "Name" = 'Pizzalar'
    );

    INSERT INTO "Categories" ("RestaurantId", "Name", "DisplayOrder", "IsActive")
    SELECT restaurant_id, 'İçecekler', 5, TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM "Categories"
        WHERE "RestaurantId" = restaurant_id AND "Name" = 'İçecekler'
    );

    INSERT INTO "Categories" ("RestaurantId", "Name", "DisplayOrder", "IsActive")
    SELECT restaurant_id, 'Tatlılar', 6, TRUE
    WHERE NOT EXISTS (
        SELECT 1 FROM "Categories"
        WHERE "RestaurantId" = restaurant_id AND "Name" = 'Tatlılar'
    );

    UPDATE "Categories" SET "DisplayOrder" = 1, "IsActive" = TRUE
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Başlangıçlar';

    UPDATE "Categories" SET "DisplayOrder" = 2, "IsActive" = TRUE
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Ana Yemekler';

    UPDATE "Categories" SET "DisplayOrder" = 3, "IsActive" = TRUE
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Burgerler';

    UPDATE "Categories" SET "DisplayOrder" = 4, "IsActive" = TRUE
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Pizzalar';

    UPDATE "Categories" SET "DisplayOrder" = 5, "IsActive" = TRUE
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'İçecekler';

    UPDATE "Categories" SET "DisplayOrder" = 6, "IsActive" = TRUE
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Tatlılar';

    SELECT "Id" INTO starters_category_id
    FROM "Categories"
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Başlangıçlar'
    ORDER BY "Id"
    LIMIT 1;

    SELECT "Id" INTO mains_category_id
    FROM "Categories"
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Ana Yemekler'
    ORDER BY "Id"
    LIMIT 1;

    SELECT "Id" INTO burgers_category_id
    FROM "Categories"
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Burgerler'
    ORDER BY "Id"
    LIMIT 1;

    SELECT "Id" INTO pizzas_category_id
    FROM "Categories"
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Pizzalar'
    ORDER BY "Id"
    LIMIT 1;

    SELECT "Id" INTO drinks_category_id
    FROM "Categories"
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'İçecekler'
    ORDER BY "Id"
    LIMIT 1;

    SELECT "Id" INTO desserts_category_id
    FROM "Categories"
    WHERE "RestaurantId" = restaurant_id AND "Name" = 'Tatlılar'
    ORDER BY "Id"
    LIMIT 1;

    CREATE TEMP TABLE seed_products (
        category_id integer NOT NULL,
        name text NOT NULL,
        description text,
        price numeric(18, 2) NOT NULL,
        image_url text,
        calories integer,
        allergens text,
        ingredients text,
        removable_ingredients text,
        estimated_preparation_minutes integer
    ) ON COMMIT DROP;

    INSERT INTO seed_products (
        category_id,
        name,
        description,
        price,
        image_url,
        calories,
        allergens,
        ingredients,
        removable_ingredients,
        estimated_preparation_minutes
    )
    VALUES
        (
            starters_category_id,
            'Mercimek Çorbası',
            'Geleneksel kırmızı mercimek çorbası, limon ve kızarmış ekmek ile servis edilir.',
            85.00,
            'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80',
            210,
            'Gluten',
            'Kırmızı mercimek, soğan, havuç, tereyağı, baharat',
            'Kızarmış ekmek',
            8
        ),
        (
            starters_category_id,
            'Patates Kızartması',
            'Çıtır patates kızartması, özel dip sos ile.',
            95.00,
            'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80',
            420,
            NULL,
            'Patates, ayçiçek yağı, tuz',
            'Tuz',
            7
        ),
        (
            starters_category_id,
            'Mozzarella Sticks',
            'Pane mozzarella çubukları, marinara sos ile.',
            145.00,
            'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?auto=format&fit=crop&w=900&q=80',
            510,
            'Gluten, süt ürünü',
            'Mozzarella, galeta unu, yumurta, marinara sos',
            NULL,
            10
        ),
        (
            mains_category_id,
            'Izgara Tavuk',
            'Marine edilmiş tavuk göğsü, pilav ve mevsim salatası ile.',
            285.00,
            'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=80',
            620,
            NULL,
            'Tavuk göğsü, pilav, mevsim yeşillikleri',
            'Salata sosu',
            18
        ),
        (
            mains_category_id,
            'Köfte Porsiyon',
            'Izgara köfte, patates kızartması ve közlenmiş biber ile.',
            320.00,
            'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80',
            760,
            'Gluten',
            'Dana kıyma, baharat, patates, biber',
            'Biber',
            20
        ),
        (
            mains_category_id,
            'Tavuk Fajita',
            'Sote tavuk, renkli biberler ve tortilla ekmeği ile sıcak servis.',
            340.00,
            'https://images.unsplash.com/photo-1611599537845-1c7aca0091c0?auto=format&fit=crop&w=900&q=80',
            700,
            'Gluten',
            'Tavuk, biber, soğan, tortilla, baharat',
            'Soğan, biber',
            17
        ),
        (
            burgers_category_id,
            'Classic Burger',
            'Dana köfte, marul, domates, turşu ve özel burger sos.',
            260.00,
            'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80',
            780,
            'Gluten, süt ürünü',
            'Burger ekmeği, dana köfte, marul, domates, turşu, sos',
            'Marul, domates, turşu',
            14
        ),
        (
            burgers_category_id,
            'Cheeseburger',
            'Dana köfte, cheddar peyniri, karamelize soğan ve burger sos.',
            285.00,
            'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80',
            850,
            'Gluten, süt ürünü',
            'Burger ekmeği, dana köfte, cheddar, karamelize soğan, sos',
            'Soğan',
            15
        ),
        (
            burgers_category_id,
            'BBQ Burger',
            'Dana köfte, cheddar, çıtır soğan ve isli BBQ sos.',
            305.00,
            'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=900&q=80',
            900,
            'Gluten, süt ürünü',
            'Burger ekmeği, dana köfte, cheddar, çıtır soğan, BBQ sos',
            'Çıtır soğan',
            16
        ),
        (
            pizzas_category_id,
            'Margherita Pizza',
            'Domates sos, mozzarella ve taze fesleğen.',
            275.00,
            'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80',
            820,
            'Gluten, süt ürünü',
            'Pizza hamuru, domates sos, mozzarella, fesleğen',
            'Fesleğen',
            18
        ),
        (
            pizzas_category_id,
            'Karışık Pizza',
            'Sucuk, mantar, zeytin, biber, mısır ve mozzarella.',
            330.00,
            'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80',
            980,
            'Gluten, süt ürünü',
            'Pizza hamuru, domates sos, mozzarella, sucuk, mantar, zeytin, biber, mısır',
            'Mantar, zeytin, biber, mısır',
            20
        ),
        (
            pizzas_category_id,
            'Sucuklu Pizza',
            'Bol mozzarella ve dana sucuk ile klasik favori.',
            315.00,
            'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=900&q=80',
            940,
            'Gluten, süt ürünü',
            'Pizza hamuru, domates sos, mozzarella, sucuk',
            NULL,
            19
        ),
        (
            drinks_category_id,
            'Su',
            'Şişe su.',
            25.00,
            'https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=900&q=80',
            0,
            NULL,
            'Su',
            NULL,
            1
        ),
        (
            drinks_category_id,
            'Ayran',
            'Soğuk geleneksel ayran.',
            45.00,
            'https://images.unsplash.com/photo-1626201850124-3f3f5333a1e9?auto=format&fit=crop&w=900&q=80',
            90,
            'Süt ürünü',
            'Yoğurt, su, tuz',
            'Tuz',
            1
        ),
        (
            drinks_category_id,
            'Kola',
            'Soğuk kutu kola.',
            65.00,
            'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80',
            140,
            NULL,
            'Gazlı içecek',
            NULL,
            1
        ),
        (
            drinks_category_id,
            'Limonata',
            'Taze limon ve nane ile ev yapımı limonata.',
            95.00,
            'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=900&q=80',
            120,
            NULL,
            'Limon, nane, şeker',
            'Nane, şeker',
            3
        ),
        (
            drinks_category_id,
            'Türk Kahvesi',
            'Geleneksel Türk kahvesi, lokum ile servis edilir.',
            75.00,
            'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80',
            35,
            NULL,
            'Türk kahvesi, su',
            NULL,
            6
        ),
        (
            desserts_category_id,
            'Sütlaç',
            'Fırınlanmış geleneksel sütlaç.',
            115.00,
            'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80',
            330,
            'Süt ürünü',
            'Süt, pirinç, şeker, tarçın',
            'Tarçın',
            2
        ),
        (
            desserts_category_id,
            'Cheesecake',
            'Frambuaz soslu kremalı cheesecake.',
            145.00,
            'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80',
            520,
            'Gluten, süt ürünü, yumurta',
            'Krem peynir, bisküvi, yumurta, frambuaz sos',
            'Frambuaz sos',
            2
        ),
        (
            desserts_category_id,
            'Brownie',
            'Yoğun çikolatalı brownie, vanilyalı dondurma ile.',
            135.00,
            'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80',
            560,
            'Gluten, süt ürünü, yumurta',
            'Çikolata, kakao, un, tereyağı, yumurta',
            'Dondurma',
            3
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
        seed_products.category_id,
        seed_products.name,
        seed_products.description,
        seed_products.price,
        seed_products.image_url,
        seed_products.calories,
        seed_products.allergens,
        seed_products.ingredients,
        seed_products.removable_ingredients,
        seed_products.estimated_preparation_minutes,
        TRUE,
        NOW()
    FROM seed_products
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Products"
        WHERE "CategoryId" = seed_products.category_id
          AND "Name" = seed_products.name
    );

    UPDATE "Products"
    SET
        "Description" = seed_products.description,
        "Price" = seed_products.price,
        "ImageUrl" = seed_products.image_url,
        "Calories" = seed_products.calories,
        "Allergens" = seed_products.allergens,
        "Ingredients" = seed_products.ingredients,
        "RemovableIngredients" = seed_products.removable_ingredients,
        "EstimatedPreparationMinutes" = seed_products.estimated_preparation_minutes,
        "IsAvailable" = TRUE
    FROM seed_products
    WHERE "Products"."CategoryId" = seed_products.category_id
      AND "Products"."Name" = seed_products.name;

    INSERT INTO "Users" (
        "FullName",
        "Email",
        "PasswordHash",
        "Role",
        "RestaurantId"
    )
    VALUES
        (
            'Demo Super Admin',
            'superadmin@test.com',
            'cXJvcmRlci1kZW1vLXNhMQ==.SB2CFnDGvRT3fcQo+agUfy3xIdf+hcNt5kWBee/w78U=',
            'SuperAdmin',
            NULL
        ),
        (
            'Demo Admin',
            'admin@test.com',
            'cXJvcmRlci1kZW1vLWFkMQ==.0f3pPaCMefhPzUTSxUQLKosIgghDvvwd20+um/QaOm0=',
            'RestaurantAdmin',
            restaurant_id
        ),
        (
            'Demo Kitchen',
            'kitchen@test.com',
            'cXJvcmRlci1kZW1vLWtpMQ==.ckrFO/agxrMwXdc5NE0wMJSZiWmifpQfpVk8TaKsByE=',
            'Kitchen',
            restaurant_id
        ),
        (
            'Demo Waiter',
            'waiter@test.com',
            'cXJvcmRlci1kZW1vLXdhMQ==.vU23HbVIVsOxLFLNXvgkT6K6+zvObQY4zYuToSCjk5s=',
            'Waiter',
            restaurant_id
        )
    ON CONFLICT ("Email")
    DO UPDATE SET
        "FullName" = EXCLUDED."FullName",
        "PasswordHash" = EXCLUDED."PasswordHash",
        "Role" = EXCLUDED."Role",
        "RestaurantId" = EXCLUDED."RestaurantId";
END $$;
