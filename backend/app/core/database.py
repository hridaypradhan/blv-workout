"""Async SQLAlchemy database stubs for the FitA11y backend."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

engine: AsyncEngine | None = None
AsyncSessionLocal: async_sessionmaker[AsyncSession] | None = None


def create_database_engine(database_url: str) -> AsyncEngine:
    """Create the async SQLAlchemy engine for the configured database URL."""
    raise NotImplementedError("TODO: implement")


def create_session_factory(database_engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    """Create an async SQLAlchemy session factory bound to the database engine."""
    raise NotImplementedError("TODO: implement")


async def get_database_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an async database session dependency for request handlers."""
    raise NotImplementedError("TODO: implement")
