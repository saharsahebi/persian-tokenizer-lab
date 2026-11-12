"""API tests cover Persian normalization, actual Hazm behavior, and contracts."""

from fastapi.testclient import TestClient
from hazm import Normalizer, WordTokenizer

from tokenizer_lab.main import app

client = TestClient(app)


def analyze(**values):
    response = client.post("/api/analyze", json={"text": "من کتاب دارم و تو کتاب داری", "normalize": False, **values})
    assert response.status_code == 200, response.text
    return response.json()


def test_health_includes_installed_hazm_version():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["hazm_version"] == "0.12.1"


def test_tokens_types_and_frequency_are_different_counts():
    result = analyze(tokenizer="whitespace")
    assert result["stats"]["token_count"] == 7
    assert result["stats"]["type_count"] == 6
    assert result["stats"]["ttr"] == 6 / 7
    assert result["vocabulary"][0] == {"token": "کتاب", "count": 2, "id": None}
    assert result["stats"]["model_vocab_size"] is None


def test_normalization_matches_hazm_and_offsets_use_processed_text():
    original = "من كتاب هاي زيادي دارم ."
    result = analyze(tokenizer="whitespace", text=original, normalize=True)
    assert result["processed_text"] == Normalizer().normalize(original)
    assert result["processed_text"] != original
    assert result["original_text"] == original
    for token in result["tokens"]:
        assert result["processed_text"][token["start"]:token["end"]] == token["text"]


def test_character_mode_counts_codepoints_including_zwnj_and_optional_whitespace():
    result = analyze(tokenizer="character", text="می‌روم 🐈")
    values = [token["text"] for token in result["tokens"]]
    assert "\u200c" in values and " " not in values and "🐈" in values
    assert result["tokens"][-1]["end"] - result["tokens"][-1]["start"] == 1
    included = analyze(tokenizer="character", text="می‌روم 🐈", include_whitespace=True)
    assert included["stats"]["token_count"] == result["stats"]["token_count"] + 1


def test_hazm_compound_verbs_map_to_underlying_spaces_and_literal_underscores():
    text = "او گفته شده است. a_b گفته شده است."
    result = analyze(tokenizer="hazm_word", text=text, join_verb_parts=True)
    assert [token["text"] for token in result["tokens"]] == WordTokenizer().tokenize(text)
    joined = [token for token in result["tokens"] if token["text"] == "گفته_شده_است"]
    assert len(joined) == 2
    assert all(text[token["start"]:token["end"]] == "گفته شده است" for token in joined)
    literal = next(token for token in result["tokens"] if token["text"] == "a_b")
    assert text[literal["start"]:literal["end"]] == "a_b"
    assert [step["phase"] for step in result["steps"]] == ["input", "normalization", "split", "join", "result"]


def test_sentence_alignment_uses_earliest_newline_variant_not_later_exact_copy():
    text = "سلام\nدنیا. سلام دنیا."
    result = analyze(tokenizer="hazm_sentence", text=text)
    assert len(result["tokens"]) == 2
    assert result["tokens"][0]["start"] == 0
    assert text[result["tokens"][0]["start"]:result["tokens"][0]["end"]] == "سلام\nدنیا."


def test_hazm_literal_carriage_return_span_does_not_consume_following_space():
    text = "x\r y"
    result = analyze(tokenizer="hazm_word", text=text, join_verb_parts=False)
    for token in result["tokens"]:
        assert text[token["start"]:token["end"]] == token["text"]


def test_compare_uses_same_input_settings_for_all_four_methods():
    response = client.post("/api/compare", json={"text": "کتاب کتاب. خوب است!", "normalize": False})
    assert response.status_code == 200
    results = response.json()["results"]
    assert [result["tokenizer"] for result in results] == ["whitespace", "character", "hazm_word", "hazm_sentence"]
    assert all(result["processed_text"] == "کتاب کتاب. خوب است!" for result in results)


def test_saved_bpe_model_round_trip_encodes_without_training_steps():
    trained = analyze(tokenizer="bpe", text="کتاب خوب", corpus="کتاب کتاب خوب", max_merges=6)
    encoded = analyze(tokenizer="bpe", mode="encode", text="کتاب خوب 🐈", bpe_model=trained["bpe_model"])
    assert encoded["bpe_model"] == trained["bpe_model"]
    assert encoded["stats"]["unknown_count"] == 1
    assert not any(step["phase"] == "train" for step in encoded["steps"])
    assert any(step["phase"] == "encode" for step in encoded["steps"])


def test_model_normalization_mismatch_is_rejected():
    trained = analyze(tokenizer="bpe", corpus="کتاب کتاب", max_merges=2)
    response = client.post("/api/analyze", json={"text": "کتاب", "tokenizer": "bpe", "mode": "encode", "normalize": True, "bpe_model": trained["bpe_model"]})
    assert response.status_code == 422
    assert "نرمال‌سازی" in response.text


def test_input_validation_and_bounds_are_explicit():
    for values in [
        {"text": " \n\t"},
        {"text": "x" * 10001},
        {"text": "کتاب", "max_merges": 41},
        {"text": "کتاب", "tokenizer": "bpe", "mode": "encode"},
        {"text": "کتاب", "tokenizer": "bpe", "corpus": "   "},
    ]:
        assert client.post("/api/analyze", json=values).status_code == 422


def test_long_character_trace_is_bounded_but_final_tokens_complete():
    result = analyze(tokenizer="character", text="ک" * 1000)
    assert result["stats"]["token_count"] == 1000
    assert len(result["steps"]) == 27
    assert len(result["steps"][-1]["tokens"]) == 120
    assert len(result["tokens"]) == 1000

