import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  Code2,
  Download,
  FlaskConical,
  GitCompareArrows,
  GitMerge,
  Info,
  Layers3,
  LoaderCircle,
  Play,
  Settings2,
  Upload,
  WandSparkles,
  X,
} from 'lucide-react';
import TracePlayer from './components/TracePlayer';
import Results, { Statistics } from './components/Results';
import Guide from './components/Guide';
import { analyze, compare } from './lib/api';
import {
  DEFAULT_CORPUS,
  DEFAULT_TEXT,
  EXAMPLES,
  TOKENIZERS,
  downloadJson,
  fa,
  labelFor,
  visibleToken,
} from './lib/content';
import type { AnalysisResponse, AnalyzeRequest, BpeModel, Mode, Tokenizer } from './lib/types';

type Tab = 'trace' | 'results' | 'compare' | 'guide';
const MODEL_KEY = 'tokennama.bpe-model.v1';
const initialRequest: AnalyzeRequest = {
  text: DEFAULT_TEXT,
  tokenizer: 'hazm_word',
  normalize: true,
  join_verb_parts: true,
  include_whitespace: false,
  mode: 'train',
  max_merges: 12,
};
function storedModel(): BpeModel | null {
  try {
    const value = JSON.parse(localStorage.getItem(MODEL_KEY) || 'null');
    return value?.kind === 'character-bpe' && value?.version === 1 ? value : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [tokenizer, setTokenizer] = useState<Tokenizer>('hazm_word');
  const [normalize, setNormalize] = useState(true);
  const [joinVerbs, setJoinVerbs] = useState(true);
  const [includeWhitespace, setIncludeWhitespace] = useState(false);
  const [mode, setMode] = useState<Mode>('train');
  const [corpus, setCorpus] = useState(DEFAULT_CORPUS);
  const [maxMerges, setMaxMerges] = useState(12);
  const [model, setModel] = useState<BpeModel | null>(storedModel);
  const [result, setResult] = useState<AnalysisResponse | null>(null);
  const [comparison, setComparison] = useState<AnalysisResponse[]>([]);
  const [tab, setTab] = useState<Tab>('trace');
  const [loading, setLoading] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastKey, setLastKey] = useState('');
  const [health, setHealth] = useState<'loading' | 'online' | 'offline'>('loading');
  const fileInput = useRef<HTMLInputElement>(null);
  const modelInput = useRef<HTMLInputElement>(null);
  const initialController = useRef<AbortController | null>(null);
  const comparisonGeneration = useRef(0);
  const request: AnalyzeRequest = {
    text,
    tokenizer,
    normalize,
    join_verb_parts: joinVerbs,
    include_whitespace: includeWhitespace,
    mode,
    max_merges: maxMerges,
    ...(tokenizer === 'bpe' && mode === 'train' ? { corpus } : {}),
    ...(tokenizer === 'bpe' && mode === 'encode' && model ? { bpe_model: model } : {}),
  };
  const key = JSON.stringify(request);
  const dirty = Boolean(result) && key !== lastKey;
  const activeTokenizer = TOKENIZERS.find((item) => item.id === tokenizer)!;

  useEffect(() => {
    const controller = new AbortController();
    initialController.current = controller;
    analyze(initialRequest, controller.signal)
      .then((data) => {
        setResult(data);
        setLastKey(JSON.stringify(initialRequest));
        setHealth('online');
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err.message);
          setHealth('offline');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    let alive = true;
    const ping = () =>
      fetch('/api/health')
        .then((response) => {
          if (alive) setHealth(response.ok ? 'online' : 'offline');
        })
        .catch(() => {
          if (alive) setHealth('offline');
        });
    void ping();
    const timer = window.setInterval(ping, 30000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);
  useEffect(() => {
    comparisonGeneration.current += 1;
    setComparison([]);
    setComparing(false);
  }, [text, normalize, joinVerbs, includeWhitespace]);
  useEffect(() => {
    if (tokenizer === 'bpe' && mode === 'encode' && model) setNormalize(model.normalization);
  }, [tokenizer, mode, model]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function run() {
    if (!text.trim()) {
      setError('ابتدا یک جمله یا متن فارسی وارد کنید.');
      return;
    }
    if (tokenizer === 'bpe' && mode === 'train' && !corpus.trim()) {
      setError('برای آموزش BPE یک پیکره وارد کنید.');
      return;
    }
    if (tokenizer === 'bpe' && mode === 'encode' && !model) {
      setError('ابتدا در حالت آموزش یک مدل بسازید یا فایل مدل را بارگذاری کنید.');
      return;
    }
    initialController.current?.abort();
    setLoading(true);
    setError('');
    try {
      const data = await analyze(request);
      setResult(data);
      setLastKey(key);
      setHealth('online');
      setTab('trace');
      if (data.bpe_model) {
        setModel(data.bpe_model);
        try {
          localStorage.setItem(MODEL_KEY, JSON.stringify(data.bpe_model));
        } catch {
          setNotice('مدل ساخته شد؛ ذخیره در مرورگر ممکن نبود. می‌توانید فایل مدل را دریافت کنید.');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در پردازش متن.');
    } finally {
      setLoading(false);
    }
  }
  async function loadComparison(force = false) {
    setTab('compare');
    if ((!force && comparison.length) || comparing) return;
    if (!text.trim()) {
      setError('برای مقایسه، ابتدا متن وارد کنید.');
      return;
    }
    setComparing(true);
    setError('');
    const generation = ++comparisonGeneration.current;
    try {
      const data = await compare({
        text,
        normalize,
        join_verb_parts: joinVerbs,
        include_whitespace: includeWhitespace,
      });
      if (comparisonGeneration.current === generation) setComparison(data.results);
    } catch (err) {
      if (comparisonGeneration.current === generation)
        setError(err instanceof Error ? err.message : 'مقایسه انجام نشد.');
    } finally {
      if (comparisonGeneration.current === generation) setComparing(false);
    }
  }
  function changeMode(next: Mode) {
    setMode(next);
    if (next === 'encode' && model) setNormalize(model.normalization);
  }
  async function importText(file?: File) {
    if (!file) return;
    if (file.size > 80000) {
      setError('فایل متن باید کوچک‌تر از ۸۰ کیلوبایت باشد.');
      return;
    }
    const value = (await file.text()).replace(/^\uFEFF/, '');
    if (Array.from(value).length > 10000) {
      setError('حداکثر طول ورودی ۱۰٬۰۰۰ کدپوینت است.');
      return;
    }
    setText(value);
    setNotice('متن فایل بارگذاری شد.');
  }
  async function importModel(file?: File) {
    if (!file) return;
    if (file.size > 200000) {
      setError('حجم فایل مدل بیش از حد مجاز است.');
      return;
    }
    try {
      const value = JSON.parse(await file.text()) as BpeModel;
      if (
        value.version !== 1 ||
        value.kind !== 'character-bpe' ||
        typeof value.normalization !== 'boolean' ||
        !Array.isArray(value.base_symbols) ||
        !Array.isArray(value.merges) ||
        !Array.isArray(value.vocabulary)
      )
        throw new Error();
      setModel(value);
      setTokenizer('bpe');
      setMode('encode');
      setNormalize(value.normalization);
      setNotice('مدل بارگذاری شد؛ برای بررسی و اجرای آن، پردازش را آغاز کنید.');
    } catch {
      setError('فایل، یک مدل معتبر توکن‌نما با قالب JSON نیست.');
    }
  }
  const compareResults = [
    ...comparison,
    ...(result?.tokenizer === 'bpe' && !dirty && comparison.length ? [result] : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            setTab('trace');
          }}
          aria-label="توکن‌نما، صفحهٔ آزمایشگاه"
        >
          <span className="brand-symbol">
            <Code2 size={27} />
          </span>
          <div>
            <strong>
              توکن‌نما<span className="brand-dot">.</span>
            </strong>
            <small dir="ltr">TOKENNAMA</small>
          </div>
        </a>
        <div className="sidebar-caption">فضای یادگیری شما</div>
        <nav aria-label="ناوبری اصلی">
          <button
            className={tab === 'trace' || tab === 'results' ? 'active' : ''}
            onClick={() => setTab('trace')}
          >
            <FlaskConical size={19} />
            آزمایشگاه
            <span className="nav-dot" />
          </button>
          <button
            className={tab === 'compare' ? 'active' : ''}
            onClick={() => void loadComparison()}
          >
            <GitCompareArrows size={19} />
            مقایسهٔ روش‌ها
          </button>
          <button className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}>
            <BookOpen size={19} />
            راهنمای مفاهیم
          </button>
        </nav>
        <div className="sidebar-bottom">
          <span className="version-tag">نسخهٔ ۰.۱</span>
          <span>ساخته‌شده برای زبان فارسی</span>
          <div dir="ltr">Vite + Python + Hazm</div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>توکن‌نما</span>
            <span>/</span>
            <strong>
              {tab === 'guide'
                ? 'راهنمای مفاهیم'
                : tab === 'compare'
                  ? 'مقایسهٔ روش‌ها'
                  : 'آزمایشگاه تعاملی'}
            </strong>
          </div>
          <div className={`connection ${health}`}>
            <i />
            <span>
              {health === 'online'
                ? 'پردازشگر آماده است'
                : health === 'offline'
                  ? 'پردازشگر در دسترس نیست'
                  : 'در حال اتصال'}
            </span>
            <span className="connection-tech">Python API</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="heading-kicker">
                <span />
                <span>آزمایشگاه پردازش زبان فارسی</span>
              </div>
              <h1>زبان، قطعه‌به‌قطعه.</h1>
              <p>متنت را وارد کن، روش را انتخاب کن و ببین توکن‌ها چطور ساخته می‌شوند.</p>
            </div>
            <div className="heading-mark" aria-hidden="true">
              <span>متن</span>
              <i />
              <span>توکن</span>
              <i />
              <span>درک</span>
            </div>
          </div>
          <section className="input-panel" aria-label="متن و تنظیمات توکن‌سازی">
            <div className="input-main">
              <div className="editor-heading">
                <label htmlFor="persian-input">
                  <span className="section-number" aria-hidden="true">
                    ۰۱
                  </span>
                  متنِ شما
                </label>
                <button className="text-button" onClick={() => fileInput.current?.click()}>
                  <Upload size={15} />
                  بارگذاری متن
                </button>
                <input
                  type="file"
                  accept=".txt,text/plain"
                  ref={fileInput}
                  className="visually-hidden"
                  onChange={(e) => {
                    void importText(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </div>
              <textarea
                id="persian-input"
                aria-label="متنِ شما"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="یک جمله، یک داستان، یا چند خط فارسی بنویسید…"
                maxLength={20000}
                spellCheck={false}
              />
              <div className="editor-footer">
                <span>
                  <span className="status-dot" />
                  متن فارسی و ترکیبی
                </span>
                <span>{fa(Array.from(text).length)} / ۱۰٬۰۰۰ نویسه</span>
              </div>
              <div className="examples">
                <span>امتحان کن:</span>
                {EXAMPLES.map((example) => (
                  <button
                    key={example.label}
                    onClick={() => {
                      setText(example.text);
                      if (example.label === 'آزمایش BPE') setTokenizer('bpe');
                    }}
                  >
                    {example.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="input-settings">
              <label className="field-label" htmlFor="tokenizer-select">
                <span className="section-number" aria-hidden="true">
                  ۰۲
                </span>
                روش توکن‌سازی
              </label>
              <div className="select-wrap">
                <select
                  id="tokenizer-select"
                  aria-label="روش توکن‌سازی"
                  value={tokenizer}
                  onChange={(e) => setTokenizer(e.target.value as Tokenizer)}
                >
                  {TOKENIZERS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label} — {item.english}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </div>
              <div className="method-description">
                <span dir="ltr">{activeTokenizer.english}</span>
                <span>{activeTokenizer.description}</span>
              </div>
              <div className="switch-row">
                <div>
                  <span>نرمال‌سازی فارسی</span>
                  <small>یکدست‌کردن نوشتار با Hazm</small>
                </div>
                <button
                  type="button"
                  className={`switch ${normalize ? 'on' : ''}`}
                  role="switch"
                  aria-checked={normalize}
                  aria-label="نرمال‌سازی فارسی"
                  disabled={tokenizer === 'bpe' && mode === 'encode' && Boolean(model)}
                  onClick={() => setNormalize(!normalize)}
                >
                  <i />
                </button>
              </div>
              {tokenizer === 'hazm_word' && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={joinVerbs}
                    onChange={(e) => setJoinVerbs(e.target.checked)}
                  />
                  اتصال اجزای فعل چندبخشی
                </label>
              )}
              {tokenizer === 'character' && (
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={includeWhitespace}
                    onChange={(e) => setIncludeWhitespace(e.target.checked)}
                  />
                  شمردن فاصله‌ها به‌عنوان توکن
                </label>
              )}
              {tokenizer === 'bpe' && (
                <div className="mode-switch" aria-label="حالت BPE">
                  <button
                    className={mode === 'train' ? 'active' : ''}
                    onClick={() => changeMode('train')}
                  >
                    آموزش و آزمایش
                  </button>
                  <button
                    className={mode === 'encode' ? 'active' : ''}
                    onClick={() => changeMode('encode')}
                  >
                    اجرای مدل ثابت
                  </button>
                </div>
              )}
              <button
                className="run-button"
                onClick={() => void run()}
                disabled={loading || Array.from(text).length > 10000}
              >
                {loading ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <Play size={17} fill="currentColor" />
                )}
                {loading
                  ? 'در حال پردازش…'
                  : tokenizer === 'bpe' && mode === 'train'
                    ? 'آموزش و توکن‌سازی'
                    : 'شروع توکن‌سازی'}
                <span>ببین و یاد بگیر</span>
              </button>
            </div>
          </section>
          {tokenizer === 'bpe' && (
            <section className="bpe-settings">
              <div className="bpe-header">
                <div>
                  <GitMerge size={19} />
                  <strong>{mode === 'train' ? 'پیکرهٔ آموزش BPE' : 'مدل ثابت BPE'}</strong>
                  <span className="soft-tag">در سطح نویسه</span>
                </div>
                <div>
                  <button className="text-button" onClick={() => modelInput.current?.click()}>
                    <Upload size={15} />
                    بارگذاری مدل
                  </button>
                  {model && (
                    <button
                      className="text-button"
                      onClick={() => downloadJson(model, 'tokennama-bpe-model.json')}
                    >
                      <Download size={15} />
                      دریافت مدل
                    </button>
                  )}
                  <input
                    ref={modelInput}
                    type="file"
                    accept=".json,application/json"
                    className="visually-hidden"
                    onChange={(e) => {
                      void importModel(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
              {mode === 'train' ? (
                <div className="bpe-training">
                  <label>
                    الگوریتم از این متن یاد می‌گیرد؛ سپس جملهٔ بالا را توکن می‌کند.
                    <textarea
                      value={corpus}
                      maxLength={60000}
                      onChange={(e) => setCorpus(e.target.value)}
                      aria-label="پیکرهٔ آموزش BPE"
                      spellCheck={false}
                    />
                  </label>
                  <div className="merge-control">
                    <label htmlFor="max-merges">
                      سقف ادغام‌ها <strong>{fa(maxMerges)}</strong>
                    </label>
                    <input
                      id="max-merges"
                      type="range"
                      min="0"
                      max="40"
                      value={maxMerges}
                      onChange={(e) => setMaxMerges(Number(e.target.value))}
                    />
                    <p>هر ادغام، یک جفت پرتکرار را به یک قطعه تبدیل می‌کند.</p>
                    <button className="text-button" onClick={() => setCorpus(DEFAULT_CORPUS)}>
                      <WandSparkles size={15} />
                      پیکرهٔ نمونه
                    </button>
                    <small>{fa(Array.from(corpus).length)} / ۳۰٬۰۰۰ کدپوینت</small>
                  </div>
                </div>
              ) : (
                <div className="model-summary">
                  {model ? (
                    <>
                      <span className="model-check">
                        <Check size={17} />
                        مدل آمادهٔ آزمایش است
                      </span>
                      <span>{fa(model.vocabulary.length)} عضو واژگان</span>
                      <span>{fa(model.merges.length)} ادغامِ آموخته‌شده</span>
                      <span>نرمال‌سازی: {model.normalization ? 'روشن' : 'خاموش'}</span>
                    </>
                  ) : (
                    <p>
                      هنوز مدلی ندارید؛ ابتدا یک مدل آموزش دهید یا فایل JSON آن را بارگذاری کنید.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
          {error && (
            <div className="alert error" role="alert">
              <Info size={18} />
              <span>{error}</span>
              <button aria-label="بستن پیام خطا" onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="toast" role="status">
              <Check size={17} />
              {notice}
            </div>
          )}
          {dirty && (
            <div className="dirty-notice">
              <Settings2 size={15} />
              ورودی یا تنظیمات تغییر کرده است؛ نتایج پایین مربوط به آخرین اجراست.
              <button onClick={() => void run()} disabled={loading}>
                به‌روزرسانی
                <ArrowLeft size={14} />
              </button>
            </div>
          )}
          {result && <Statistics result={result} />}
          <div className="workspace-tabs">
            <div role="tablist" aria-label="بخش‌های آزمایشگاه">
              {(
                [
                  { id: 'trace', label: 'مراحل اجرا', icon: Activity },
                  { id: 'results', label: 'توکن‌ها و واژگان', icon: Layers3 },
                  {
                    id: 'compare',
                    label: 'مقایسهٔ روش‌ها',
                    icon: GitCompareArrows,
                  },
                  { id: 'guide', label: 'راهنمای مفاهیم', icon: BookOpen },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  role="tab"
                  aria-selected={tab === item.id}
                  className={tab === item.id ? 'active' : ''}
                  onClick={() => (item.id === 'compare' ? void loadComparison() : setTab(item.id))}
                >
                  <item.icon size={17} />
                  {item.label}
                </button>
              ))}
            </div>
            {result && (
              <button
                className="export-button"
                onClick={() => downloadJson(result, `tokennama-${result.tokenizer}-analysis.json`)}
              >
                <Download size={16} />
                <span>خروجی JSON</span>
              </button>
            )}
          </div>
          {tab === 'guide' ? (
            <Guide />
          ) : tab === 'compare' ? (
            <section className="comparison-panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">یک متن، چند نگاه</span>
                  <h2>مرز توکن‌ها را مقایسه کن</h2>
                </div>
                <button
                  className="text-button"
                  disabled={comparing}
                  onClick={() => void loadComparison(true)}
                >
                  اجرای دوباره
                  <ArrowLeft size={15} />
                </button>
              </div>
              <p className="muted small">
                تعداد کمتر، لزوماً بهتر نیست؛ هر روش واحد متفاوتی می‌سازد. تنظیمات نرمال‌سازی برای
                همه یکسان است.
              </p>
              {comparing ? (
                <div className="empty-state">
                  <LoaderCircle className="spin" />
                  در حال مقایسهٔ روش‌ها…
                </div>
              ) : (
                <div className="comparison-grid">
                  {compareResults.map((item) => (
                    <article className="comparison-card" key={item.tokenizer}>
                      <div>
                        <h3>{labelFor(item.tokenizer)}</h3>
                        <span>
                          {fa(item.stats.token_count)} توکن <span className="muted">/</span>{' '}
                          {fa(item.stats.type_count)} نوع
                        </span>
                      </div>
                      <div className="comparison-tokens">
                        {item.tokens.slice(0, 80).map((token, i) => (
                          <bdi key={i}>{visibleToken(token.text)}</bdi>
                        ))}
                      </div>
                      {item.tokens.length > 80 && <small>نمایش ۸۰ توکن نخست</small>}
                    </article>
                  ))}
                </div>
              )}
              {!comparing && !compareResults.length && (
                <p className="empty-state">برای دریافت نتایج، پردازشگر باید در دسترس باشد.</p>
              )}
            </section>
          ) : result ? (
            <>
              <div className="result-caption">
                <span className="status-dot" />
                <span>نتیجهٔ {labelFor(result.tokenizer)}</span>
                <span className="caption-separator">/</span>
                <span>
                  {result.tokenizer === 'bpe'
                    ? result.mode === 'train'
                      ? 'آموزش و اجرا'
                      : 'اجرای مدل ثابت'
                    : 'پردازش قاعده‌محور'}
                </span>
              </div>
              {tab === 'trace' ? (
                <TracePlayer result={result} />
              ) : (
                <Results key={lastKey} result={result} />
              )}
              {result.original_text !== result.processed_text && (
                <details className="normalization-panel">
                  <summary>
                    <WandSparkles size={17} />
                    متن پیش و پس از نرمال‌سازی
                    <ChevronDown size={16} />
                  </summary>
                  <div>
                    <article>
                      <span>متن اصلی</span>
                      <p>{result.original_text}</p>
                    </article>
                    <article>
                      <span>متن پردازش‌شده</span>
                      <p>{result.processed_text}</p>
                    </article>
                  </div>
                </details>
              )}
              {result.warnings.length > 0 && (
                <details className="method-notes">
                  <summary>
                    <Info size={15} />
                    نکته‌های این روش و محدودهٔ نمایش
                  </summary>
                  <ul>
                    {result.warnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          ) : (
            <div className="empty-state">
              <FlaskConical size={32} />
              <h2>{loading ? 'آزمایشگاه در حال آماده‌شدن است…' : 'اولین آزمایش را شروع کن'}</h2>
              <p>متن و روش را انتخاب کنید و روی «شروع توکن‌سازی» بزنید.</p>
            </div>
          )}
          <footer className="page-footer">
            <span>توکن‌نما؛ برای دیدنِ آنچه بین متن و ماشین می‌گذرد.</span>
            <span dir="ltr">Persian Tokenizer Lab · v0.1.0</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
