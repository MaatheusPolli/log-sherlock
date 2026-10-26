export type LogFormat = "json" | "line" | "stacktrace" | "http";

export interface HttpInfo {
  status: number;
  reason?: string;
  method?: string;
  url?: string;
}

export interface LogEntry {
  /** Linha (1-based) onde a entrada começa no arquivo original. */
  line: number;
  format: LogFormat;
  timestamp?: string;
  level?: string;
  /** Mensagem principal do erro, em uma linha. */
  message: string;
  /** Frames de stack trace ou linhas de continuação. */
  stack: string[];
  http?: HttpInfo;
  /** Verdadeiro quando a linha não pôde ser interpretada no formato detectado. */
  malformed?: boolean;
}
