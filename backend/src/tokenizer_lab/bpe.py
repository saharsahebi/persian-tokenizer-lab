"""Deterministic character-level BPE with traces from the actual computation."""

import re
from collections import Counter
from dataclasses import dataclass

from .schemas import BpeModel, CorpusWord, PairCount, SelectedPair, Token, TraceStep, UNKNOWN

DISPLAY_TOKENS = 120
DISPLAY_PAIRS = 20
DISPLAY_WORDS = 12

DEFAULT_CORPUS = """من کتاب می‌خوانم و تو کتاب می‌خوانی.
کتاب خوب دوست خوب من است.
دانش‌آموز کتاب‌ها را می‌خواند و دانشجو کتاب را می‌خواند.
ما زبان فارسی را دوست داریم. یادگیری زبان فارسی زیبا است.
کتاب کتابخانه کتابدار کتاب‌ها کتاب من کتاب تو
آموزش یادگیری آموزگار دانش دانشگاه دانشجو دانش‌آموز
من می‌خوانم تو می‌خوانی او می‌خواند ما می‌خوانیم"""


@dataclass(frozen=True)
class Piece:
    text: str
    start: int
    end: int


def ordered_pairs(counts: Counter[tuple[str, str]]) -> list[tuple[tuple[str, str], int]]:
    """Frequency descending, then Unicode lexicographic ascending for ties."""
    return sorted(counts.items(), key=lambda item: (-item[1], item[0]))


def count_pairs(
    splits: dict[str, list[str]], frequencies: Counter[str]
) -> Counter[tuple[str, str]]:
    counts: Counter[tuple[str, str]] = Counter()
    for word, pieces in splits.items():
        for left, right in zip(pieces, pieces[1:]):
            if left + right != UNKNOWN:
                counts[(left, right)] += frequencies[word]
    return counts


def merge_symbols(pieces: list[str], pair: tuple[str, str]) -> list[str]:
    result: list[str] = []
    cursor = 0
    while cursor < len(pieces):
        if cursor + 1 < len(pieces) and (pieces[cursor], pieces[cursor + 1]) == pair:
            result.append(pair[0] + pair[1])
            cursor += 2
        else:
            result.append(pieces[cursor])
            cursor += 1
    return result


def preview(splits: dict[str, list[str]], frequencies: Counter[str]) -> list[CorpusWord]:
    return [
        CorpusWord(word=word, pieces=pieces[:DISPLAY_TOKENS], count=frequencies[word])
        for word, pieces in list(splits.items())[:DISPLAY_WORDS]
    ]


def flatten(splits: dict[str, list[str]]) -> list[str]:
    result: list[str] = []
    for pieces in splits.values():
        result.extend(pieces[: DISPLAY_TOKENS - len(result)])
        if len(result) >= DISPLAY_TOKENS:
            break
    return result


def train_bpe(corpus: str, max_merges: int, normalization: bool) -> tuple[BpeModel, list[TraceStep]]:
    frequencies: Counter[str] = Counter(re.findall(r"\S+", corpus))
    if not frequencies:
        raise ValueError("پیکرهٔ آموزش باید دست‌کم یک واژه داشته باشد.")
    symbols = sorted(set("".join(frequencies)))
    if len(symbols) > 1000:
        raise ValueError("برای این آزمایش آموزشی، الفبای پیکره حداکثر ۱۰۰۰ نویسه دارد.")
    splits = {word: list(word) for word in frequencies}
    vocabulary = [UNKNOWN, *symbols]
    merges: list[tuple[str, str]] = []
    steps = [
        TraceStep(
            id=0,
            phase="train",
            title="آموزش · ساخت الفبای پایه",
            description=(
                "پیکره بر اساس فاصله به واژه‌ها تقسیم شد و فراوانی هر واژه محاسبه شد. "
                "هر واژه اکنون دنباله‌ای از کدپوینت‌های یونیکد است؛ ادغام از مرز واژه عبور نمی‌کند."
            ),
            tokens=flatten(splits),
            vocabulary_size=len(vocabulary),
            corpus_preview=preview(splits, frequencies),
        )
    ]
    for number in range(max_merges):
        candidates = ordered_pairs(count_pairs(splits, frequencies))
        if not candidates:
            break
        pair, count = candidates[0]
        splits = {word: merge_symbols(pieces, pair) for word, pieces in splits.items()}
        merges.append(pair)
        combined = pair[0] + pair[1]
        if combined not in vocabulary:
            vocabulary.append(combined)
        display = flatten(splits)
        steps.append(
            TraceStep(
                id=len(steps),
                phase="train",
                title=f"آموزش · ادغام {number + 1}",
                description=(
                    f"جفت «{pair[0]}» و «{pair[1]}» با فراوانی وزنی {count} انتخاب و به «{combined}» تبدیل شد. "
                    "جدول جفت‌ها مربوط به پیش از این ادغام است. تساوی با ترتیب یونیکد حل می‌شود؛ "
                    "ادغام‌ها بدون همپوشانی، از ابتدای هر واژه اعمال می‌شوند."
                ),
                tokens=display,
                focus_indices=[i for i, value in enumerate(display) if value == combined],
                pairs=[PairCount(left=p[0], right=p[1], count=n) for p, n in candidates[:DISPLAY_PAIRS]],
                selected_pair=SelectedPair(left=pair[0], right=pair[1]),
                vocabulary_size=len(vocabulary),
                corpus_preview=preview(splits, frequencies),
            )
        )
    model = BpeModel(
        normalization=normalization,
        base_symbols=symbols,
        merges=merges,
        vocabulary=vocabulary,
    )
    return model, steps


