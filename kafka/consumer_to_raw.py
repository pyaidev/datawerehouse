import argparse
import json
import os
from pathlib import Path

from kafka import KafkaConsumer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", default=os.getenv("KAFKA_TOPIC", "dwh.ingestion.events"))
    parser.add_argument("--bootstrap", default=os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092"))
    parser.add_argument("--group-id", default="dwh-raw-writer")
    parser.add_argument("--output-dir", default="data/kafka_raw")
    args = parser.parse_args()

    consumer = KafkaConsumer(
        args.topic,
        bootstrap_servers=args.bootstrap.split(","),
        group_id=args.group_id,
        auto_offset_reset="earliest",
        enable_auto_commit=True,
        value_deserializer=lambda value: json.loads(value.decode("utf-8")),
    )

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    print(f"Consuming {args.topic}; writing JSONL to {output_dir}")

    for message in consumer:
        event = message.value
        source = event.get("source", "unknown")
        run_id = event.get("run_id", "no_run")
        target = output_dir / source / f"{run_id}.jsonl"
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(event, ensure_ascii=False) + "\n")
        print(f"offset={message.offset} -> {target}")


if __name__ == "__main__":
    main()
