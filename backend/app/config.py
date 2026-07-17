from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


def database_url() -> str:
    configured = os.getenv("BULLYX_DATABASE_URL", "").strip() or os.getenv("CORTEX_DATABASE_URL", "").strip()
    if configured:
        return configured
    data_dir = PROJECT_ROOT / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    preferred = data_dir / "bullyx.db"
    legacy = data_dir / "cortex.db"
    database = legacy if legacy.exists() and not preferred.exists() else preferred
    return f"sqlite:///{database.as_posix()}"


def cors_origins() -> list[str]:
    raw = (
        os.getenv("BULLYX_CORS_ORIGINS", "").strip()
        or os.getenv("CORTEX_CORS_ORIGINS", "").strip()
        or "http://127.0.0.1:5173,http://localhost:5173"
    )
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
