import os
import logging
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Float, JSON, DateTime
from sqlalchemy.orm import sessionmaker, declarative_base

logger = logging.getLogger("database")
logger.setLevel(logging.INFO)

# Load environment variables from .env manually to avoid extra dependencies
if os.path.exists(".env"):
    try:
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                if stripped and not stripped.startswith("#"):
                    parts = stripped.split("=", 1)
                    if len(parts) == 2:
                        os.environ[parts[0].strip()] = parts[1].strip()
        logger.info("Loaded database environment configuration from .env")
    except Exception as e:
        logger.warning(f"Could not read .env file: {e}")

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    logger.error("DATABASE_URL environment variable is missing!")
    # Fallback to local SQLite for safety so the server doesn't crash
    DATABASE_URL = "sqlite:///./haptic_studio.db"

# Create Database Engine
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# SQLAlchemy Database Models
class Preset(Base):
    __tablename__ = "presets"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    duration = Column(Float, nullable=False)
    low_track = Column(JSON, nullable=False)
    high_track = Column(JSON, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Setting(Base):
    __tablename__ = "settings"
    
    key = Column(String, primary_key=True, index=True) # e.g. "theme_config"
    value = Column(JSON, nullable=False)

def init_db():
    """Initializes tables in the Neon PostgreSQL database if they do not exist."""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database initialized successfully: tables verified.")
    except Exception as e:
        logger.error(f"Error initializing database: {e}")

def get_db():
    """Dependency for acquiring local database sessions."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
