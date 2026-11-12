export type Tokenizer = 'whitespace' | 'character' | 'hazm_word' | 'hazm_sentence' | 'bpe';
export type Mode = 'train' | 'encode';
export interface Token {
  text: string;
  index: number;
  id: number | null;
  start: number;
  end: number;
}
export interface VocabularyEntry {
  token: string;
  count: number;
  id: number | null;
}
export interface BpeModel {
  version: 1;
  kind: 'character-bpe';
  normalization: boolean;
  base_symbols: string[];
  merges: [string, string][];
  vocabulary: string[];
}
export interface TraceStep {
  id: number;
  phase: string;
  title: string;
  description: string;
  tokens: string[];
  focus_indices: number[];
  pairs?: { left: string; right: string; count: number }[];
  selected_pair?: { left: string; right: string } | null;
  vocabulary_size?: number | null;
  corpus_preview?: { word: string; pieces: string[]; count: number }[];
}
export interface AnalysisResponse {
  tokenizer: Tokenizer;
  mode: Mode;
  original_text: string;
  normalized_text: string;
  processed_text: string;
  tokens: Token[];
  vocabulary: VocabularyEntry[];
  stats: {
    token_count: number;
    type_count: number;
    ttr: number;
    model_vocab_size: number | null;
    unknown_count: number;
  };
  steps: TraceStep[];
  bpe_model: BpeModel | null;
  warnings: string[];
}
export interface AnalyzeRequest {
  text: string;
  tokenizer: Tokenizer;
  normalize: boolean;
  join_verb_parts: boolean;
  include_whitespace: boolean;
  mode: Mode;
  corpus?: string;
  max_merges: number;
  bpe_model?: BpeModel;
}
