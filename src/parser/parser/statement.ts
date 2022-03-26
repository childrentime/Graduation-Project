import ExpressionParser from "./expression";
import * as N from "../types";
import { TokenType, tt } from "../token/types";
import * as charCodes from "charcodes";
import { isIdentifierChar, isIdentifierStart } from "../util/identifier";

const keywordRelationalOperator = /in(?:stanceof)?/y;
const loopLabel = { kind: "loop" } as const;
const switchLabel = { kind: "switch" } as const;
export default class StatementParser extends ExpressionParser {
  parseTopLevel(file: N.File, program: N.Program): N.File {
    file.program = this.parseProgram(program);
    file.comments = this.state.comments;

    return this.finishNode(file, "File");
  }

  parseProgram(program: N.Program, end: TokenType = tt.eof): N.Program {
    program.interpreter = this.parseInterpreterDirective();
    this.parseBlockBody(program, true, true, end);
    return this.finishNode<N.Program>(program, "Program");
  }

  parseInterpreterDirective(): N.InterpreterDirective | null {
    if (!this.match(tt.interpreterDirective)) {
      return null;
    }
    const node = this.startNode() as N.InterpreterDirective;
    node.value = this.state.value;
    this.next();
    return this.finishNode<N.InterpreterDirective>(
      node,
      "InterpreterDirective"
    );
  }

  parseBlockBody(
    node: N.BlockStatementLike,
    allowDirectives: boolean,
    topLevel: boolean,
    end: TokenType,
    afterBlockParse?: (hasStrictModeDirective: boolean) => void
  ): void {
    const body: N.Node[] = (node.body = []);
    const directives: N.Directive[] = (node.directives = []);
    this.parseBlockOrModuleBlockBody(
      body,
      allowDirectives ? directives : undefined,
      topLevel,
      end,
      afterBlockParse
    );
  }

  // Undefined directives means that directives are not allowed.
  // https://tc39.es/ecma262/#prod-Block
  // https://tc39.es/ecma262/#prod-ModuleBody
  parseBlockOrModuleBlockBody(
    body: N.Statement[],
    directives: N.Directive[],
    topLevel: boolean,
    end: TokenType,
    afterBlockParse?: (hasStrictModeDirective: boolean) => void
  ): void {
    const oldStrict = this.state.strict;
    let hasStrictModeDirective = false;
    let parsedNonDirective = false;

    while (!this.match(end)) {
      const stmt = this.parseStatement(null, topLevel);

      if (directives && !parsedNonDirective) {
        if (this.isValidDirective(stmt)) {
          const directive = this.stmtToDirective(stmt);
          directives.push(directive);

          if (
            !hasStrictModeDirective &&
            directive.value.value === "use strict"
          ) {
            hasStrictModeDirective = true;
            this.setStrict(true);
          }

          continue;
        }
        parsedNonDirective = true;
        // clear strict errors since the strict mode will not change within the block
        this.state.strictErrors.clear();
      }
      body.push(stmt);
    }

    if (afterBlockParse) {
      afterBlockParse.call(this, hasStrictModeDirective);
    }

    if (!oldStrict) {
      this.setStrict(false);
    }

    this.next();
  }

  parseStatement(context: string, topLevel?: boolean): N.Statement {
    return this.parseStatementContent(context, topLevel);
  }

  parseStatementContent(context: string, topLevel?: boolean): N.Statement {
    let starttype = this.state.type;
    const node = this.startNode();
    let kind;

    if (this.isLet(context)) {
      starttype = tt._var;
      kind = "let";
    }

    // Most types of statements are recognized by the keyword they
    // start with. Many are trivial to parse, some require a bit of
    // complexity.

    switch (starttype) {
      case tt._break:
        return this.parseBreakContinueStatement(
          <N.BreakStatement>node,
          /* isBreak */ true
        );
      case tt._continue:
        return this.parseBreakContinueStatement(
          <N.ContinueStatement>node,
          /* isBreak */ false
        );
      case tt._debugger:
        return this.parseDebuggerStatement(<N.DebuggerStatement>node);
      case tt._do:
        return this.parseDoStatement(node);
      case tt._for:
        return this.parseForStatement(node);
      case tt._function:
        if (this.lookaheadCharCode() === charCodes.dot) break;
        if (context) {
          if (this.state.strict) {
            this.raise(Errors.StrictFunction, { at: this.state.startLoc });
          } else if (context !== "if" && context !== "label") {
            this.raise(Errors.SloppyFunction, { at: this.state.startLoc });
          }
        }
        return this.parseFunctionStatement(node, false, !context);

      case tt._class:
        if (context) this.unexpected();
        return this.parseClass(node, true);

      case tt._if:
        return this.parseIfStatement(node);
      case tt._return:
        return this.parseReturnStatement(node);
      case tt._switch:
        return this.parseSwitchStatement(node);
      case tt._throw:
        return this.parseThrowStatement(node);
      case tt._try:
        return this.parseTryStatement(node);

      case tt._const:
      case tt._var:
        kind = kind || this.state.value;
        if (context && kind !== "var") {
          this.raise(Errors.UnexpectedLexicalDeclaration, {
            at: this.state.startLoc,
          });
        }
        return this.parseVarStatement(node, kind);

      case tt._while:
        return this.parseWhileStatement(node);
      case tt._with:
        return this.parseWithStatement(node);
      case tt.braceL:
        return this.parseBlock();
      case tt.semi:
        return this.parseEmptyStatement(node);
      case tt._import: {
        const nextTokenCharCode = this.lookaheadCharCode();
        if (
          nextTokenCharCode === charCodes.leftParenthesis || // import()
          nextTokenCharCode === charCodes.dot // import.meta
        ) {
          break;
        }
      }
      // fall through
      case tt._export: {
        if (!this.options.allowImportExportEverywhere && !topLevel) {
          this.raise(Errors.UnexpectedImportExport, {
            at: this.state.startLoc,
          });
        }

        this.next(); // eat `import`/`export`

        let result;
        if (starttype === tt._import) {
          result = this.parseImport(node);

          if (
            result.type === "ImportDeclaration" &&
            (!result.importKind || result.importKind === "value")
          ) {
            this.sawUnambiguousESM = true;
          }
        } else {
          result = this.parseExport(node);

          if (
            (result.type === "ExportNamedDeclaration" &&
              (!result.exportKind || result.exportKind === "value")) ||
            (result.type === "ExportAllDeclaration" &&
              (!result.exportKind || result.exportKind === "value")) ||
            result.type === "ExportDefaultDeclaration"
          ) {
            this.sawUnambiguousESM = true;
          }
        }

        this.assertModuleNodeAllowed(node);

        return result;
      }

      default: {
        if (this.isAsyncFunction()) {
          if (context) {
            this.raise(Errors.AsyncFunctionInSingleStatementContext, {
              at: this.state.startLoc,
            });
          }
          this.next();
          return this.parseFunctionStatement(node, true, !context);
        }
      }
    }

    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
    const maybeName = this.state.value;
    const expr = this.parseExpression();

    if (
      tokenIsIdentifier(starttype) &&
      expr.type === "Identifier" &&
      this.eat(tt.colon)
    ) {
      return this.parseLabeledStatement(node, maybeName, expr, context);
    } else {
      return this.parseExpressionStatement(node, expr);
    }
  }

