import { useState } from 'react';
import { ArrowUpLeft, Braces, Fingerprint, Layers3, ListFilter, Search } from 'lucide-react';
import type { AnalysisResponse } from '../lib/types';
import { fa, visibleToken } from '../lib/content';

export function Statistics({ result }: { result: AnalysisResponse }) {
  const items = [
    {
      label: 'تعداد توکن‌ها',
      en: 'TOKENS',
      value: fa(result.stats.token_count),
      icon: Layers3,
      note: 'همهٔ رخدادها، با تکرار',
    },
    {
      label: 'انواع یکتا',
      en: 'TYPES',
      value: fa(result.stats.type_count),
      icon: Fingerprint,
      note: 'هر توکنِ متفاوت، یک بار',
    },
    {
      label: 'نسبت تنوع',
      en: 'TYPE / TOKEN',
      value: fa(result.stats.ttr * 100, 1) + '٪',
      icon: ListFilter,
      note: 'انواع یکتا ÷ تعداد توکن‌ها',
    },
    {
      label: result.tokenizer === 'bpe' ? 'واژگان مدل' : 'واژگان همین متن',
      en: 'VOCABULARY',
      value: fa(result.stats.model_vocab_size ?? result.stats.type_count),
      icon: Braces,
      note: result.tokenizer === 'bpe' ? 'شامل نمادهای پایه و [UNK]' : 'مجموعهٔ انواع مشاهده‌شده',
    },
  ];
  return (
    <div className="statistics">
      {items.map((item) => (
        <div className="stat-card" key={item.en}>
          <div>
            <span>{item.label}</span>
            <item.icon size={18} />
          </div>
          <strong>{item.value}</strong>
          <span className="stat-english" dir="ltr">
            {item.en}
          </span>
          <small>{item.note}</small>
        </div>
      ))}
    </div>
  );
}

export default function Results({ result }: { result: AnalysisResponse }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('count');
  const selectedToken = selected === null ? null : result.tokens[selected];
  const vocabulary = result.vocabulary
    .filter((entry) => entry.token.includes(query))
    .sort((a, b) =>
      sort === 'count'
        ? b.count - a.count || a.token.localeCompare(b.token, 'fa')
        : a.token.localeCompare(b.token, 'fa'),
    );
  const chars = Array.from(result.processed_text);
  return (
    <div className="results-grid">
      <section className="result-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">خروجی پردازش</span>
            <h2>هر توکن، یک قطعه از متن</h2>
          </div>
          <span className="count-tag">{fa(result.tokens.length)} توکن</span>
        </div>
        <p className="muted small">برای دیدن موقعیت و مشخصات، یک توکن را انتخاب کنید.</p>
        <div className="final-tokens">
          {result.tokens.slice(0, 1000).map((token, i) => (
            <button
              onClick={() => setSelected(selected === i ? null : i)}
              className={`final-token ${selected === i ? 'active' : ''} ${token.text === '[UNK]' ? 'unknown' : ''}`}
              key={i}
              aria-label={`توکن ${fa(i + 1)}: ${token.text}`}
            >
              <span>{visibleToken(token.text)}</span>
              <small>{fa(i + 1)}</small>
            </button>
          ))}
        </div>
        {result.tokens.length > 1000 && (
          <p className="small muted">نمایش ۱۰۰۰ توکن نخست؛ فایل JSON شامل همهٔ توکن‌هاست.</p>
        )}
        <div className="token-inspector">
          {selectedToken ? (
            <>
              <div className="inspector-top">
                <strong>{visibleToken(selectedToken.text)}</strong>
                <span className="soft-tag">
                  موقعیت {fa(selectedToken.start)} تا {fa(selectedToken.end)}
                </span>
              </div>
              <p className="inspected-text">
                {chars.slice(0, selectedToken.start).join('')}
                <mark>{chars.slice(selectedToken.start, selectedToken.end).join('')}</mark>
                {chars.slice(selectedToken.end).join('')}
              </p>
              <div className="inspector-meta">
                <span>
                  شناسهٔ مدل: <bdi>{selectedToken.id ?? '—'}</bdi>
                </span>
                <span>کدپوینت در متن: {fa(selectedToken.end - selectedToken.start)}</span>
              </div>
            </>
          ) : (
            <div className="inspector-empty">
              <ArrowUpLeft size={20} />
              یک توکن را از بالا انتخاب کنید.
            </div>
          )}
        </div>
        <p className="offset-note">
          موقعیت‌ها از صفر شروع می‌شوند؛ بازهٔ [شروع، پایان) برحسب کدپوینت، در متن پردازش‌شده است.
        </p>
      </section>
      <section className="result-panel vocabulary-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">واژگان مشاهده‌شده</span>
            <h2>یکتاها و تکرارها</h2>
          </div>
          <span className="count-tag">{fa(result.stats.type_count)} نوع</span>
        </div>
        <div className="table-tools">
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="جست‌وجو در واژگان"
              placeholder="جست‌وجوی توکن…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            aria-label="مرتب‌سازی واژگان"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="count">پرتکرارترین</option>
            <option value="alpha">الفبایی</option>
          </select>
        </div>
        <div className="vocabulary-scroll">
          <table>
            <thead>
              <tr>
                <th>توکن</th>
                <th>فراوانی</th>
                <th>سهم</th>
                {result.tokenizer === 'bpe' && <th>ID</th>}
              </tr>
            </thead>
            <tbody>
              {vocabulary.slice(0, 500).map((entry) => (
                <tr key={entry.token}>
                  <td>
                    <bdi>{visibleToken(entry.token)}</bdi>
                  </td>
                  <td>{fa(entry.count)}</td>
                  <td>
                    <div className="frequency-bar">
                      <i
                        style={{
                          width: `${(entry.count / Math.max(1, result.stats.token_count)) * 100}%`,
                        }}
                      />
                    </div>
                    <small>
                      {fa((entry.count / Math.max(1, result.stats.token_count)) * 100, 1)}٪
                    </small>
                  </td>
                  {result.tokenizer === 'bpe' && (
                    <td>
                      <bdi>{entry.id ?? '—'}</bdi>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!vocabulary.length && <p className="empty-state">توکنی با این عبارت پیدا نشد.</p>}
        </div>
        <p className="offset-note">
          این جدول انواعِ حاضر در متن را نشان می‌دهد؛ واژگان کامل BPE ممکن است بزرگ‌تر باشد.
        </p>
      </section>
    </div>
  );
}
