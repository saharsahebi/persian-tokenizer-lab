"""FastAPI entrypoint; all processing stays on the user's machine."""

from importlib.metadata import version

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import __version__
from .schemas import AnalyzeRequest, AnalysisResponse, CompareRequest, CompareResponse
from .service import analyze

app = FastAPI(
    title="Persian Tokenizer Lab",
    description="آزمایشگاه آموزشی توکن‌سازی فارسی با Hazm و BPE قابل رهگیری",
    version=__version__,
)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(?:localhost|127\.0\.0\.1)(?::\d+)?",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {"field": ".".join(str(value) for value in error["loc"]), "message": error["msg"]}
        for error in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": "ورودی معتبر نیست؛ متن، محدودیت اندازه و تنظیمات مدل را بررسی کنید.", "errors": errors},
    )


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": __version__, "hazm_version": version("hazm")}


@app.post("/api/analyze", response_model=AnalysisResponse)
def analyze_text(request: AnalyzeRequest) -> AnalysisResponse:
    try:
        return analyze(request)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@app.post("/api/compare", response_model=CompareResponse)
def compare_tokenizers(request: CompareRequest) -> CompareResponse:
    try:
        return CompareResponse(results=[
            analyze(AnalyzeRequest(**request.model_dump(), tokenizer=name))
            for name in ("whitespace", "character", "hazm_word", "hazm_sentence")
        ])
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

