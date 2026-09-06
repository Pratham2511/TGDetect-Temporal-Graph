from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.routes import (
    health,
    overview,
    events,
    graph,
    chains,
    datasets,
    artifacts,
    model,
    analytics,
)

app = FastAPI(
    title="TGDetect API",
    description="Local API adapter for TGDetect temporal heterogeneous graph cybersecurity detection platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS strictly for local frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom exception handler for uniform error responses
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    code = "NOT_FOUND" if exc.status_code == 404 else "BAD_REQUEST" if exc.status_code == 400 else "ERROR"
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": code,
                "message": str(exc.detail)
            }
        },
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": str(exc)
            }
        },
    )

# Register routes under /api
api_prefix = "/api"
app.include_router(health.router)
app.include_router(health.router, prefix=api_prefix)
app.include_router(overview.router, prefix=api_prefix)
app.include_router(events.router, prefix=api_prefix)
app.include_router(graph.router, prefix=api_prefix)
app.include_router(chains.router, prefix=api_prefix)
app.include_router(datasets.router, prefix=api_prefix)
app.include_router(artifacts.router, prefix=api_prefix)
app.include_router(model.router, prefix=api_prefix)
app.include_router(analytics.router, prefix=api_prefix)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api.main:app", host="127.0.0.1", port=8000, reload=True)
