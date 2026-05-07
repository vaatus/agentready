"""Settings — single source of truth for env access."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    public_base_url: str = "http://localhost:3000"
    api_base_url: str = "http://localhost:8000"

    postgres_url: str = "postgresql+asyncpg://agentready:agentready@localhost:5432/agentready"

    judge_llm_url: str = "http://localhost:8001/v1"
    judge_llm_model: str = "meta-llama/Llama-3.1-70B-Instruct"
    judge_llm_api_key: str = "EMPTY"

    red_llm_url: str = "http://localhost:8002/v1"
    red_llm_model: str = "Qwen/Qwen2.5-7B-Instruct"
    red_llm_api_key: str = "EMPTY"

    anthropic_api_key: str = ""

    github_token: str = ""
    github_demo_fork_owner: str = ""

    hf_token: str = ""
    hf_username: str = ""

    x402_facilitator_url: str = "https://x402.coinbase.com"
    x402_network: str = "base"
    x402_receiving_address: str = ""
    x402_private_key: str = ""

    mindsdb_url: str = "http://localhost:47334"
    mindsdb_user: str = "mindsdb"
    mindsdb_password: str = "mindsdb"

    quality_parallelism: int = 500
    asi_timeout_seconds: int = 120
    cache_dir: Path = Field(default=Path("./data/leaderboard_cache"))
    scan_profile: Literal["full", "demo", "stub"] = "demo"

    # stub = offline heuristic, huggingface = HF Inference Providers, vllm = MI300X.
    judge_mode: Literal["stub", "huggingface", "vllm"] = "stub"

    hf_inference_url: str = "https://router.huggingface.co/v1"
    hf_judge_model: str = "meta-llama/Llama-3.1-8B-Instruct"
    hf_red_model: str = "Qwen/Qwen2.5-7B-Instruct"

    @property
    def repo_root(self) -> Path:
        return Path(__file__).resolve().parents[3]

    @property
    def seed_agents_path(self) -> Path:
        return self.repo_root / "leaderboard" / "seed_agents.yaml"

    @property
    def has_judge_llm(self) -> bool:
        return self.judge_llm_url != "" and self.judge_llm_url != "http://localhost:8001/v1"

    @property
    def has_anthropic_fallback(self) -> bool:
        return bool(self.anthropic_api_key)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
