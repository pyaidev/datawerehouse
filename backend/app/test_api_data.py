from __future__ import annotations

from copy import deepcopy
from typing import Any

BASE_PRODUCTS: list[dict[str, Any]] = [
    {
        "id": 1,
        "title": "Essence Mascara Lash Princess",
        "description": "Mascara with volumizing and lengthening effect.",
        "category": "beauty",
        "price": 9.99,
        "discountPercentage": 10.48,
        "rating": 2.56,
        "stock": 99,
        "tags": ["beauty", "mascara"],
        "brand": "Essence",
        "sku": "BEA-ESS-ESS-001",
        "weight": 4,
        "dimensions": {"width": 15.14, "height": 13.08, "depth": 22.99},
        "warrantyInformation": "1 week warranty",
        "shippingInformation": "Ships in 3-5 business days",
        "availabilityStatus": "In Stock",
        "reviews": [{"rating": 3, "comment": "Would not recommend!", "reviewerName": "Eleanor Collins", "reviewerEmail": "eleanor.collins@test.local"}],
        "returnPolicy": "No return policy",
        "minimumOrderQuantity": 48,
        "meta": {"createdAt": "2026-07-16T09:00:00Z", "updatedAt": "2026-07-16T09:00:00Z", "barcode": "5784719087687"},
        "images": ["https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp"],
        "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp",
    },
    {
        "id": 2,
        "title": "Eyeshadow Palette with Mirror",
        "description": "Palette with mirror for mobile makeup use.",
        "category": "beauty",
        "price": 19.99,
        "discountPercentage": 18.19,
        "rating": 2.86,
        "stock": 34,
        "tags": ["beauty", "eyeshadow"],
        "brand": "Glamour Beauty",
        "sku": "BEA-GLA-EYE-002",
        "weight": 9,
        "dimensions": {"width": 9.26, "height": 22.47, "depth": 27.67},
        "warrantyInformation": "1 year warranty",
        "shippingInformation": "Ships in 2 weeks",
        "availabilityStatus": "In Stock",
        "reviews": [{"rating": 5, "comment": "Great product!", "reviewerName": "Savannah Gomez", "reviewerEmail": "savannah.gomez@test.local"}],
        "returnPolicy": "7 days return policy",
        "minimumOrderQuantity": 20,
        "meta": {"createdAt": "2026-07-16T09:01:00Z", "updatedAt": "2026-07-16T09:01:00Z", "barcode": "9170275171413"},
        "images": ["https://cdn.dummyjson.com/product-images/beauty/eyeshadow-palette-with-mirror/1.webp"],
        "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/eyeshadow-palette-with-mirror/thumbnail.webp",
    },
    {
        "id": 3,
        "title": "Powder Canister",
        "description": "Setting powder for shine control.",
        "category": "beauty",
        "price": 14.99,
        "discountPercentage": 9.84,
        "rating": 4.64,
        "stock": 89,
        "tags": ["beauty", "face powder"],
        "brand": "Velvet Touch",
        "sku": "BEA-VEL-POW-003",
        "weight": 8,
        "dimensions": {"width": 29.27, "height": 27.93, "depth": 20.59},
        "warrantyInformation": "3 months warranty",
        "shippingInformation": "Ships in 1-2 business days",
        "availabilityStatus": "In Stock",
        "reviews": [{"rating": 4, "comment": "Would buy again!", "reviewerName": "Alexander Jones", "reviewerEmail": "alexander.jones@test.local"}],
        "returnPolicy": "No return policy",
        "minimumOrderQuantity": 22,
        "meta": {"createdAt": "2026-07-16T09:02:00Z", "updatedAt": "2026-07-16T09:02:00Z", "barcode": "8418883906837"},
        "images": ["https://cdn.dummyjson.com/product-images/beauty/powder-canister/1.webp"],
        "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/powder-canister/thumbnail.webp",
    },
    {
        "id": 4,
        "title": "Red Lipstick",
        "description": "Classic red lipstick with creamy finish.",
        "category": "beauty",
        "price": 12.99,
        "discountPercentage": 12.16,
        "rating": 4.36,
        "stock": 91,
        "tags": ["beauty", "lipstick"],
        "brand": "Chic Cosmetics",
        "sku": "BEA-CHI-LIP-004",
        "weight": 1,
        "dimensions": {"width": 18.11, "height": 28.38, "depth": 22.17},
        "warrantyInformation": "3 year warranty",
        "shippingInformation": "Ships in 1 week",
        "availabilityStatus": "In Stock",
        "reviews": [{"rating": 4, "comment": "Great product!", "reviewerName": "Liam Garcia", "reviewerEmail": "liam.garcia@test.local"}],
        "returnPolicy": "7 days return policy",
        "minimumOrderQuantity": 40,
        "meta": {"createdAt": "2026-07-16T09:03:00Z", "updatedAt": "2026-07-16T09:03:00Z", "barcode": "9467746727219"},
        "images": ["https://cdn.dummyjson.com/product-images/beauty/red-lipstick/1.webp"],
        "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/red-lipstick/thumbnail.webp",
    },
    {
        "id": 5,
        "title": "Red Nail Polish",
        "description": "Glossy red nail polish.",
        "category": "beauty",
        "price": 8.99,
        "discountPercentage": 11.44,
        "rating": 4.32,
        "stock": 79,
        "tags": ["beauty", "nail polish"],
        "brand": "Nail Couture",
        "sku": "BEA-NAI-NAI-005",
        "weight": 8,
        "dimensions": {"width": 21.63, "height": 16.48, "depth": 29.84},
        "warrantyInformation": "1 month warranty",
        "shippingInformation": "Ships overnight",
        "availabilityStatus": "In Stock",
        "reviews": [{"rating": 2, "comment": "Poor quality!", "reviewerName": "Benjamin Wilson", "reviewerEmail": "benjamin.wilson@test.local"}],
        "returnPolicy": "No return policy",
        "minimumOrderQuantity": 22,
        "meta": {"createdAt": "2026-07-16T09:04:00Z", "updatedAt": "2026-07-16T09:04:00Z", "barcode": "4063010628104"},
        "images": ["https://cdn.dummyjson.com/product-images/beauty/red-nail-polish/1.webp"],
        "thumbnail": "https://cdn.dummyjson.com/product-images/beauty/red-nail-polish/thumbnail.webp",
    },
]

