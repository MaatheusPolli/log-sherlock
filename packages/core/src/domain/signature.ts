export interface Signature {
  /** Mensagem normalizada, legível: "HTTP 401 Unauthorized POST <URL> ...". */
  text: string;
  /** Hash estável do texto normalizado. */
  hash: string;
}
