SOURCES = {
    "local_null_products": {
        "title": "Local Test API - Null Products",
        "endpoint": "/test-api/products-null",
        "collection": "products",
        "entity": "product",
        "local_test": True,
    },
    "products": {
        "title": "eStat 4.0",
        "endpoint": "/products",
        "collection": "products",
        "entity": "product",
    },
    "users": {
        "title": "SIAT API",
        "endpoint": "/users",
        "collection": "users",
        "entity": "user",
    },
    "carts": {
        "title": "Planshet Survey",
        "endpoint": "/carts",
        "collection": "carts",
        "entity": "cart",
    },
    "posts": {
        "title": "Excel / CSV",
        "endpoint": "/posts",
        "collection": "posts",
        "entity": "post",
    },
    "todos": {
        "title": "Batch Import",
        "endpoint": "/todos",
        "collection": "todos",
        "entity": "todo",
    },
    "quotes": {
        "title": "Imputatsiya tizimi",
        "endpoint": "/quotes",
        "collection": "quotes",
        "entity": "quote",
    },
}


def get_source(source_id: str) -> dict:
    if source_id not in SOURCES:
        raise KeyError(f"Unknown source: {source_id}")
    return SOURCES[source_id]
