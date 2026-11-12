"""Tokenizer orchestration, span alignment, statistics, and pedagogical traces."""

import re
from collections import Counter
from functools import lru_cache

from hazm import Normalizer, SentenceTokenizer, WordTokenizer

from .bpe import DEFAULT_CORPUS, DISPLAY_TOKENS, encode_bpe, train_bpe
from .schemas import AnalyzeRequest, AnalysisResponse, Stats, Token, TraceStep, VocabularyEntry


@lru_cache(maxsize=1)
def get_normalizer() -> Normalizer:
    return Normalizer()


@lru_cache(maxsize=2)
def get_word_tokenizer(join: bool) -> WordTokenizer:
    return WordTokenizer(join_verb_parts=join)


def align_literal_tokens(text: str, values: list[str]) -> list[tuple[int, int]]:
    """Align unchanged Hazm word surfaces monotonically into the input."""
    cursor = 0
    spans: list[tuple[int, int]] = []
    for value in values:
        # SentenceTokenizer replaces internal newlines with spaces. Looking for
        # a later exact copy first would skip the correct earlier sentence.
        exact_start = text.find(value, cursor)
        pattern = r"\s+".join(re.escape(part) for part in re.split(r"\s+", value))
        match = re.search(pattern, text[cursor:])
        if exact_start >= 0 and (match is None or exact_start <= cursor + match.start()):
            start, end = exact_start, exact_start + len(value)
        elif match is not None:
            start, end = cursor + match.start(), cursor + match.end()
        else:
            raise RuntimeError("امکان هم‌ترازسازی خروجی Hazm با متن پردازش‌شده وجود ندارد.")
        spans.append((start, end))
        cursor = end
    return spans


def align_joined_tokens(
    values: list[str], basal: list[str], spans: list[tuple[int, int]]
) -> list[tuple[int, int]]:
    """Use the unjoined token stream, preserving literal underscores and spans."""
    result: list[tuple[int, int]] = []
    cursor = 0
    for value in values:
        candidate = ""
        for end_index in range(cursor, len(basal)):
            candidate = basal[end_index] if end_index == cursor else candidate + "_" + basal[end_index]
            if candidate == value:
                result.append((spans[cursor][0], spans[end_index][1]))
                cursor = end_index + 1
                break
            if not value.startswith(candidate):
                raise RuntimeError("اجزای فعل Hazm با جریان توکن‌های پایه مطابقت ندارد.")
        else:
            raise RuntimeError("توکن متصل‌شدهٔ Hazm بدون اجزای پایه است.")
    if cursor != len(basal):
        raise RuntimeError("همهٔ توکن‌های پایهٔ Hazm مصرف نشده‌اند.")
    return result


def make_tokens(values: list[str], spans: list[tuple[int, int]]) -> list[Token]:
    return [
        Token(text=value, index=index, start=span[0], end=span[1])
        for index, (value, span) in enumerate(zip(values, spans, strict=True))
    ]


def simple_scan(text: str, tokenizer: str, include_whitespace: bool) -> tuple[list[Token], list[TraceStep]]:
    if tokenizer == "whitespace":
        tokens = [
            Token(text=match.group(), index=index, start=match.start(), end=match.end())
            for index, match in enumerate(re.finditer(r"\S+", text))
        ]
        explanation = "تا رسیدن به فاصله، تب یا خط جدید، نویسه‌ها در یک توکن جمع شدند؛ نیم‌فاصله جداکننده نیست."
    else:
        tokens = [
            Token(text=char, index=0, start=index, end=index + 1)
            for index, char in enumerate(text) if include_whitespace or not char.isspace()
        ]
        for index, token in enumerate(tokens):
            token.index = index
        explanation = (
            "یک کدپوینت یونیکد خوانده شد. کدپوینت با نویسهٔ دیداری یا بایت یکسان نیست؛ نیم‌فاصله نیز یک کدپوینت است. "
            + ("فاصله‌ها هم شمرده می‌شوند." if include_whitespace else "فاصله، تب و خط جدید از شمارش کنار گذاشته می‌شوند.")
        )
    steps = [
        TraceStep(
            id=index,
            phase="split",
            title=f"جداسازی · توکن {index + 1}",
            description=f"{explanation} بازهٔ این توکن در متن پردازش‌شده [{token.start}, {token.end}) است.",
            tokens=[value.text for value in tokens[: index + 1]],
            focus_indices=[index],
        )
        for index, token in enumerate(tokens[:24])
    ]
    return tokens, steps


