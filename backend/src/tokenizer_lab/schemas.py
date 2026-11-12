"""Public API models and input limits."""

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

TokenizerName = Literal["whitespace", "character", "hazm_word", "hazm_sentence", "bpe"]
UNKNOWN = "[UNK]"
ModelPiece = Annotated[str, StringConstraints(min_length=1, max_length=10000)]
BaseSymbol = Annotated[str, StringConstraints(min_length=1, max_length=1)]


class ApiModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class BpeModel(ApiModel):
    version: Literal[1] = 1
    kind: Literal["character-bpe"] = "character-bpe"
    normalization: bool
    base_symbols: list[BaseSymbol] = Field(max_length=1000)
    merges: list[tuple[ModelPiece, ModelPiece]] = Field(max_length=40)
    vocabulary: list[ModelPiece] = Field(max_length=1041)

    @model_validator(mode="after")
    def validate_structure(self) -> "BpeModel":
        symbols = self.base_symbols
        if symbols != sorted(set(symbols)):
            raise ValueError("نویسه‌های پایه باید یکتا و به ترتیب یونیکد باشند.")
        if any(len(symbol) != 1 or symbol.isspace() for symbol in symbols):
            raise ValueError("هر نماد پایه باید یک کدپوینت غیر از فاصله باشد.")
        known = set(symbols) | {UNKNOWN}
        expected = [UNKNOWN, *symbols]
        seen_pairs: set[tuple[str, str]] = set()
        for left, right in self.merges:
            if (left, right) in seen_pairs or left not in known or right not in known:
                raise ValueError("ترتیب یا اجزای ادغام‌های مدل معتبر نیست.")
            if UNKNOWN in (left, right) or left + right == UNKNOWN:
                raise ValueError("توکن ناشناخته نمی‌تواند در ادغام شرکت کند.")
            if len(left) + len(right) > 10000:
                raise ValueError("طول قطعهٔ مدل بیش از حد مجاز است.")
            seen_pairs.add((left, right))
            combined = left + right
            if combined not in known:
                expected.append(combined)
                known.add(combined)
        if self.vocabulary != expected:
            raise ValueError("واژگان مدل با نمادهای پایه و تاریخچهٔ ادغام تطابق ندارد.")
        return self


class AnalyzeRequest(ApiModel):
    text: str = Field(min_length=1, max_length=10000)
    tokenizer: TokenizerName = "hazm_word"
    normalize: bool = True
    join_verb_parts: bool = True
    include_whitespace: bool = False
    mode: Literal["train", "encode"] = "train"
    corpus: str | None = Field(default=None, max_length=30000)
    max_merges: int = Field(default=12, ge=0, le=40)
    bpe_model: BpeModel | None = None

    @field_validator("text")
    @classmethod
    def meaningful_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("متن باید دست‌کم یک نویسهٔ غیر از فاصله داشته باشد.")
        return value

    @model_validator(mode="after")
    def require_model(self) -> "AnalyzeRequest":
        if self.tokenizer == "bpe" and self.mode == "encode":
            if self.bpe_model is None:
                raise ValueError("برای اجرای BPE ابتدا یک مدل آموزش دهید یا بارگذاری کنید.")
            if self.bpe_model.normalization != self.normalize:
                raise ValueError("تنظیم نرمال‌سازی باید با مدل آموزش‌دیده یکسان باشد.")
        return self


class CompareRequest(ApiModel):
    text: str = Field(min_length=1, max_length=10000)
    normalize: bool = True
    join_verb_parts: bool = True
    include_whitespace: bool = False

    @field_validator("text")
    @classmethod
    def meaningful_text(cls, value: str) -> str:
        return AnalyzeRequest.meaningful_text(value)


class Token(ApiModel):
    text: str
    index: int
    id: int | None = None
    start: int
    end: int


class VocabularyEntry(ApiModel):
    token: str
    count: int
    id: int | None = None


class Stats(ApiModel):
    token_count: int
    type_count: int
    ttr: float
    model_vocab_size: int | None = None
    unknown_count: int = 0


class PairCount(ApiModel):
    left: str
    right: str
    count: int


class SelectedPair(ApiModel):
    left: str
    right: str


class CorpusWord(ApiModel):
    word: str
    pieces: list[str]
    count: int


class TraceStep(ApiModel):
    id: int
    phase: str
    title: str
    description: str
    tokens: list[str]
    focus_indices: list[int] = Field(default_factory=list)
    pairs: list[PairCount] | None = None
    selected_pair: SelectedPair | None = None
    vocabulary_size: int | None = None
    corpus_preview: list[CorpusWord] | None = None


class AnalysisResponse(ApiModel):
    tokenizer: TokenizerName
    mode: Literal["train", "encode"]
    original_text: str
    normalized_text: str
    processed_text: str
    tokens: list[Token]
    vocabulary: list[VocabularyEntry]
    stats: Stats
    steps: list[TraceStep]
    bpe_model: BpeModel | None = None
    warnings: list[str] = Field(default_factory=list)


class CompareResponse(ApiModel):
    results: list[AnalysisResponse]

