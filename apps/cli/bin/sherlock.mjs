#!/usr/bin/env node
// Executa a CLI em TypeScript via tsx (sem etapa de build).
import { register } from "tsx/esm/api";
register();
await import("../src/index.ts");
