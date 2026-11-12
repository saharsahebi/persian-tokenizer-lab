import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, GitMerge, Pause, Play, RotateCcw, Sparkles } from 'lucide-react';
import type { AnalysisResponse } from '../lib/types';
import { fa, visibleToken } from '../lib/content';

export default function TracePlayer({ result }: { result: AnalysisResponse }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1300);
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [result]);
  useEffect(() => {
    if (!playing) return;
    if (index >= result.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setIndex((i) => i + 1), speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, result.steps.length]);
  const step = result.steps[Math.min(index, result.steps.length - 1)];
  if (!step) return <div className="empty-state">مرحله‌ای برای نمایش وجود ندارد.</div>;
  const maxPair = Math.max(1, ...(step.pairs || []).map((pair) => pair.count));
  const phases: Record<string, string> = {
    input: 'متن ورودی',
    normalization: 'نرمال‌سازی',
    normalize: 'نرمال‌سازی',
    split: 'جداسازی',
    join: 'اتصال اجزای فعل',
    merge: 'ادغام',
    train: 'آموزش',
    encode: 'اجرای مدل',
    result: 'نتیجه',
  };
  return (
    <section className="trace-panel" aria-label="نمایش مراحل الگوریتم">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">از متن تا توکن</span>
          <h2>الگوریتم را در عمل ببین</h2>
        </div>
        <span className="soft-tag">
          <Sparkles size={14} /> مراحل واقعی اجرا
        </span>
      </div>
      <div className="stage-track" aria-label="مسیر پردازش">
        {[
          'ورودی',
          'نرمال‌سازی',
          result.tokenizer === 'bpe' ? 'یادگیری و اجرا' : 'جداسازی',
          'توکن‌های نهایی',
        ].map((label, i) => (
          <div
            key={label}
            className={`stage ${i === 0 || (i === 1 && index > 0) || (i === 2 && index > 1) || (i === 3 && index === result.steps.length - 1) ? 'reached' : ''}`}
          >
            <span>{fa(i + 1)}</span>
            {label}
          </div>
        ))}
      </div>
      <div className="step-heading">
        <span className="step-badge">{phases[step.phase] || step.phase}</span>
        {step.vocabulary_size != null && (
          <span className="muted">واژگان این گام: {fa(step.vocabulary_size)}</span>
        )}
        <span className="muted">
          گام {fa(index + 1)} از {fa(result.steps.length)}
        </span>
      </div>
      <h3 className="step-title">{step.title}</h3>
      <p className="step-description" aria-live="polite">
        {step.description}
      </p>
      <div className="token-canvas" aria-label="توکن‌های مرحلهٔ فعلی">
        <span className="canvas-label">
          {step.phase === 'train' ? 'وضعیت پیکرهٔ آموزش' : 'وضعیت متن آزمایش'}
        </span>
        <div className="token-flow" key={`${result.tokenizer}-${index}`}>
          {step.tokens.slice(0, 160).map((token, i) => (
            <span
              key={i}
              className={`trace-token ${step.focus_indices.includes(i) ? 'focused' : ''}`}
              title={Array.from(token)
                .map((c) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)
                .join(' ')}
            >
              {visibleToken(token) || '∅'}
            </span>
          ))}
          {!step.tokens.length && <span className="muted">هنوز توکنی ساخته نشده است.</span>}
        </div>
        {step.tokens.length > 160 && <small>نمایش ۱۶۰ توکن نخست این مرحله</small>}
      </div>
      {Boolean(step.pairs?.length) && (
        <div className="merge-details">
          <div className="detail-title">
            <GitMerge size={17} />
            <h3>جفت‌های نامزد ادغام</h3>
            <span className="muted">فراوانی در پیکره</span>
          </div>
          <div className="pair-grid">
            {step.pairs!.slice(0, 8).map((pair, i) => {
              const selected =
                step.selected_pair?.left === pair.left && step.selected_pair?.right === pair.right;
              return (
                <div className={`pair-row ${selected ? 'selected' : ''}`} key={i}>
                  <span className="pair-name">
                    <bdi>{visibleToken(pair.left)}</bdi>
                    <span className="pair-plus">+</span>
                    <bdi>{visibleToken(pair.right)}</bdi>
                    {selected && <span className="selected-label">انتخاب شد</span>}
                  </span>
                  <div className="pair-meter">
                    <i style={{ width: `${(pair.count / maxPair) * 100}%` }} />
                  </div>
                  <strong>{fa(pair.count)}</strong>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {Boolean(step.corpus_preview?.length) && (
        <details className="corpus-preview">
          <summary>وضعیت واژه‌های پیکره در این گام</summary>
          <div className="corpus-grid">
            {step.corpus_preview!.slice(0, 12).map((word, i) => (
              <div key={i}>
                <span>
                  {word.word} <small>× {fa(word.count)}</small>
                </span>
                <div className="mini-pieces">
                  {word.pieces.map((piece, j) => (
                    <bdi key={j}>{piece}</bdi>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      <div className="player">
        <div className="player-buttons">
          <button
            className="icon-button"
            onClick={() => {
              setPlaying(false);
              setIndex(0);
            }}
            title="بازگشت به ابتدا"
            aria-label="بازگشت به ابتدا"
          >
            <RotateCcw size={17} />
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setPlaying(false);
              setIndex((i) => Math.max(0, i - 1));
            }}
            disabled={index === 0}
            title="مرحلهٔ قبل"
            aria-label="مرحلهٔ قبل"
          >
            <ArrowRight size={19} />
          </button>
          <button
            className="play-button"
            onClick={() => {
              if (index === result.steps.length - 1) setIndex(0);
              setPlaying(!playing);
            }}
            aria-label={playing ? 'توقف پخش' : 'پخش مراحل'}
          >
            {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
          </button>
          <button
            className="icon-button"
            onClick={() => {
              setPlaying(false);
              setIndex((i) => Math.min(result.steps.length - 1, i + 1));
            }}
            disabled={index === result.steps.length - 1}
            title="مرحلهٔ بعد"
            aria-label="مرحلهٔ بعد"
          >
            <ArrowLeft size={19} />
          </button>
        </div>
        <input
          aria-label="انتخاب مرحله"
          type="range"
          min="0"
          max={result.steps.length - 1}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
        />
        <select
          aria-label="سرعت پخش"
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
        >
          <option value={2200}>آهسته</option>
          <option value={1300}>معمولی</option>
          <option value={650}>سریع</option>
        </select>
      </div>
    </section>
  );
}
