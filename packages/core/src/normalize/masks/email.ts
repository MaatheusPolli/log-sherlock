const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;

export const maskEmail = (s: string): string => s.replace(EMAIL_RE, "<EMAIL>");
