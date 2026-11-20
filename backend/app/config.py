"""
GROUNDSHIFT System Configuration Module.
Loads environment variables, defines resource limits, and configures runtime parameters.
"""

from pathlib import Path
import os
from typing import List
from dotenv import load_dotenv

# Base directory of the repository
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# Load .env file from repository root or current directory
env_path = BASE_DIR / ".env"
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()


class Settings:
    PROJECT_NAME: str = "GROUNDSHIFT"
    PROJECT_DESCRIPTION: str = "Multi-Mission SAR Validation and Earth Surface Change Intelligence Platform"
    VERSION: str = "1.0.0-foundation"
    ENVIRONMENT: str = os.getenv("GROUNDSHIFT_ENV", "development")

    # Network
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]

    # Memory Safety Constraints (Profiled for 16 GB Physical RAM on Windows 11)
    MAX_MEMORY_THRESHOLD_MB: int = int(os.getenv("MAX_MEMORY_THRESHOLD_MB", "6144"))
    MIN_FREE_MEMORY_MB: int = int(os.getenv("MIN_FREE_MEMORY_MB", "2560"))

    # Storage Paths
    DATA_RAW_DIR: Path = Path(os.getenv("DATA_RAW_DIR", str(BASE_DIR / "data" / "raw")))
    DATA_PROCESSED_DIR: Path = Path(os.getenv("DATA_PROCESSED_DIR", str(BASE_DIR / "data" / "processed")))
    DATA_METADATA_DIR: Path = Path(os.getenv("DATA_METADATA_DIR", str(BASE_DIR / "data" / "metadata")))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()


settings = Settings()

