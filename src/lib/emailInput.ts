export const normalizeEmailInput = (value: string) => (
  value
    .replace(/[。．｡]/g, '.')
    .replace(/[＠﹫]/g, '@')
    .replace(/\s+/g, '')
    .toLowerCase()
);
