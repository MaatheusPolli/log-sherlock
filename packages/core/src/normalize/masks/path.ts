// Caminhos de arquivo (Windows, UNC, Unix) e nomes de módulo com extensão conhecida.
const PATH_RE = /(?:\b[A-Za-z]:\\|\\\\|(?<![\w<>])\/)(?:[\w.$ -]+[\\/])*[\w.$-]+\.\w{1,5}\b/g;
const MODULE_RE = /(?<![\w<])['"]?[\w.-]+\.(?:exe|dll|bpl|pas|dpr|cs|js|mjs|cjs|ts|java|py)['"]?(?![\w])/gi;

export const maskPath = (s: string): string => s.replace(PATH_RE, "<FILE>").replace(MODULE_RE, "<FILE>");