def encode_bpe(text: str, model: BpeModel) -> tuple[list[Token], list[TraceStep]]:
    base = set(model.base_symbols)
    ranks = {pair: rank for rank, pair in enumerate(model.merges)}
    words: list[list[Piece]] = [
        [Piece(char if char in base else UNKNOWN, match.start() + i, match.start() + i + 1)
         for i, char in enumerate(match.group())]
        for match in re.finditer(r"\S+", text)
    ]

    def display_pieces() -> list[str]:
        return [piece.text for pieces in words for piece in pieces][:DISPLAY_TOKENS]

    steps = [
        TraceStep(
            id=0,
            phase="encode",
            title="اجرا · آماده‌سازی متن جدید",
            description=(
                "متن ورودی با الفبای مدل به نویسه‌ها شکسته شد. نویسهٔ خارج از الفبا [UNK] می‌شود. "
                "از این مرحله فقط رتبهٔ ادغام‌های ذخیره‌شده به کار می‌رود؛ فراوانی دوباره آموزش داده نمی‌شود."
            ),
            tokens=display_pieces(),
            vocabulary_size=len(model.vocabulary),
        )
    ]
    while True:
        present = {
            (left.text, right.text)
            for pieces in words for left, right in zip(pieces, pieces[1:])
            if (left.text, right.text) in ranks
        }
        if not present:
            break
        pair = min(present, key=ranks.__getitem__)
        for word_index, pieces in enumerate(words):
            merged: list[Piece] = []
            cursor = 0
            while cursor < len(pieces):
                if cursor + 1 < len(pieces) and (pieces[cursor].text, pieces[cursor + 1].text) == pair:
                    merged.append(Piece(pair[0] + pair[1], pieces[cursor].start, pieces[cursor + 1].end))
                    cursor += 2
                else:
                    merged.append(pieces[cursor])
                    cursor += 1
            words[word_index] = merged
        display = display_pieces()
        steps.append(
            TraceStep(
                id=len(steps),
                phase="encode",
                title=f"اجرا · اعمال ادغام با رتبهٔ {ranks[pair] + 1}",
                description=(
                    f"از میان جفت‌های موجود، جفت «{pair[0]}» و «{pair[1]}» "
                    f"کمترین رتبهٔ مدل ({ranks[pair] + 1}) را داشت و ادغام شد. واژگان مدل ثابت ماند."
                ),
                tokens=display,
                focus_indices=[i for i, value in enumerate(display) if value == pair[0] + pair[1]],
                selected_pair=SelectedPair(left=pair[0], right=pair[1]),
                vocabulary_size=len(model.vocabulary),
            )
        )
    ids = {symbol: index for index, symbol in enumerate(model.vocabulary)}
    tokens = [
        Token(text=piece.text, index=index, id=ids[piece.text], start=piece.start, end=piece.end)
        for index, piece in enumerate(piece for pieces in words for piece in pieces)
    ]
    return tokens, steps

