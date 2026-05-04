DO $$
BEGIN
    CREATE TEMP TABLE seed_restaurants (
        slug text PRIMARY KEY,
        name text NOT NULL,
        city text NOT NULL,
        logo_url text,
        primary_color text,
        secondary_color text,
        accent_color text,
        menu_background_color text,
        button_color text,
        branch_name text NOT NULL,
        branch_address text NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO seed_restaurants (
        slug,
        name,
        city,
        logo_url,
        primary_color,
        secondary_color,
        accent_color,
        menu_background_color,
        button_color,
        branch_name,
        branch_address
    )
    VALUES
        (
            'demo-restaurant',
            'Demo Restaurant',
            'Istanbul',
            'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=900&q=80',
            '#1f6f5b',
            '#f4a261',
            '#e76f51',
            '#fff8ef',
            '#1f6f5b',
            'Main Branch',
            'Istanbul merkez'
        ),
        (
            'mavi-masa-bistro',
            'Mavi Masa Bistro',
            'Izmir',
            'https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=900&q=80',
            '#0f5f7a',
            '#d9f3f0',
            '#ffb703',
            '#f5fbfc',
            '#0f5f7a',
            'Alsancak Şube',
            'Alsancak, Izmir'
        ),
        (
            'kuzey-grill',
            'Kuzey Grill',
            'Ankara',
            'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=900&q=80',
            '#2f2f2f',
            '#f1c27d',
            '#c44536',
            '#fff7ed',
            '#c44536',
            'Çankaya Şube',
            'Çankaya, Ankara'
        ),
        (
            'limon-cafe',
            'Limon Cafe',
            'Antalya',
            'https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=900&q=80',
            '#5f8d4e',
            '#f7e987',
            '#ff7f50',
            '#fffdf2',
            '#5f8d4e',
            'Lara Şube',
            'Lara, Antalya'
        );

    INSERT INTO "Restaurants" (
        "Name",
        "Slug",
        "LogoUrl",
        "PrimaryColor",
        "SecondaryColor",
        "AccentColor",
        "MenuBackgroundColor",
        "ButtonColor",
        "City",
        "Status",
        "Plan",
        "CreatedAt"
    )
    SELECT
        name,
        slug,
        logo_url,
        primary_color,
        secondary_color,
        accent_color,
        menu_background_color,
        button_color,
        city,
        'Active',
        'Pro',
        NOW()
    FROM seed_restaurants
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Restaurants"
        WHERE "Slug" = seed_restaurants.slug
    );

    UPDATE "Restaurants" r
    SET
        "Name" = sr.name,
        "LogoUrl" = sr.logo_url,
        "PrimaryColor" = sr.primary_color,
        "SecondaryColor" = sr.secondary_color,
        "AccentColor" = sr.accent_color,
        "MenuBackgroundColor" = sr.menu_background_color,
        "ButtonColor" = sr.button_color,
        "City" = sr.city,
        "Status" = 'Active',
        "Plan" = 'Pro'
    FROM seed_restaurants sr
    WHERE r."Slug" = sr.slug;

    INSERT INTO "Branches" (
        "RestaurantId",
        "Name",
        "Address"
    )
    SELECT
        r."Id",
        sr.branch_name,
        sr.branch_address
    FROM seed_restaurants sr
    JOIN "Restaurants" r ON r."Slug" = sr.slug
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Branches" b
        WHERE b."RestaurantId" = r."Id"
          AND b."Name" = sr.branch_name
    );

    UPDATE "Branches" b
    SET "Address" = sr.branch_address
    FROM seed_restaurants sr
    JOIN "Restaurants" r ON r."Slug" = sr.slug
    WHERE b."RestaurantId" = r."Id"
      AND b."Name" = sr.branch_name;

    INSERT INTO "RestaurantTables" (
        "BranchId",
        "TableNumber",
        "QrCodeUrl",
        "IsActive"
    )
    SELECT
        b."Id",
        table_numbers.table_number,
        '/customer/r/' || sr.slug || '/table/' || table_numbers.table_number,
        TRUE
    FROM seed_restaurants sr
    JOIN "Restaurants" r ON r."Slug" = sr.slug
    JOIN "Branches" b ON b."RestaurantId" = r."Id" AND b."Name" = sr.branch_name
    CROSS JOIN generate_series(1, 4) AS table_numbers(table_number)
    WHERE NOT EXISTS (
        SELECT 1
        FROM "RestaurantTables" rt
        WHERE rt."BranchId" = b."Id"
          AND rt."TableNumber" = table_numbers.table_number
    );

    UPDATE "RestaurantTables" rt
    SET
        "QrCodeUrl" = '/customer/r/' || sr.slug || '/table/' || rt."TableNumber",
        "IsActive" = TRUE
    FROM seed_restaurants sr
    JOIN "Restaurants" r ON r."Slug" = sr.slug
    JOIN "Branches" b ON b."RestaurantId" = r."Id" AND b."Name" = sr.branch_name
    WHERE rt."BranchId" = b."Id"
      AND rt."TableNumber" BETWEEN 1 AND 4;

    CREATE TEMP TABLE seed_categories (
        restaurant_slug text NOT NULL,
        name text NOT NULL,
        display_order integer NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO seed_categories (restaurant_slug, name, display_order)
    VALUES
        ('demo-restaurant', 'Başlangıçlar', 1),
        ('demo-restaurant', 'Ana Yemekler', 2),
        ('demo-restaurant', 'Burgerler', 3),
        ('demo-restaurant', 'Pizzalar', 4),
        ('demo-restaurant', 'İçecekler', 5),
        ('demo-restaurant', 'Tatlılar', 6),

        ('mavi-masa-bistro', 'Kahvaltı', 1),
        ('mavi-masa-bistro', 'Deniz Ürünleri', 2),
        ('mavi-masa-bistro', 'Salatalar', 3),
        ('mavi-masa-bistro', 'Makarnalar', 4),
        ('mavi-masa-bistro', 'İçecekler', 5),
        ('mavi-masa-bistro', 'Tatlılar', 6),

        ('kuzey-grill', 'Başlangıçlar', 1),
        ('kuzey-grill', 'Izgaralar', 2),
        ('kuzey-grill', 'Burgerler', 3),
        ('kuzey-grill', 'Yan Lezzetler', 4),
        ('kuzey-grill', 'İçecekler', 5),
        ('kuzey-grill', 'Tatlılar', 6),

        ('limon-cafe', 'Kahvaltı', 1),
        ('limon-cafe', 'Sandviçler', 2),
        ('limon-cafe', 'Kahveler', 3),
        ('limon-cafe', 'Soğuk İçecekler', 4),
        ('limon-cafe', 'Tatlılar', 5);

    INSERT INTO "Categories" (
        "RestaurantId",
        "Name",
        "DisplayOrder",
        "IsActive"
    )
    SELECT
        r."Id",
        sc.name,
        sc.display_order,
        TRUE
    FROM seed_categories sc
    JOIN "Restaurants" r ON r."Slug" = sc.restaurant_slug
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Categories" c
        WHERE c."RestaurantId" = r."Id"
          AND c."Name" = sc.name
    );

    UPDATE "Categories" c
    SET
        "DisplayOrder" = sc.display_order,
        "IsActive" = TRUE
    FROM seed_categories sc
    JOIN "Restaurants" r ON r."Slug" = sc.restaurant_slug
    WHERE c."RestaurantId" = r."Id"
      AND c."Name" = sc.name;

    CREATE TEMP TABLE seed_products (
        restaurant_slug text NOT NULL,
        category_name text NOT NULL,
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
        restaurant_slug,
        category_name,
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
        ('demo-restaurant', 'Başlangıçlar', 'Mercimek Çorbası', 'Geleneksel kırmızı mercimek çorbası, limon ve kızarmış ekmek ile servis edilir.', 85.00, 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=900&q=80', 210, 'Gluten', 'Kırmızı mercimek, soğan, havuç, tereyağı, baharat', 'Kızarmış ekmek', 8),
        ('demo-restaurant', 'Başlangıçlar', 'Patates Kızartması', 'Çıtır patates kızartması, özel dip sos ile.', 95.00, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80', 420, NULL, 'Patates, ayçiçek yağı, tuz', 'Tuz', 7),
        ('demo-restaurant', 'Başlangıçlar', 'Mozzarella Sticks', 'Pane mozzarella çubukları, marinara sos ile.', 145.00, 'https://images.unsplash.com/photo-1548340748-6d2b7d7da280?auto=format&fit=crop&w=900&q=80', 510, 'Gluten, süt ürünü', 'Mozzarella, galeta unu, yumurta, marinara sos', NULL, 10),
        ('demo-restaurant', 'Ana Yemekler', 'Izgara Tavuk', 'Marine edilmiş tavuk göğsü, pilav ve mevsim salatası ile.', 285.00, 'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=900&q=80', 620, NULL, 'Tavuk göğsü, pilav, mevsim yeşillikleri', 'Salata sosu', 18),
        ('demo-restaurant', 'Ana Yemekler', 'Köfte Porsiyon', 'Izgara köfte, patates kızartması ve közlenmiş biber ile.', 320.00, 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80', 760, 'Gluten', 'Dana kıyma, baharat, patates, biber', 'Biber', 20),
        ('demo-restaurant', 'Ana Yemekler', 'Tavuk Fajita', 'Sote tavuk, renkli biberler ve tortilla ekmeği ile sıcak servis.', 340.00, 'https://images.unsplash.com/photo-1611599537845-1c7aca0091c0?auto=format&fit=crop&w=900&q=80', 700, 'Gluten', 'Tavuk, biber, soğan, tortilla, baharat', 'Soğan, biber', 17),
        ('demo-restaurant', 'Burgerler', 'Classic Burger', 'Dana köfte, marul, domates, turşu ve özel burger sos.', 260.00, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=900&q=80', 780, 'Gluten, süt ürünü', 'Burger ekmeği, dana köfte, marul, domates, turşu, sos', 'Marul, domates, turşu', 14),
        ('demo-restaurant', 'Burgerler', 'Cheeseburger', 'Dana köfte, cheddar peyniri, karamelize soğan ve burger sos.', 285.00, 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=900&q=80', 850, 'Gluten, süt ürünü', 'Burger ekmeği, dana köfte, cheddar, karamelize soğan, sos', 'Soğan', 15),
        ('demo-restaurant', 'Burgerler', 'BBQ Burger', 'Dana köfte, cheddar, çıtır soğan ve isli BBQ sos.', 305.00, 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&w=900&q=80', 900, 'Gluten, süt ürünü', 'Burger ekmeği, dana köfte, cheddar, çıtır soğan, BBQ sos', 'Çıtır soğan', 16),
        ('demo-restaurant', 'Pizzalar', 'Margherita Pizza', 'Domates sos, mozzarella ve taze fesleğen.', 275.00, 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?auto=format&fit=crop&w=900&q=80', 820, 'Gluten, süt ürünü', 'Pizza hamuru, domates sos, mozzarella, fesleğen', 'Fesleğen', 18),
        ('demo-restaurant', 'Pizzalar', 'Karışık Pizza', 'Sucuk, mantar, zeytin, biber, mısır ve mozzarella.', 330.00, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80', 980, 'Gluten, süt ürünü', 'Pizza hamuru, domates sos, mozzarella, sucuk, mantar, zeytin, biber, mısır', 'Mantar, zeytin, biber, mısır', 20),
        ('demo-restaurant', 'Pizzalar', 'Sucuklu Pizza', 'Bol mozzarella ve dana sucuk ile klasik favori.', 315.00, 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=900&q=80', 940, 'Gluten, süt ürünü', 'Pizza hamuru, domates sos, mozzarella, sucuk', NULL, 19),
        ('demo-restaurant', 'İçecekler', 'Su', 'Şişe su.', 25.00, 'https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=900&q=80', 0, NULL, 'Su', NULL, 1),
        ('demo-restaurant', 'İçecekler', 'Ayran', 'Soğuk geleneksel ayran.', 45.00, 'https://images.unsplash.com/photo-1626201850124-3f3f5333a1e9?auto=format&fit=crop&w=900&q=80', 90, 'Süt ürünü', 'Yoğurt, su, tuz', 'Tuz', 1),
        ('demo-restaurant', 'İçecekler', 'Kola', 'Soğuk kutu kola.', 65.00, 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80', 140, NULL, 'Gazlı içecek', NULL, 1),
        ('demo-restaurant', 'İçecekler', 'Limonata', 'Taze limon ve nane ile ev yapımı limonata.', 95.00, 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=900&q=80', 120, NULL, 'Limon, nane, şeker', 'Nane, şeker', 3),
        ('demo-restaurant', 'İçecekler', 'Türk Kahvesi', 'Geleneksel Türk kahvesi, lokum ile servis edilir.', 75.00, 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=900&q=80', 35, NULL, 'Türk kahvesi, su', NULL, 6),
        ('demo-restaurant', 'Tatlılar', 'Sütlaç', 'Fırınlanmış geleneksel sütlaç.', 115.00, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80', 330, 'Süt ürünü', 'Süt, pirinç, şeker, tarçın', 'Tarçın', 2),
        ('demo-restaurant', 'Tatlılar', 'Cheesecake', 'Frambuaz soslu kremalı cheesecake.', 145.00, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80', 520, 'Gluten, süt ürünü, yumurta', 'Krem peynir, bisküvi, yumurta, frambuaz sos', 'Frambuaz sos', 2),
        ('demo-restaurant', 'Tatlılar', 'Brownie', 'Yoğun çikolatalı brownie, vanilyalı dondurma ile.', 135.00, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=900&q=80', 560, 'Gluten, süt ürünü, yumurta', 'Çikolata, kakao, un, tereyağı, yumurta', 'Dondurma', 3),

        ('mavi-masa-bistro', 'Kahvaltı', 'Ege Kahvaltı Tabağı', 'Ezine peyniri, zeytin, domates, salatalık, bal-kaymak ve sıcak pişi.', 295.00, 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80', 720, 'Gluten, süt ürünü', 'Peynir, zeytin, domates, salatalık, bal, kaymak, pişi', 'Bal, kaymak', 12),
        ('mavi-masa-bistro', 'Kahvaltı', 'Otlu Omlet', 'Taze otlar ve beyaz peynir ile tavada omlet.', 175.00, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80', 390, 'Yumurta, süt ürünü', 'Yumurta, beyaz peynir, maydanoz, dereotu', 'Peynir', 8),
        ('mavi-masa-bistro', 'Deniz Ürünleri', 'Levrek Izgara', 'Izgara levrek, roka salatası ve limon sos ile.', 520.00, 'https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?auto=format&fit=crop&w=900&q=80', 610, 'Balık', 'Levrek, roka, limon, zeytinyağı', 'Roka', 22),
        ('mavi-masa-bistro', 'Deniz Ürünleri', 'Karides Güveç', 'Tereyağlı karides, domates ve biber ile fırında.', 465.00, 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?auto=format&fit=crop&w=900&q=80', 540, 'Kabuklu deniz ürünü, süt ürünü', 'Karides, tereyağı, domates, biber, kaşar', 'Kaşar, biber', 18),
        ('mavi-masa-bistro', 'Salatalar', 'Roka Parmesan Salata', 'Roka, parmesan, ceviz ve nar ekşili sos.', 210.00, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80', 330, 'Süt ürünü, ceviz', 'Roka, parmesan, ceviz, nar ekşisi', 'Ceviz, parmesan', 7),
        ('mavi-masa-bistro', 'Makarnalar', 'Deniz Mahsullü Linguine', 'Karides, kalamar ve domates soslu linguine.', 395.00, 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=900&q=80', 780, 'Gluten, kabuklu deniz ürünü', 'Linguine, karides, kalamar, domates sos', 'Kalamar', 17),
        ('mavi-masa-bistro', 'İçecekler', 'Reyhan Şerbeti', 'Soğuk reyhan şerbeti, limon ve karanfil aromasıyla.', 95.00, 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=80', 110, NULL, 'Reyhan, limon, şeker, karanfil', 'Şeker', 2),
        ('mavi-masa-bistro', 'Tatlılar', 'Limonlu Tart', 'Kıtır taban üzerinde limon kreması ve hafif mereng.', 165.00, 'https://images.unsplash.com/photo-1519915028121-7d3463d20b13?auto=format&fit=crop&w=900&q=80', 430, 'Gluten, süt ürünü, yumurta', 'Un, tereyağı, limon, yumurta, şeker', NULL, 3),

        ('kuzey-grill', 'Başlangıçlar', 'Acılı Ezme', 'Domates, biber ve baharatlarla hazırlanan taze ezme.', 90.00, 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80', 160, NULL, 'Domates, biber, maydanoz, isot, nar ekşisi', 'Acı', 5),
        ('kuzey-grill', 'Başlangıçlar', 'Humus', 'Tahinli humus, zeytinyağı ve çıtır lavaş ile.', 135.00, 'https://images.unsplash.com/photo-1577906096429-f73c2c312435?auto=format&fit=crop&w=900&q=80', 380, 'Susam, gluten', 'Nohut, tahin, limon, zeytinyağı, lavaş', 'Lavaş', 6),
        ('kuzey-grill', 'Izgaralar', 'Adana Kebap', 'Zırh kıyma Adana kebap, lavaş ve köz sebze ile.', 385.00, 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80', 860, 'Gluten', 'Kıyma, baharat, lavaş, köz sebze', 'Lavaş, soğan', 20),
        ('kuzey-grill', 'Izgaralar', 'Dana Antrikot', 'Izgara antrikot, baharatlı patates ve demi glace sos.', 690.00, 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=900&q=80', 940, 'Süt ürünü', 'Dana antrikot, patates, tereyağı, demi glace', 'Sos', 24),
        ('kuzey-grill', 'Burgerler', 'Smash Burger', 'Çift smash köfte, cheddar, turşu ve özel sos.', 335.00, 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&w=900&q=80', 920, 'Gluten, süt ürünü', 'Burger ekmeği, dana köfte, cheddar, turşu, sos', 'Turşu, sos', 13),
        ('kuzey-grill', 'Yan Lezzetler', 'Trüflü Patates', 'İnce patates kızartması, parmesan ve trüf aroması.', 155.00, 'https://images.unsplash.com/photo-1576107232684-1279f390859f?auto=format&fit=crop&w=900&q=80', 520, 'Süt ürünü', 'Patates, parmesan, trüf yağı', 'Parmesan', 7),
        ('kuzey-grill', 'İçecekler', 'Fesleğenli Ayran', 'Soğuk ayran, taze fesleğen ve kaya tuzu ile.', 70.00, 'https://images.unsplash.com/photo-1626201850124-3f3f5333a1e9?auto=format&fit=crop&w=900&q=80', 105, 'Süt ürünü', 'Yoğurt, su, fesleğen, tuz', 'Fesleğen, tuz', 2),
        ('kuzey-grill', 'Tatlılar', 'Katmer', 'Antep fıstıklı sıcak katmer, kaymak ile.', 195.00, 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=900&q=80', 680, 'Gluten, süt ürünü, fıstık', 'Yufka, kaymak, fıstık, şeker', 'Kaymak', 6),

        ('limon-cafe', 'Kahvaltı', 'Avokadolu Tost', 'Ekşi mayalı ekmek, avokado, poşe yumurta ve chili flakes.', 235.00, 'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80', 520, 'Gluten, yumurta', 'Ekşi maya ekmek, avokado, yumurta, baharat', 'Yumurta, chili', 10),
        ('limon-cafe', 'Kahvaltı', 'Granola Kasesi', 'Yoğurt, ev yapımı granola, mevsim meyveleri ve bal.', 185.00, 'https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=900&q=80', 430, 'Gluten, süt ürünü, fındık', 'Yoğurt, granola, meyve, bal', 'Bal, fındık', 4),
        ('limon-cafe', 'Sandviçler', 'Füme Hindi Sandviç', 'Füme hindi, cheddar, yeşillik ve hardallı sos.', 245.00, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80', 620, 'Gluten, süt ürünü, hardal', 'Sandviç ekmeği, hindi, cheddar, yeşillik, hardal sos', 'Sos, cheddar', 8),
        ('limon-cafe', 'Sandviçler', 'Izgara Sebzeli Panini', 'Kabak, patlıcan, biber, pesto ve mozzarella ile panini.', 225.00, 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=900&q=80', 570, 'Gluten, süt ürünü, fıstık', 'Panini ekmeği, sebze, pesto, mozzarella', 'Pesto, mozzarella', 9),
        ('limon-cafe', 'Kahveler', 'Flat White', 'Çift espresso ve mikro köpük süt ile dengeli kahve.', 105.00, 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=900&q=80', 120, 'Süt ürünü', 'Espresso, süt', 'Süt', 4),
        ('limon-cafe', 'Kahveler', 'Iced Latte', 'Soğuk süt, buz ve espresso.', 115.00, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80', 130, 'Süt ürünü', 'Espresso, süt, buz', 'Süt', 3),
        ('limon-cafe', 'Soğuk İçecekler', 'Çilekli Limonata', 'Taze limonata, çilek püresi ve nane.', 125.00, 'https://images.unsplash.com/photo-1621263764928-df1444c5e859?auto=format&fit=crop&w=900&q=80', 150, NULL, 'Limon, çilek, nane, şeker', 'Şeker, nane', 3),
        ('limon-cafe', 'Tatlılar', 'San Sebastian Cheesecake', 'Kremamsı San Sebastian cheesecake, hafif yanık üst dokusuyla.', 175.00, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80', 580, 'Süt ürünü, yumurta', 'Krem peynir, yumurta, krema, şeker', NULL, 2),
        ('limon-cafe', 'Tatlılar', 'Lotus Magnolia', 'Lotus bisküvi, vanilyalı krema ve muz katmanları.', 165.00, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80', 520, 'Gluten, süt ürünü', 'Lotus bisküvi, krema, muz', 'Muz', 2);

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
        c."Id",
        sp.name,
        sp.description,
        sp.price,
        sp.image_url,
        sp.calories,
        sp.allergens,
        sp.ingredients,
        sp.removable_ingredients,
        sp.estimated_preparation_minutes,
        TRUE,
        NOW()
    FROM seed_products sp
    JOIN "Restaurants" r ON r."Slug" = sp.restaurant_slug
    JOIN "Categories" c ON c."RestaurantId" = r."Id" AND c."Name" = sp.category_name
    WHERE NOT EXISTS (
        SELECT 1
        FROM "Products" p
        WHERE p."CategoryId" = c."Id"
          AND p."Name" = sp.name
    );

    UPDATE "Products" p
    SET
        "Description" = sp.description,
        "Price" = sp.price,
        "ImageUrl" = sp.image_url,
        "Calories" = sp.calories,
        "Allergens" = sp.allergens,
        "Ingredients" = sp.ingredients,
        "RemovableIngredients" = sp.removable_ingredients,
        "EstimatedPreparationMinutes" = sp.estimated_preparation_minutes,
        "IsAvailable" = TRUE
    FROM seed_products sp
    JOIN "Restaurants" r ON r."Slug" = sp.restaurant_slug
    JOIN "Categories" c ON c."RestaurantId" = r."Id" AND c."Name" = sp.category_name
    WHERE p."CategoryId" = c."Id"
      AND p."Name" = sp.name;

    INSERT INTO "Users" (
        "FullName",
        "Email",
        "PasswordHash",
        "Role",
        "RestaurantId"
    )
    SELECT
        users.full_name,
        users.email,
        users.password_hash,
        users.role,
        restaurants."Id"
    FROM (
        VALUES
            ('Demo Super Admin', 'superadmin@test.com', 'cXJvcmRlci1kZW1vLXNhMQ==.SB2CFnDGvRT3fcQo+agUfy3xIdf+hcNt5kWBee/w78U=', 'SuperAdmin', NULL),
            ('Demo Admin', 'admin@test.com', 'cXJvcmRlci1kZW1vLWFkMQ==.0f3pPaCMefhPzUTSxUQLKosIgghDvvwd20+um/QaOm0=', 'RestaurantAdmin', 'demo-restaurant'),
            ('Demo Kitchen', 'kitchen@test.com', 'cXJvcmRlci1kZW1vLWtpMQ==.ckrFO/agxrMwXdc5NE0wMJSZiWmifpQfpVk8TaKsByE=', 'Kitchen', 'demo-restaurant'),
            ('Demo Waiter', 'waiter@test.com', 'cXJvcmRlci1kZW1vLXdhMQ==.vU23HbVIVsOxLFLNXvgkT6K6+zvObQY4zYuToSCjk5s=', 'Waiter', 'demo-restaurant'),
            ('Mavi Masa Admin', 'admin.mavi@test.com', 'cXJvcmRlci1kZW1vLWFkMQ==.0f3pPaCMefhPzUTSxUQLKosIgghDvvwd20+um/QaOm0=', 'RestaurantAdmin', 'mavi-masa-bistro'),
            ('Kuzey Grill Admin', 'admin.kuzey@test.com', 'cXJvcmRlci1kZW1vLWFkMQ==.0f3pPaCMefhPzUTSxUQLKosIgghDvvwd20+um/QaOm0=', 'RestaurantAdmin', 'kuzey-grill'),
            ('Limon Cafe Admin', 'admin.limon@test.com', 'cXJvcmRlci1kZW1vLWFkMQ==.0f3pPaCMefhPzUTSxUQLKosIgghDvvwd20+um/QaOm0=', 'RestaurantAdmin', 'limon-cafe')
    ) AS users(full_name, email, password_hash, role, restaurant_slug)
    LEFT JOIN "Restaurants" restaurants ON restaurants."Slug" = users.restaurant_slug
    ON CONFLICT ("Email")
    DO UPDATE SET
        "FullName" = EXCLUDED."FullName",
        "PasswordHash" = EXCLUDED."PasswordHash",
        "Role" = EXCLUDED."Role",
        "RestaurantId" = EXCLUDED."RestaurantId";
END $$;
