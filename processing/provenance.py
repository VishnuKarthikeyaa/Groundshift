"""
GROUNDSHIFT Cryptographic Lineage & STAC Provenance Module.
Generates SHA-256 hashes and verifiable provenance metadata documents.
"""

import hashlib
import json
import datetime
from pathlib import Path
from typing import Dict, Any, List

def calculate_sha256(file_path: Path) -> str:
    """Computes SHA-256 cryptographic hash of a local file."""
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def create_provenance_manifest(
    asset_id: str,
    classification: str,
    algorithm_name: str,
    algorithm_version: str,
    parameters: Dict[str, Any],
    source_datasets: List[Dict[str, str]]
) -> Dict[str, Any]:
    """
    Creates an immutable, reproducible JSON-LD provenance manifest.
    Ensures classification is one of:
      - OBSERVABLE_MEASURED
      - ESTIMATE_DERIVED
      - BENCHMARK_SYNTHETIC
    """
    valid_classes = {"OBSERVABLE_MEASURED", "ESTIMATE_DERIVED", "BENCHMARK_SYNTHETIC"}
    if classification not in valid_classes:
        raise ValueError(f"Invalid classification '{classification}'. Must be one of {valid_classes}")

    return {
        "@context": "https://groundshift.earth/context/v1.jsonld",
        "id": asset_id,
        "type": "ProvenanceRecord",
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "classification": classification,
        "algorithm": {
            "name": algorithm_name,
            "version": algorithm_version,
            "parameters": parameters,
        },
        "sources": source_datasets,
        "environment": {
            "platform": "GROUNDSHIFT-Win11",
            "runtime": "Python 3.11",
        }
    }

