const FALLBACK_MODERATOR_EMAILS = ['roxy163@outlook.com'];

const parseModeratorEmails = (value?: string) => (
  value
    ?.split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean) || []
);

export const getModeratorEmails = () => {
  const configured = parseModeratorEmails(import.meta.env.VITE_MODERATOR_EMAILS);
  return configured.length > 0 ? configured : FALLBACK_MODERATOR_EMAILS;
};

export const isOfficialModerator = (email?: string | null) => (
  !!email && getModeratorEmails().includes(email.trim().toLowerCase())
);
