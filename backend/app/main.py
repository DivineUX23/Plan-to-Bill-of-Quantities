"""FastAPI application entrypoint for PlanToBOQ API."""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.boq import router as boq_router
from .api.projects import router as projects_router
from .api.sheets import router as sheets_router
from .config import get_settings
from .db import Base, engine


Base.metadata.create_all(bind=engine)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version="1.0.0",
    description="PlanToBOQ Taking-off Engine API for architectural floor plans and BESMM4 bills of quantities.",
    lifespan=lifespan,
)

# CORS
origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if "*" not in origins else ["*"],
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects_router)
app.include_router(sheets_router)
app.include_router(boq_router)


@app.get("/health", tags=["health"])
def health_check():
    return {
        "status": "healthy",
        "app": settings.app_name,
        "environment": settings.environment,
        "ai_vision_enabled": settings.ai_vision_enabled,
    }
