from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./phishguard.db"
    SECRET_KEY: str = "changeme-in-production-use-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours
    CORS_ORIGINS: list = ["http://localhost:5173", "http://localhost:3000", "http://localhost:80", "http://127.0.0.1:5173"]

    class Config:
        env_file = ".env"

settings = Settings()
