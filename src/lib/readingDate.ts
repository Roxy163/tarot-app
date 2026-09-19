const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function toLocalReadingDate(value?: string | Date): string {
  if (typeof value === 'string' && DATE_ONLY.test(value)) return value;
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return toLocalReadingDate();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function serializeReadingDate(value: string, original?: string): string {
  if (DATE_ONLY.test(value)) {
    const parsed = new Date(`${value}T12:00:00`);
    if (Number.isNaN(parsed.getTime()) || toLocalReadingDate(parsed.toISOString()) !== value) throw new Error('请选择有效的占卜日期。');
    return original && toLocalReadingDate(original) === value ? original : value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error('请选择有效的占卜日期。');
  return date.toISOString();
}
