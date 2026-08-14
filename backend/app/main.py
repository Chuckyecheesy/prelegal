from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import get_connection, reset_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    reset_db()
    yield


app = FastAPI(title="prelegal API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, str]:
    conn = get_connection()
    try:
        conn.execute("SELECT 1").fetchone()
    finally:
        conn.close()
    return {"status": "ok"}