def hazm_tokens(text: str, tokenizer: str, join: bool) -> tuple[list[Token], list[TraceStep]]:
    if tokenizer == "hazm_sentence":
        values = SentenceTokenizer().tokenize(text)
        spans = align_literal_tokens(text, values)
        steps = [TraceStep(
            id=0,
            phase="split",
            title="Hazm · مرزبندی جمله‌ها",
            description=(
                "این خروجی واقعی SentenceTokenizer در Hazm است. هر جمله یک توکن محسوب می‌شود؛ "
                "تعداد این توکن‌ها با تعداد واژه‌ها قابل جایگزینی نیست. در این نسخه فقط ورودی و خروجی فراخوانی کتابخانه رهگیری می‌شود."
            ),
            tokens=values[:DISPLAY_TOKENS],
        )]
    else:
        basal = get_word_tokenizer(False).tokenize(text)
        basal_spans = align_literal_tokens(text, basal)
        steps = [TraceStep(
            id=0,
            phase="split",
            title="Hazm · جداسازی واژه‌ها و علائم",
            description=(
                "این خروجی واقعی WordTokenizer با اتصال اجزای فعل خاموش است. علائم طبق قواعد Hazm جدا شده‌اند؛ "
                "برای مراحل داخلی این فراخوانی، رد تصمیم ساختگی تولید نمی‌شود."
            ),
            tokens=basal[:DISPLAY_TOKENS],
        )]
        if join:
            values = get_word_tokenizer(True).join_verb_parts(basal)
            spans = align_joined_tokens(values, basal, basal_spans)
            steps.append(TraceStep(
                id=1,
                phase="join",
                title="Hazm · اتصال اجزای فعل",
                description=(
                    "متد واقعی join_verb_parts روی توکن‌های مرحلهٔ قبل اجرا شد. "
                    "بعضی فعل‌های چندبخشی با زیرخط متصل می‌شوند؛ بازهٔ آن‌ها فاصله‌های متن را هم در بر می‌گیرد."
                ),
                tokens=values[:DISPLAY_TOKENS],
                focus_indices=[i for i, value in enumerate(values[:DISPLAY_TOKENS]) if "_" in value],
            ))
        else:
            values, spans = basal, basal_spans
    return make_tokens(values, spans), steps


