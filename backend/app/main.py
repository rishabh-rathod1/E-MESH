"""
E-Mesh Emergency Mesh — FastAPI Application Entry Point

Self-Healing Mesh Communication Network for Disaster Response and Emergency Connectivity

Phase 1: Backend foundation — authentication, RBAC, models, and core APIs.
"""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.exceptions import EMeshException, emesh_exception_handler
from app.db.init_db import init_db
from app.routers import (
    analytics,
    announcements,
    audit_logs,
    auth,
    community,
    health,
    incidents,
    location,
    nodes,
    resources,
    responders,
    simulation,
    sos,
    users,
    websocket,
    mesh_hardware,
    research,
)

settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


# ── Application lifespan ──────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup and shutdown tasks."""
    logger.info("E-Mesh starting up — initializing database...")
    await init_db()

    # Launch background task to mark stale nodes as OFFLINE
    from app.tasks.node_monitor import node_staleness_monitor
    monitor_task = asyncio.create_task(node_staleness_monitor())

    logger.info("E-Mesh ready. API running at %s:%s", settings.HOST, settings.PORT)
    yield
    monitor_task.cancel()
    logger.info("E-Mesh shutting down.")


# ── Application factory ───────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.APP_NAME,
        description=(
            "**E-Mesh Emergency Mesh** — Emergency communication and response platform.\n\n"
            "**Academic Title**: Self-Healing Mesh Communication Network for Disaster Response "
            "and Emergency Connectivity\n\n"
            "Phase 1: Backend foundation (authentication, RBAC, incident management, node management).\n\n"
            "> ⚠️ **SIMULATION MODE**: The current mesh network is a software simulation. "
            "No actual ESP32/ESP-NOW hardware is connected."
        ),
        version=settings.APP_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"^https?://.*",
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Exception handlers ────────────────────────────────────────────────
    app.add_exception_handler(EMeshException, emesh_exception_handler)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"success": False, "message": "An unexpected error occurred."},
        )

    # ── Pure ASGI Automatic Decompression Middleware ─────────────────────────
    class DecompressionASGIMiddleware:
        def __init__(self, app):
            self.app = app

        async def __call__(self, scope, receive, send):
            if scope["type"] != "http":
                return await self.app(scope, receive, send)

            path = scope.get("path", "")
            if "/auth" in path or "/client" in path or "/docs" in path or "/openapi.json" in path:
                return await self.app(scope, receive, send)

            headers = dict(scope.get("headers", []))
            comp_header = headers.get(b"x-emesh-compression", b"").decode("latin-1").lower()
            encoding = headers.get(b"content-encoding", b"").decode("latin-1").lower()
            method_hint = comp_header or encoding

            if method_hint in ("adec", "x-emesh-adec", "gzip", "sprintz", "chimp"):
                body_chunks = []
                more_body = True
                while more_body:
                    message = await receive()
                    if message["type"] == "http.request":
                        body_chunks.append(message.get("body", b""))
                        more_body = message.get("more_body", False)
                    elif message["type"] == "http.disconnect":
                        return

                raw_body = b"".join(body_chunks)
                if raw_body:
                    from app.core.compression import CompressionSuite
                    from app.routers.research import ResearchState

                    try:
                        decomp_str = CompressionSuite.decompress_any(raw_body, method=method_hint)
                        decomp_bytes = decomp_str.encode("utf-8")

                        ResearchState.record_transmission(
                            raw_size=len(decomp_bytes),
                            comp_size=len(raw_body),
                            method=method_hint,
                        )

                        # Update Content-Length header in scope
                        new_headers = []
                        for k, v in scope.get("headers", []):
                            if k.lower() == b"content-length":
                                new_headers.append((b"content-length", str(len(decomp_bytes)).encode("latin-1")))
                            elif k.lower() in (b"x-emesh-compression", b"content-encoding"):
                                continue  # Strip compression headers after successful decompression
                            else:
                                new_headers.append((k, v))
                        scope["headers"] = new_headers

                        body_sent = False

                        async def custom_receive():
                            nonlocal body_sent
                            if not body_sent:
                                body_sent = True
                                return {
                                    "type": "http.request",
                                    "body": decomp_bytes,
                                    "more_body": False,
                                }
                            return {"type": "http.disconnect"}

                        return await self.app(scope, custom_receive, send)
                    except Exception as exc:
                        logger.warning("Failed to decompress incoming request (%s): %s", method_hint, exc)

            return await self.app(scope, receive, send)

    app.add_middleware(DecompressionASGIMiddleware)


    # ── Routers ───────────────────────────────────────────────────────────
    prefix = settings.API_PREFIX
    app.include_router(health.router, prefix=prefix)
    app.include_router(auth.router, prefix=prefix)
    app.include_router(users.router, prefix=prefix)
    app.include_router(nodes.router, prefix=prefix)
    app.include_router(incidents.router, prefix=prefix)
    app.include_router(sos.router, prefix=prefix)
    app.include_router(announcements.router, prefix=prefix)
    app.include_router(resources.router, prefix=prefix)
    app.include_router(responders.router, prefix=prefix)
    app.include_router(analytics.router, prefix=prefix)
    app.include_router(audit_logs.router, prefix=prefix)
    app.include_router(community.router, prefix=prefix)
    app.include_router(location.router, prefix=prefix)
    app.include_router(simulation.router, prefix=prefix)
    app.include_router(mesh_hardware.router, prefix=prefix)
    app.include_router(mesh_hardware.router)  # alias /mesh at root level as well
    app.include_router(research.router, prefix=prefix)
    app.include_router(websocket.router, prefix=prefix)
    app.include_router(websocket.router)  # also alias /ws at root level

    # Mount the client directory to serve the frontend portal
    from pathlib import Path
    from fastapi.staticfiles import StaticFiles
    from fastapi.responses import RedirectResponse

    candidate_client_dirs = [
        Path(__file__).resolve().parent.parent.parent / "client",
        Path.cwd() / "client",
        Path.cwd() / ".." / "client",
    ]
    client_dir = next((p for p in candidate_client_dirs if p.exists() and (p / "index.html").exists()), None)

    if client_dir:
        logger.info("Mounting civilian client portal from: %s", client_dir)
        app.mount("/client", StaticFiles(directory=str(client_dir), html=True), name="client")

        @app.get("/client", include_in_schema=False)
        async def client_redirect():
            return RedirectResponse(url="/client/")
    else:
        logger.warning("Civilian client directory not found; /client not mounted.")

    # ── Root endpoint ─────────────────────────────────────────────────────
    @app.get("/", tags=["Root"], include_in_schema=False)
    async def root():
        return {
            "service": settings.APP_NAME,
            "version": settings.APP_VERSION,
            "status": "operational",
            "mode": "SIMULATION — No physical mesh hardware connected",
            "docs": "/docs",
        }

    return app


app = create_app()
