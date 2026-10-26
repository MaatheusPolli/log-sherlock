import type { LineParser } from "./parser.js";
import { createLineParser } from "./line.parser.js";

// Frames de Node ("at fn (file:1:2)"), .NET ("at Ns.Tipo.Metodo() in C:\x.cs:line 42")
// e Delphi/madExcept ("[0040A1B2] Unit.Proc (Line 12, \"x.pas\")") viram `stack` da
// exceção anterior; qualquer outra linha abre uma nova exceção.
export const createStacktraceParser = (): LineParser => createLineParser("stacktrace");
