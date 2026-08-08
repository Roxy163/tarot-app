const hasExplicitTime = (value: string) => /T\d{2}:\d{2}| \d{2}:\d{2}/.test(value);

export function formatReadingDateTime(value?: string | null) {
  if (!value) return '未记录时间';

  const source = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T00:00:00`
    : value;
  const date = new Date(source);

  if (Number.isNaN(date.getTime())) return value;

  const dateText = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);

  if (!hasExplicitTime(value)) return dateText;

  const timeText = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  return `${dateText} ${timeText}`;
}
