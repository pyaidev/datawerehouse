import argparse
import json
import os
from datetime import datetime, UTC
from uuid import uuid4

import requests
from kafka import KafkaProducer

SOURCES = {
    "products": ("/products", "products"),
    "users": ("/users", "users"),
    "carts": ("/carts", "carts"),
    "posts": ("/posts", "posts"),
    "todos": ("/todos", "todos"),
    "quotes": ("/quotes", "quotes"),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default="products", choices=SOURCES.keys())
    parser.add_argument("--limit", type=int, default=20)
    parser.add_argument("--topic", default=os.getenv("KAFKA_TOPIC", "dwh.ingestion.events"))
    parser.add_argument("--bootstrap", default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--base-url", default=os.getenv("DUMMYJSON_BASE_URL", "https://dummyjson.com"))
    args = parser.parse_args()

    endpoint, collection = SOURCES[args.source]
    response = requests.get(f"{args.base_url}{endpoint}", params={"limit": args.limit}, timeout=30)
    response.raise_for_status()
    payload = response.json()
    rows = payload.get(collection, payload if isinstance(payload, list) else [])
    run_id = str(uuid4())

    producer = KafkaProducer(
        bootstrap_servers=args.bootstrap.split(","),
        key_serializer=lambda value: str(value).encode("utf-8"),
        value_serializer=lambda value: json.dumps(value, ensure_ascii=False, default=str).encode("utf-8"),
        acks="all",
        retries=3,
    )

    for row in rows:
        event = {
            "run_id": run_id,
            "source": args.source,
            "event_time": datetime.now(UTC).isoformat(),
            "payload": row,
        }
        producer.send(args.topic, key=row.get("id", run_id), value=event)

    producer.flush()
    print(f"Produced {len(rows)} events to {args.topic}; run_id={run_id}")


if __name__ == "__main__":
    main()
