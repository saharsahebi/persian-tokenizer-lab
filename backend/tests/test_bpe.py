"""Behavioral tests for the teaching algorithm, independent of the UI."""

from collections import Counter
import random

import pytest
from pydantic import ValidationError

from tokenizer_lab.bpe import count_pairs, encode_bpe, merge_symbols, train_bpe
from tokenizer_lab.schemas import BpeModel, UNKNOWN


def test_pair_counts_include_word_frequency_and_overlaps():
    counts = count_pairs({"aaa": ["a", "a", "a"], "ab": ["a", "b"]}, Counter({"aaa": 3, "ab": 2}))
    assert counts[("a", "a")] == 6
    assert counts[("a", "b")] == 2
    assert merge_symbols(["a", "a", "a"], ("a", "a")) == ["aa", "a"]


def test_training_trace_records_real_weighted_choice_and_after_state():
    model, steps = train_bpe("ab ab ac", max_merges=1, normalization=False)
    assert model.merges == [("a", "b")]
    assert steps[1].pairs[0].count == 2
    assert steps[1].selected_pair.left == "a"
    assert steps[1].corpus_preview[0].pieces == ["ab"]
    assert steps[1].corpus_preview[0].count == 2
    assert model.vocabulary == [UNKNOWN, "a", "b", "c", "ab"]


def test_frequency_ties_are_deterministic_independent_of_corpus_order():
    first, _ = train_bpe("ac ab", max_merges=1, normalization=False)
    second, _ = train_bpe("ab ac", max_merges=1, normalization=False)
    assert first.model_dump() == second.model_dump()
    assert first.merges == [("a", "b")]


def test_encoding_freezes_vocabulary_and_uses_rank_instead_of_new_frequency():
    model, _ = train_bpe("ab ab bc", max_merges=2, normalization=False)
    saved = model.model_dump()
    tokens, steps = encode_bpe("abc bc bc bc bc", model)
    assert [token.text for token in tokens] == ["ab", "c", "bc", "bc", "bc", "bc"]
    assert steps[1].selected_pair.model_dump() == {"left": "a", "right": "b"}
    assert model.model_dump() == saved


def test_unknown_codepoints_keep_spans_and_do_not_merge():
    model, _ = train_bpe("کتاب کتاب", max_merges=8, normalization=False)
    text = "کتاب 🐈 کتاب"
    tokens, _ = encode_bpe(text, model)
    assert [token.text for token in tokens] == ["کتاب", UNKNOWN, "کتاب"]
    unknown = tokens[1]
    assert unknown.id == 0
    assert text[unknown.start:unknown.end] == "🐈"
    assert unknown.end - unknown.start == 1


def test_bpe_never_crosses_whitespace_and_reconstructs_nonspace_input():
    randomizer = random.Random(41)
    for _ in range(35):
        corpus = " ".join("".join(randomizer.choices("abc", k=randomizer.randint(1, 8))) for _ in range(12))
        model, _ = train_bpe(corpus, max_merges=20, normalization=False)
        text = "aab\tbc\n cab"
        tokens, _ = encode_bpe(text, model)
        assert "".join(token.text for token in tokens) == "".join(text.split())
        assert all(text[token.start:token.end] == token.text for token in tokens)
        assert all(not any(char.isspace() for char in token.text) for token in tokens)


def test_literal_unknown_spelling_does_not_become_reserved_token():
    model, _ = train_bpe("[UNK] [UNK] [UNK]", max_merges=40, normalization=False)
    tokens, _ = encode_bpe("[UNK]", model)
    assert "".join(token.text for token in tokens) == "[UNK]"
    assert all(token.id != 0 for token in tokens)


def test_model_validation_rejects_forged_vocab_and_future_components():
    with pytest.raises(ValidationError):
        BpeModel(normalization=False, base_symbols=["a"], merges=[], vocabulary=[UNKNOWN, "x"])
    with pytest.raises(ValidationError):
        BpeModel(normalization=False, base_symbols=["a"], merges=[("a", "b")], vocabulary=[UNKNOWN, "a", "ab"])


def test_empty_corpus_is_not_silently_replaced_with_demo_data():
    with pytest.raises(ValueError):
        train_bpe(" \t\n", max_merges=3, normalization=False)