NULL_RULES = {
    1: {"brand": None, "weight": None},
    2: {"price": None, "availabilityStatus": None},
    3: {"title": "  Powder Canister  ", "thumbnail": None},
    4: {"category": "", "stock": None},
    5: {"discountPercentage": None, "minimumOrderQuantity": None},
}


def local_null_products(limit: int = 20, skip: int = 0) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    requested = max(1, min(limit, 100))

    for index in range(requested):
        template = deepcopy(BASE_PRODUCTS[index % len(BASE_PRODUCTS)])
        cycle = index // len(BASE_PRODUCTS)
        template["id"] = index + 1 + skip
        if cycle:
            template["sku"] = f"{template['sku']}-C{cycle}"
            template["title"] = f"{template['title']} #{cycle + 1}"

        rule = NULL_RULES.get((index % len(BASE_PRODUCTS)) + 1, {})
        template.update(rule)

        if index % 3 == 0:
            template["dimensions"]["width"] = None
        if index % 4 == 1:
            template["reviews"][0]["reviewerEmail"] = None
        if index % 5 == 2:
            template["shippingInformation"] = "   "
        if index % 6 == 3:
            template["meta"]["barcode"] = None

        rows.append(template)

    null_fields = [
        "brand",
        "price",
        "weight",
        "dimensions.width",
        "availabilityStatus",
        "thumbnail",
        "stock",
        "discountPercentage",
        "minimumOrderQuantity",
        "reviews[0].reviewerEmail",
        "meta.barcode",
        "shippingInformation(blank)",
    ]
    return {
        "products": rows,
        "total": requested,
        "skip": skip,
        "limit": requested,
        "test_api": True,
        "scenario": "local_null_imputation",
        "null_fields": null_fields,
        "description": "Lokal test API: Prepare/Imputatsiya/Edit bosqichi uchun ataylab null va blank qiymatlar qo'yilgan.",
    }