def analyze(request: AnalyzeRequest) -> AnalysisResponse:
    original = request.text
    processed = get_normalizer().normalize(original) if request.normalize else original
    if not processed.strip():
        raise ValueError("پس از نرمال‌سازی، متن قابل توکن‌سازی باقی نماند.")
    steps = [TraceStep(
        id=0,
        phase="input",
        title="متن ورودی",
        description="متن اصلی بدون تغییر ثبت شد. موقعیت توکن‌های نهایی بر اساس متن پردازش‌شده گزارش خواهد شد.",
        tokens=[original],
    )]
    steps.append(TraceStep(
        id=1,
        phase="normalization",
        title="نرمال‌سازی فارسی" if request.normalize else "عبور بدون نرمال‌سازی",
        description=(
            "متن با Normalizer واقعی Hazm نرمال شد؛ تفاوت حروف، اعراب، فاصله‌گذاری و اعداد ممکن است اصلاح شود. "
            "این نمای فراخوانی کتابخانه است، نه رهگیری تصمیم‌های داخلی آن."
            if request.normalize else "نرمال‌سازی خاموش است؛ متن اصلی مستقیماً وارد توکنایزر می‌شود."
        ),
        tokens=[processed],
    ))
    warnings = ["موقعیت‌ها بازهٔ نیمه‌باز [شروع، پایان) در متن پردازش‌شده و بر حسب کدپوینت یونیکد هستند."]
    model = None
    if request.tokenizer == "bpe":
        if request.mode == "train":
            corpus = DEFAULT_CORPUS if request.corpus is None else request.corpus
            corpus = get_normalizer().normalize(corpus) if request.normalize else corpus
            model, training_steps = train_bpe(corpus, request.max_merges, request.normalize)
            steps.extend(training_steps)
            if request.corpus is None:
                warnings.append("برای آموزش از پیکرهٔ کوچک نمونه استفاده شد؛ متن ورودی جداگانه با مدل حاصل توکن‌سازی می‌شود.")
        else:
            model = request.bpe_model
            assert model is not None  # Guaranteed by request validation.
        tokens, encoding_steps = encode_bpe(processed, model)
        steps.extend(encoding_steps)
        warnings.append("این BPE آموزشی در سطح نویسه است؛ مرز واژه بر اساس فاصله است و با BPE بایتی یکسان نیست.")
        if request.normalize:
            warnings.append("پیکره و متن ورودی با تنظیم یکسان Hazm نرمال‌سازی می‌شوند؛ این تنظیم در مدل ذخیره می‌شود.")
    elif request.tokenizer.startswith("hazm_"):
        tokens, hazm_steps = hazm_tokens(processed, request.tokenizer, request.join_verb_parts)
        steps.extend(hazm_steps)
        warnings.append("در مراحل Hazm، ورودی و خروجی متدهای واقعی نمایش داده می‌شود؛ تصمیم‌های داخلی کتابخانه در این نسخه رهگیری نمی‌شود.")
    else:
        tokens, scan_steps = simple_scan(processed, request.tokenizer, request.include_whitespace)
        steps.extend(scan_steps)
        if len(tokens) > 24:
            warnings.append("نمایش اسکن به ۲۴ خروجی اول محدود است؛ آمار و جدول نهایی همهٔ توکن‌ها را در بر می‌گیرد.")
    if any(len(step.tokens) >= DISPLAY_TOKENS for step in steps) or request.tokenizer == "bpe":
        warnings.append("برای خوانایی، هر تصویر حداکثر ۱۲۰ توکن، ۱۲ واژهٔ پیکره و ۲۰ جفت نامزد نشان می‌دهد؛ محاسبات کامل است.")
    counts = Counter(token.text for token in tokens)
    ids = {value: index for index, value in enumerate(model.vocabulary)} if model else {}
    vocabulary = [
        VocabularyEntry(token=value, count=count, id=ids.get(value))
        for value, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]
    total = len(tokens)
    stats = Stats(
        token_count=total,
        type_count=len(counts),
        ttr=len(counts) / total if total else 0,
        model_vocab_size=len(model.vocabulary) if model else None,
        unknown_count=sum(token.id == 0 for token in tokens) if model else 0,
    )
    steps.append(TraceStep(
        id=len(steps),
        phase="result",
        title="نتیجه · توکن‌ها و انواع یکتا",
        description=(
            f"متن به {total} رخداد توکن و {len(counts)} نوع یکتا تبدیل شد. "
            "انواع مشاهده‌شدهٔ متن با کل واژگان مدل یکسان نیستند. شناسه برای روش‌های بدون مدل تعریف نشده است."
        ),
        tokens=[token.text for token in tokens[:DISPLAY_TOKENS]],
        vocabulary_size=len(model.vocabulary) if model else None,
    ))
    for index, step in enumerate(steps):
        step.id = index
    return AnalysisResponse(
        tokenizer=request.tokenizer,
        mode=request.mode,
        original_text=original,
        normalized_text=processed,
        processed_text=processed,
        tokens=tokens,
        vocabulary=vocabulary,
        stats=stats,
        steps=steps,
        bpe_model=model,
        warnings=warnings,
    )