  isLet(context?: string): boolean {
    if (!this.isContextual(tt._let)) {
      return false;
    }
    return this.isLetKeyword(context);
  }

  /**
   * Assuming we have seen a contextual `let`, check if it starts a variable declaration
    so that `left` should be interpreted as a `let` keyword.
   *
   * @param {string} context When `context` is non nullish, it will return early and _skip_ checking
                              if the next token after `let` is `{` or a keyword relational operator
   * @returns {boolean}
   * @memberof StatementParser
   */
  isLetKeyword(context?: string): boolean {
    const next = this.nextTokenStart();
    const nextCh = this.codePointAtPos(next);
    // For ambiguous cases, determine if a LexicalDeclaration (or only a
    // Statement) is allowed here. If context is not empty then only a Statement
    // is allowed. However, `let [` is an explicit negative lookahead for
    // ExpressionStatement, so special-case it first.
    // Also, `let \` is never valid as an expression so this must be a keyword.
    if (
      nextCh === charCodes.backslash ||
      nextCh === charCodes.leftSquareBracket
    ) {
      return true;
    }
    if (context) {
      return false;
    }

    if (nextCh === charCodes.leftCurlyBrace) return true;

    if (isIdentifierStart(nextCh)) {
      keywordRelationalOperator.lastIndex = next;
      if (keywordRelationalOperator.test(this.input)) {
        // We have seen `in` or `instanceof` so far, now check if the identfier
        // ends here
        const endCh = this.codePointAtPos(keywordRelationalOperator.lastIndex);
        if (!isIdentifierChar(endCh) && endCh !== charCodes.backslash) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  parseBreakContinueStatement(
    node: N.BreakStatement | N.ContinueStatement,
    isBreak: boolean
  ): N.BreakStatement | N.ContinueStatement {
    this.next();

    if (this.isLineTerminator()) {
      node.label = null;
    } else {
      node.label = this.parseIdentifier();
      this.semicolon();
    }

    this.verifyBreakContinue(node, isBreak);

    return this.finishNode(
      node,
      isBreak ? "BreakStatement" : "ContinueStatement"
    );
  }

  verifyBreakContinue(
    node: N.BreakStatement | N.ContinueStatement,
    isBreak: boolean
  ) {
    let i;
    for (i = 0; i < this.state.labels.length; ++i) {
      const lab = this.state.labels[i];
      if (node.label == null || lab.name === node.label.name) {
        if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
        if (node.label && isBreak) break;
      }
    }
  }

  parseDebuggerStatement(node: N.DebuggerStatement): N.DebuggerStatement {
    this.next();
    this.semicolon();
    return this.finishNode<N.DebuggerStatement>(node, "DebuggerStatement");
  }

  parseDoStatement(node: N.DoWhileStatement): N.DoWhileStatement {
    this.next();
    this.state.labels.push(loopLabel);

    // Parse the loop body's body.
    node.body =
      // For the smartPipelines plugin: Disable topic references from outer
      // contexts within the loop body. They are permitted in test expressions,
      // outside of the loop body.
      this.withSmartMixTopicForbiddingContext(() =>
        // Parse the loop body's body.
        this.parseStatement("do")
      );

    this.state.labels.pop();

    this.expect(tt._while);
    node.test = this.parseHeaderExpression();
    this.eat(tt.semi);
    return this.finishNode<N.DoWhileStatement>(node, "DoWhileStatement");
  }

  parseHeaderExpression(): N.Expression {
    this.expect(tt.parenL);
    const val = this.parseExpression();
    this.expect(tt.parenR);
    return val;
  }
}
