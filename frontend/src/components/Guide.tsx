import { BookOpen, GitMerge, GraduationCap, ScanText } from 'lucide-react';

export default function Guide() {
  return (
    <section className="guide-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">یادگیری از پایه</span>
          <h2>چند مفهوم، یک نگاه روشن‌تر</h2>
        </div>
        <GraduationCap size={24} />
      </div>
      <div className="guide-grid">
        <article>
          <span className="guide-icon">
            <ScanText size={22} />
          </span>
          <h3>توکن با واژه یکی نیست</h3>
          <p>
            توکن واحد خروجیِ روش انتخاب‌شده است؛ می‌تواند یک واژه، علامت، جمله، نویسه یا بخشی از
            واژه باشد.
          </p>
          <div className="example-box">
            کتاب‌ها ← کتاب + ‌ها <small>فقط یک مثال از قطعه‌بندیِ ممکن</small>
          </div>
        </article>
        <article>
          <span className="guide-icon">
            <BookOpen size={22} />
          </span>
          <h3>Token، Type و Vocabulary</h3>
          <p>
            در «من کتاب دارم و تو کتاب داری» با روش فاصله‌ای، ۷ توکن و ۶ نوع یکتا داریم. «کتاب» دو
            بار رخ داده، ولی یک نوع است.
          </p>
          <div className="example-box">
            TTR = ۶ ÷ ۷ ≈ ۸۵٫۷٪
            <small>این نسبت به طول متن حساس است؛ امتیاز کیفیت متن نیست.</small>
          </div>
        </article>
        <article>
          <span className="guide-icon">
            <GitMerge size={22} />
          </span>
          <h3>BPE چگونه یاد می‌گیرد؟</h3>
          <p>
            از نویسه‌ها شروع می‌کنیم. فراوانی جفت‌های مجاور را با احتساب تکرار واژه‌ها می‌شماریم؛
            پرتکرارترین جفت ادغام می‌شود. این کار تا سقف ادغام یا پایان نامزدها ادامه دارد.
          </p>
          <div className="example-box">
            ک + ت → کت
            <small>در تساوی، ترتیب یونیکد تعیین‌کننده است؛ اجرای دوباره نتیجهٔ یکسان دارد.</small>
          </div>
        </article>
        <article>
          <span className="guide-icon">
            <GraduationCap size={22} />
          </span>
          <h3>آموزش با اجرا فرق دارد</h3>
          <p>
            در آموزش، واژگان و ترتیب ادغام‌ها از پیکره ساخته می‌شوند. در اجرا، همین قواعد ثابت روی
            جملهٔ تازه اعمال می‌شوند؛ جفت‌ها دوباره از جمله یاد گرفته نمی‌شوند.
          </p>
          <div className="example-box">
            پیکره → مدل ثابت → جملهٔ جدید
            <small>نویسهٔ خارج از الفبای مدل، به [UNK] تبدیل می‌شود.</small>
          </div>
        </article>
      </div>
      <details className="lesson" open>
        <summary>چرا نیم‌فاصله در فارسی مهم است؟</summary>
        <p>
          «می‌روم» یک نیم‌فاصلهٔ U+200C دارد؛ نیم‌فاصله با فاصلهٔ معمولی فرق می‌کند و در روش
          فاصله‌ای مرز جداسازی نیست. در روش نویسه‌ای، خودش یک کدپوینت مستقل است. شکل‌های عربی «ي» و
          «ك» هم با «ی» و «ک» کد متفاوتی دارند؛ نرمال‌سازی می‌تواند این تفاوت‌ها را تغییر دهد.
        </p>
        <div className="unicode-samples">
          <span>
            فاصله <code>U+0020</code>
          </span>
          <span>
            نیم‌فاصله <code>U+200C</code>
          </span>
          <span>
            ی فارسی <code>U+06CC</code>
          </span>
          <span>
            ي عربی <code>U+064A</code>
          </span>
        </div>
      </details>
      <details className="lesson">
        <summary>این نسخه دقیقاً چه چیزی را نشان می‌دهد؟</summary>
        <p>
          BPE این برنامه یک پیاده‌سازی آموزشی در سطح نویسه با مرزبندی مبتنی بر فاصله است؛ توکنایزر
          آمادهٔ یک مدل زبانی خاص نیست. دفترچهٔ مراحل آن از تصمیم‌های واقعی همین موتور ساخته می‌شود.
          برای Hazm، ورودی، نرمال‌سازی و خروجی واقعی کتابخانه نمایش داده می‌شود؛ همهٔ قواعد داخلی
          Hazm در این نسخه رهگیری نمی‌شوند.
        </p>
      </details>
      <details className="lesson">
        <summary>چگونه مقایسهٔ منصفانه داشته باشیم؟</summary>
        <p>
          با متن و تنظیمات نرمال‌سازی یکسان مقایسه کنید. توکن‌های جمله‌ای، نویسه‌ای و واژه‌ای
          واحدهای متفاوت دارند؛ کمتر بودن تعداد توکن، به‌تنهایی نشانهٔ بهتر بودن روش نیست. در این
          نسخه، واژگان Hazm شناسهٔ مدل ندارند؛ شناسه‌های BPE به مدل آموزش‌دیده تعلق دارند.
        </p>
      </details>
      <div className="guide-sources">
        مطالعهٔ بیشتر:{' '}
        <a href="https://www.roshan-ai.ir/hazm/" target="_blank" rel="noreferrer">
          مستندات Hazm
        </a>
        <span>·</span>
        <a
          href="https://huggingface.co/learn/llm-course/en/chapter6/5"
          target="_blank"
          rel="noreferrer"
        >
          آموزش BPE در Hugging Face
        </a>
      </div>
    </section>
  );
}
