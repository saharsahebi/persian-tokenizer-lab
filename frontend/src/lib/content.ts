import type { Tokenizer } from './types';

export const TOKENIZERS: {
  id: Tokenizer;
  label: string;
  english: string;
  description: string;
  level: string;
}[] = [
  {
    id: 'hazm_word',
    label: 'واژه‌ای فارسی',
    english: 'Hazm · Word',
    description: 'شناخت واژه‌ها و علائم با قواعد فارسی',
    level: 'پیشنهاد شروع',
  },
  {
    id: 'whitespace',
    label: 'مبتنی بر فاصله',
    english: 'Whitespace',
    description: 'هر فاصله، یک مرز تازه',
    level: 'مقدماتی',
  },
  {
    id: 'character',
    label: 'نویسه‌ای',
    english: 'Character',
    description: 'هر کدپوینت یونیکد، یک توکن',
    level: 'مقدماتی',
  },
  {
    id: 'hazm_sentence',
    label: 'جمله‌ای فارسی',
    english: 'Hazm · Sentence',
    description: 'تقسیم متن به جمله‌های مستقل',
    level: 'مقدماتی',
  },
  {
    id: 'bpe',
    label: 'ادغام جفت‌ها',
    english: 'BPE',
    description: 'ساخت زیرواژه‌ها با یادگیری از پیکره',
    level: 'الگوریتمی',
  },
];
export const EXAMPLES = [
  { label: 'یک جملهٔ ساده', text: 'من کتاب دارم و تو کتاب داری' },
  {
    label: 'چالش نیم‌فاصله',
    text: 'من كتاب های زیادی دارم. هر روز کتاب‌هایم را می خوانم!',
  },
  {
    label: 'فعل‌های چندبخشی',
    text: 'این داستان گفته شده است. فردا به کتابخانه خواهد رفت.',
  },
  { label: 'آزمایش BPE', text: 'کتاب کتاب‌ها کتابخانه' },
];
export const DEFAULT_TEXT = 'من کتاب‌هایم را دوست دارم. تو هم کتاب می‌خوانی؟';
export const DEFAULT_CORPUS =
  'کتاب کتاب کتاب کتاب کتاب‌ها کتاب‌ها کتابخانه کتابخانه\nمن کتاب دارم و تو کتاب داری\nما هر روز کتاب می‌خوانیم و داستان می‌نویسیم\nکتاب‌خوانی یادگیری زبان فارسی را آسان می‌کند\nداستان داستان‌ها داستان‌نویس نویسنده خواننده\nمن کتاب‌هایم را دوست دارم تو هم کتاب می‌خوانی';
export const labelFor = (id: Tokenizer) => TOKENIZERS.find((item) => item.id === id)!.label;
export const fa = (value: number, digits = 0) =>
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: digits }).format(value);
export function visibleToken(text: string) {
  if (text === '\u200c') return 'نیم‌فاصله';
  return text.replaceAll(' ', '␠').replaceAll('\n', '↵').replaceAll('\t', '⇥');
}
export function downloadJson(value: unknown, name: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], {
      type: 'application/json;charset=utf-8',
    }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
