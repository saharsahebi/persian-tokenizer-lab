import type { AnalysisResponse, AnalyzeRequest } from './types';

async function post<T>(path: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new Error('ارتباط با پردازشگر برقرار نشد. سرور Python را با راهنمای پروژه اجرا کنید.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = body.detail;
    throw new Error(
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((item: { msg: string }) => item.msg).join('؛ ')
          : 'پردازش متن انجام نشد. ورودی و تنظیمات را بررسی کنید.',
    );
  }
  return response.json() as Promise<T>;
}

export const analyze = (payload: AnalyzeRequest, signal?: AbortSignal) =>
  post<AnalysisResponse>('analyze', payload, signal);
export const compare = (
  payload: Pick<AnalyzeRequest, 'text' | 'normalize' | 'join_verb_parts' | 'include_whitespace'>,
) => post<{ results: AnalysisResponse[] }>('compare', payload);
