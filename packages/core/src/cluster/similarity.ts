/** Similaridade de cosseno; vetores nulos têm similaridade 0. */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

const STOPWORDS = new Set(
  "a o e de da do das dos em no na nos nas um uma para por com the of to in on at and or for is was be an with from".split(" "),
);

/** Tokens para busca textual e embedding local: sem acento, minúsculos, sem placeholders. */
export function tokenize(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/<[a-z]+>|\[[a-z_]+\]/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}
