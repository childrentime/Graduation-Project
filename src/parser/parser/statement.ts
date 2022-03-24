import ExpressionParser from "./expression";
import * as N from "../types";
import { TokenType, tt } from "../token/types";

export default class StatementParser extends ExpressionParser {
  parseTopLevel(file: N.File, program: N.Program): N.File {
    file.program = this.parseProgram(program);
    file.comments = this.state.comments;

    return this.finishNode(file, "File");
  }

  parseProgram(program: N.Program, end: TokenType = tt.eof): N.Program {
    program.interpreter = this.parseInterpreterDirective();
    this.parseBlockBody(program, true, true, end);
    if (
      this.inModule &&
      !this.options.allowUndeclaredExports &&
      this.scope.undefinedExports.size > 0
    ) {
      for (const [localName, at] of Array.from(this.scope.undefinedExports)) {
        this.raise(Errors.ModuleExportUndefined, { at, localName });
      }
    }
    return this.finishNode<N.Program>(program, "Program");
  }

  parseInterpreterDirective(): N.InterpreterDirective | null {
    if (!this.match(tt.interpreterDirective)) {
      return null;
    }

    const node = this.startNode();
    node.value = this.state.value;
    this.next();
    return this.finishNode(node, "InterpreterDirective");
  }
}
