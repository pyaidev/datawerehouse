import json
from typing import Any

from kafka import KafkaProducer
from kafka.errors import KafkaError

from .config import Settings


class EventBus:
    def __init__(self, settings: Settings):
        self.settings = settings
        self._producer: KafkaProducer | None = None

    def publish(self, topic: str, event: dict[str, Any]) -> str:
        try:
            producer = self._get_producer()
            future = producer.send(topic, event)
            metadata = future.get(timeout=10)
            producer.flush(timeout=10)
            return f"kafka://{metadata.topic}/{metadata.partition}/{metadata.offset}"
        except KafkaError as exc:
            if self.settings.strict_external_services:
                raise
            return f"kafka-fallback://{topic}?reason={type(exc).__name__}"

    def _get_producer(self) -> KafkaProducer:
        if self._producer is None:
            self._producer = KafkaProducer(
                bootstrap_servers=self.settings.kafka_bootstrap_servers.split(","),
                value_serializer=lambda value: json.dumps(value, default=str).encode("utf-8"),
                key_serializer=lambda value: str(value).encode("utf-8"),
                linger_ms=20,
                retries=3,
            )
        return self._producer
