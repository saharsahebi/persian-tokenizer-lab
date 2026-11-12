# Persian Tokenizer Lab API

Python 3.12 or 3.13 is required by the pinned Hazm dependency.

From the repository root:

```sh
python -m venv backend/.venv
# Activate the environment, then:
python -m pip install -e "./backend[dev]"
python -m uvicorn tokenizer_lab.main:app --host 127.0.0.1 --port 8000
```

Interactive API documentation is available at `http://127.0.0.1:8000/docs`.
Run tests with `python -m pytest backend/tests`.

All token offsets are Python Unicode codepoint offsets into `processed_text`.
They are half-open `[start, end)` spans. Hazm may join words using underscores;
the corresponding span includes the original spaces between those words.

The BPE implementation is a small educational character-level BPE with
whitespace pre-tokenization. Training uses weighted adjacent-pair frequencies,
Unicode lexicographic tie-breaking, and non-overlapping left-to-right merges.
Encoding uses the learned merge ranks and never recomputes corpus frequencies.
It is not byte-level BPE and does not claim compatibility with a pretrained model.
Unknown codepoints become `[UNK]` (ID 0); whitespace is not part of its vocabulary.
Model normalization settings are immutable and must match encoding requests.

Responses include the full final token list. Visual trace snapshots are capped
at 120 tokens, 12 corpus words, and 20 candidate pairs, with at most 40 merges.
These display caps do not change the computation. Simple scan visualizations
show the first 24 emissions followed by the complete result summary.

Hazm trace entries show actual input/output calls. They do not invent internal
Hazm decision traces. No model download or external API is used at runtime.

