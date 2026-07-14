import argparse
import time
from typing import Any

import requests


class NiFiClient:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")

    def get_root_id(self) -> str:
        data = self.get("/nifi-api/flow/process-groups/root")
        return data["processGroupFlow"]["id"]

    def create_process_group(self, parent_id: str, name: str) -> str:
        body = {
            "revision": {"version": 0},
            "component": {"name": name, "position": {"x": 250.0, "y": 120.0}},
        }
        data = self.post(f"/nifi-api/process-groups/{parent_id}/process-groups", body)
        return data["component"]["id"]

    def create_processor(self, group_id: str, name: str, processor_type: str, x: float, y: float, properties: dict[str, Any] | None = None) -> str:
        body = {
            "revision": {"version": 0},
            "component": {
                "name": name,
                "type": processor_type,
                "position": {"x": x, "y": y},
                "config": {"properties": properties or {}},
            },
        }
        data = self.post(f"/nifi-api/process-groups/{group_id}/processors", body)
        return data["component"]["id"]

    def create_connection(self, group_id: str, source_id: str, destination_id: str, relationships: list[str]) -> str:
        body = {
            "revision": {"version": 0},
            "component": {
                "source": {"id": source_id, "groupId": group_id, "type": "PROCESSOR"},
                "destination": {"id": destination_id, "groupId": group_id, "type": "PROCESSOR"},
                "selectedRelationships": relationships,
                "flowFileExpiration": "0 sec",
                "backPressureDataSizeThreshold": "1 GB",
                "backPressureObjectThreshold": 10000,
            },
        }
        data = self.post(f"/nifi-api/process-groups/{group_id}/connections", body)
        return data["component"]["id"]

    def get(self, path: str) -> dict:
        response = requests.get(f"{self.base_url}{path}", timeout=30)
        response.raise_for_status()
        return response.json()

    def post(self, path: str, body: dict) -> dict:
        response = requests.post(f"{self.base_url}{path}", json=body, timeout=30)
        response.raise_for_status()
        return response.json()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--nifi-url", default="http://localhost:8080")
    parser.add_argument("--dummyjson-url", default="https://dummyjson.com/products?limit=20")
    args = parser.parse_args()

    client = NiFiClient(args.nifi_url)
    root_id = client.get_root_id()
    group_id = client.create_process_group(root_id, "DummyJSON DWH Ingestion")
    time.sleep(1)

    invoke_http = client.create_processor(
        group_id,
        "Fetch DummyJSON Source",
        "org.apache.nifi.processors.standard.InvokeHTTP",
        120,
        120,
        {
            "HTTP Method": "GET",
            "Remote URL": args.dummyjson_url,
            "Connection Timeout": "30 sec",
            "Read Timeout": "30 sec",
        },
    )
    evaluate_json = client.create_processor(
        group_id,
        "Evaluate Source JSON",
        "org.apache.nifi.processors.standard.EvaluateJsonPath",
        440,
        120,
        {
            "Destination": "flowfile-attribute",
            "record.count": "$.total",
        },
    )
    put_file = client.create_processor(
        group_id,
        "Write Raw Landing File",
        "org.apache.nifi.processors.standard.PutFile",
        760,
        120,
        {
            "Directory": "/opt/nifi/nifi-current/landing",
            "Conflict Resolution Strategy": "replace",
        },
    )

    print(
        "Created NiFi flow skeleton: "
        f"group_id={group_id}, processors={[invoke_http, evaluate_json, put_file]}"
    )
    print("Open NiFi canvas and connect success relationships InvokeHTTP -> EvaluateJsonPath -> PutFile.")


if __name__ == "__main__":
    main()

