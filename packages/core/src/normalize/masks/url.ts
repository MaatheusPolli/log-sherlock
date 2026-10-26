const URL_RE = /\b(?:https?|wss?|ftp):\/\/[^\s"'<>]+[^\s"'<>.,;:)\]]/gi;

export const maskUrl = (s: string): string => s.replace(URL_RE, "<URL>");
