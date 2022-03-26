import LValParser from "./lval";
import * as N from "../types";
import {
  tokenIsIdentifier,
  tokenIsKeywordOrIdentifier,
  tokenIsPrefix,
  tokenKeywordOrIdentifierIsKeyword,
  tt,
} from "../token/types";
import { canBeReservedWord } from "../util/identifier";
import { Position } from "../util/location";

export default class ExpressionParser extends LValParser {
  parseIdentifier(liberal?: boolean): N.Identifier {
    const node = this.startNode<N.Identifier>();
    const name = this.parseIdentifierName(liberal);

    return this.createIdentifier(node, name);
  }

  parseIdentifierName(liberal?: boolean): string {
    let name: string;

    const { type } = this.state;

    if (tokenIsKeywordOrIdentifier(type)) {
      name = this.state.value;
    }

    const tokenIsKeyword = tokenKeywordOrIdentifierIsKeyword(type);

    if (liberal) {
      // If the current token is not used as a keyword, set its type to "tt.name".
      // This will prevent this.next() from throwing about unexpected escapes.
      if (tokenIsKeyword) {
        this.replaceToken(tt.name);
      }
    } else {
      this.checkReservedWord(name);
    }

    this.next();

    return name;
  }

  checkReservedWord(word: string): void {
    // Every JavaScript reserved word is 10 characters or less.
    if (word.length > 10) {
      return;
    }
    // Most identifiers are not reservedWord-like, they don't need special
    // treatments afterward, which very likely ends up throwing errors
    if (!canBeReservedWord(word)) {
      return;
    }
  }

  createIdentifier(node: N.Identifier, name: string): N.Identifier {
    node.name = name;
    node.loc.identifierName = name;

    return this.finishNode<N.Identifier>(node, "Identifier");
  }

  parseExpression(): N.Expression {
    this.parseExpressionBase();
  }

  disallowInAnd<T>(callback: () => T): T {
    return callback();
  }

  // https://tc39.es/ecma262/#prod-Expression
  parseExpressionBase(): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const expr = this.parseMaybeAssign();
    if (this.match(tt.comma)) {
      const node = this.startNodeAt(startPos, startLoc);
      node.expressions = [expr];
      while (this.eat(tt.comma)) {
        node.expressions.push(this.parseMaybeAssign());
      }
      this.toReferencedList(node.expressions);
      return this.finishNode(node, "SequenceExpression");
    }
    return expr;
  }

  // Parse an assignment expression. This includes applications of
  // operators like `+=`.
  // https://tc39.es/ecma262/#prod-AssignmentExpression
  parseMaybeAssign(afterLeftParse?: Function): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;

    const { type } = this.state;

    if (type === tt.parenL || tokenIsIdentifier(type)) {
      this.state.potentialArrowAt = this.state.start;
    }

    let left = this.parseMaybeConditional();
    if (afterLeftParse) {
      left = afterLeftParse.call(this, left, startPos, startLoc);
    }
    if (tokenIsAssignment(this.state.type)) {
      const node = this.startNodeAt(startPos, startLoc);
      const operator = this.state.value;
      node.operator = operator;

      if (this.match(tt.eq)) {
        node.left = this.toAssignable(left, /* isLHS */ true);

        if (
          refExpressionErrors.doubleProtoLoc != null &&
          refExpressionErrors.doubleProtoLoc.index >= startPos
        ) {
          refExpressionErrors.doubleProtoLoc = null; // reset because double __proto__ is valid in assignment expression
        }
        if (
          refExpressionErrors.shorthandAssignLoc != null &&
          refExpressionErrors.shorthandAssignLoc.index >= startPos
        ) {
          refExpressionErrors.shorthandAssignLoc = null; // reset because shorthand default was used correctly
        }
        if (
          refExpressionErrors.privateKeyLoc != null &&
          refExpressionErrors.privateKeyLoc.index >= startPos
        ) {
          this.checkDestructuringPrivate(refExpressionErrors);
          refExpressionErrors.privateKeyLoc = null; // reset because `({ #x: x })` is an assignable pattern
        }
      } else {
        node.left = left;
      }

      this.next();
      node.right = this.parseMaybeAssign();
      this.checkLVal(left, {
        in: this.finishNode(node, "AssignmentExpression"),
      });
      return node;
    } else if (ownExpressionErrors) {
      this.checkExpressionErrors(refExpressionErrors, true);
    }

    return left;
  }

  // Parse a ternary conditional (`?:`) operator.
  // https://tc39.es/ecma262/#prod-ConditionalExpression
  parseMaybeConditional(): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseExprOps(refExpressionErrors);

    if (this.shouldExitDescending(expr, potentialArrowAt)) {
      return expr;
    }

    return this.parseConditional(expr, startPos, startLoc);
  }

  // Start the precedence parser.
  // https://tc39.es/ecma262/#prod-ShortCircuitExpression

  parseExprOps(): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseMaybeUnaryOrPrivate();

    if (this.shouldExitDescending(expr, potentialArrowAt)) {
      return expr;
    }

    return this.parseExprOp(expr, startPos, startLoc, -1);
  }

  parseMaybeUnaryOrPrivate(): N.Expression | N.PrivateName {
    return this.match(tt.privateName)
      ? this.parsePrivateName()
      : this.parseMaybeUnary();
  }

  parsePrivateName(): N.PrivateName {
    const node = this.startNode<N.PrivateName>();
    const id = this.startNodeAt<N.Identifier>(
      this.state.start + 1,
      // The position is hardcoded because we merge `#` and name into a single
      // tt.privateName token
      new Position(
        this.state.curLine,
        this.state.start + 1 - this.state.lineStart,
        this.state.start + 1
      )
    );
    const name = this.state.value;
    this.next(); // eat #name;
    node.id = this.createIdentifier(id, name);
    return this.finishNode<N.PrivateName>(node, "PrivateName");
  }

  // Parse unary operators, both prefix and postfix.
  // https://tc39.es/ecma262/#prod-UnaryExpression
  parseMaybeUnary(): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const isAwait = this.isContextual(tt._await);

    const update = this.match(tt.incDec);
    const node = this.startNode<N.UnaryExpression>();
    if (tokenIsPrefix(this.state.type)) {
      node.operator = this.state.value;
      node.prefix = true;
      this.next();

      node.argument = this.parseMaybeUnary();

      if (!update) {
        return this.finishNode<N.UnaryExpression>(node, "UnaryExpression");
      }
    }

    const expr = this.parseUpdate(node, update);

    if (isAwait) {
      const { type } = this.state;
      const startsExpr = this.hasPlugin("v8intrinsic")
        ? tokenCanStartExpression(type)
        : tokenCanStartExpression(type) && !this.match(tt.modulo);
      if (startsExpr && !this.isAmbiguousAwait()) {
        this.raiseOverwrite(Errors.AwaitNotInAsyncContext, { at: startLoc });
        return this.parseAwait(startPos, startLoc);
      }
    }

    return expr;
  }

  // https://tc39.es/ecma262/#prod-UpdateExpression
  parseUpdate(node: N.Expression, update: boolean): N.Expression {
    if (update) {
      return node;
    }

    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    let expr = this.parseExprSubscripts();
    if (this.checkExpressionErrors(refExpressionErrors, false)) return expr;
    while (tokenIsPostfix(this.state.type) && !this.canInsertSemicolon()) {
      const node = this.startNodeAt(startPos, startLoc);
      node.operator = this.state.value;
      node.prefix = false;
      node.argument = expr;
      this.next();
      this.checkLVal(expr, {
        in: (expr = this.finishNode(node, "UpdateExpression")),
      });
    }
    return expr;
  }

  // Parse call, dot, and `[]`-subscript expressions.
  // https://tc39.es/ecma262/#prod-LeftHandSideExpression
  parseExprSubscripts(): N.Expression {
    const startPos = this.state.start;
    const startLoc = this.state.startLoc;
    const potentialArrowAt = this.state.potentialArrowAt;
    const expr = this.parseExprAtom();

    if (this.shouldExitDescending(expr, potentialArrowAt)) {
      return expr;
    }

    return this.parseSubscripts(expr, startPos, startLoc);
  }

  // Parse an atomic expression — either a single token that is an
  // expression, an expression started by a keyword like `function` or
  // `new`, or an expression wrapped in punctuation like `()`, `[]`,
  // or `{}`.

  // https://tc39.es/ecma262/#prod-PrimaryExpression
  // https://tc39.es/ecma262/#prod-AsyncArrowFunction
  // PrimaryExpression
  // Super
  // Import
  // AsyncArrowFunction

  parseExprAtom(): N.Expression {
    let node;

    const { type } = this.state;
    switch (type) {
      case tt._super:
        return this.parseSuper();
      case tt._this:
        node = this.startNode<N.ThisExpression>();
        this.next();
        return this.finishNode(node, "ThisExpression");

      case tt.num:
        return this.parseNumericLiteral(this.state.value);

      case tt.bigint:
        return this.parseBigIntLiteral(this.state.value);

      case tt.decimal:
        return this.parseDecimalLiteral(this.state.value);

      case tt.string:
        return this.parseStringLiteral(this.state.value);

      case tt._null:
        return this.parseNullLiteral();

      case tt._true:
        return this.parseBooleanLiteral(true);
      case tt._false:
        return this.parseBooleanLiteral(false);

      case tt._function:
        return this.parseFunction();

      case tt._class:
        node = this.startNode();
        this.takeDecorators(node);
        return this.parseClass(node, false);

      case tt._new:
        return this.parseNewOrNewTarget();

      case tt.templateNonTail:
      case tt.templateTail:
        return this.parseTemplate(false);

      // BindExpression[Yield]
      //   :: MemberExpression[?Yield]
      case tt.doubleColon: {
        node = this.startNode();
        this.next();
        node.object = null;
        const callee = (node.callee = this.parseNoCallExpr());
        if (callee.type === "MemberExpression") {
          return this.finishNode(node, "BindExpression");
        } else {
          throw this.raise(Errors.UnsupportedBind, { at: callee });
        }
      }

      case tt.privateName: {
        // Standalone private names are only allowed in "#x in obj"
        // expressions, and they are directly handled by callers of
        // parseExprOp. If we reach this, the input is always invalid.
        // We can throw a better error message and recover, rather than
        // just throwing "Unexpected token" (which is the default
        // behavior of this big switch statement).
        this.raise(Errors.PrivateInExpectedIn, {
          at: this.state.startLoc,
          identifierName: this.state.value,
        });
        return this.parsePrivateName();
      }

      case tt.moduloAssign: {
        return this.parseTopicReferenceThenEqualsSign(tt.modulo, "%");
      }

      case tt.xorAssign: {
        return this.parseTopicReferenceThenEqualsSign(tt.bitwiseXOR, "^");
      }

      case tt.doubleCaret:
      case tt.doubleAt: {
        return this.parseTopicReference("hack");
      }

      case tt.bitwiseXOR:
      case tt.modulo:
      case tt.hash: {
        const pipeProposal = this.getPluginOption(
          "pipelineOperator",
          "proposal"
        );

        if (pipeProposal) {
          return this.parseTopicReference(pipeProposal);
        } else {
          throw this.unexpected();
        }
      }

      case tt.lt: {
        const lookaheadCh = this.input.codePointAt(this.nextTokenStart());
        if (
          isIdentifierStart(lookaheadCh) || // Element/Type Parameter <foo>
          lookaheadCh === charCodes.greaterThan // Fragment <>
        ) {
          this.expectOnePlugin(["jsx", "flow", "typescript"]);
          break;
        } else {
          throw this.unexpected();
        }
      }

      default:
        if (tokenIsIdentifier(type)) {
          if (
            this.isContextual(tt._module) &&
            this.lookaheadCharCode() === charCodes.leftCurlyBrace &&
            !this.hasFollowingLineBreak()
          ) {
            return this.parseModuleExpression();
          }
          const canBeArrow = this.state.potentialArrowAt === this.state.start;
          const containsEsc = this.state.containsEsc;
          const id = this.parseIdentifier();

          if (
            !containsEsc &&
            id.name === "async" &&
            !this.canInsertSemicolon()
          ) {
            const { type } = this.state;
            if (type === tt._function) {
              this.resetPreviousNodeTrailingComments(id);
              this.next();
              return this.parseFunction(
                this.startNodeAtNode(id),
                undefined,
                true
              );
            } else if (tokenIsIdentifier(type)) {
              // If the next token begins with "=", commit to parsing an async
              // arrow function. (Peeking ahead for "=" lets us avoid a more
              // expensive full-token lookahead on this common path.)
              if (this.lookaheadCharCode() === charCodes.equalsTo) {
                // although `id` is not used in async arrow unary function,
                // we don't need to reset `async`'s trailing comments because
                // it will be attached to the upcoming async arrow binding identifier
                return this.parseAsyncArrowUnaryFunction(
                  this.startNodeAtNode(id)
                );
              } else {
                // Otherwise, treat "async" as an identifier and let calling code
                // deal with the current tt.name token.
                return id;
              }
            } else if (type === tt._do) {
              this.resetPreviousNodeTrailingComments(id);
              return this.parseDo(this.startNodeAtNode(id), true);
            }
          }

          if (
            canBeArrow &&
            this.match(tt.arrow) &&
            !this.canInsertSemicolon()
          ) {
            this.next();
            return this.parseArrowExpression(
              this.startNodeAtNode(id),
              [id],
              false
            );
          }

          return id;
        }
    }
  }

  // Parse the `super` keyword
  parseSuper(): N.Super {
    const node = this.startNode<N.Super>();
    this.next(); // eat `super`
    return this.finishNode(node, "Super");
  }

  parseNumericLiteral(value: any) {
    return this.parseLiteral<N.NumericLiteral>(value, "NumericLiteral");
  }

  parseLiteral<T extends N.NodeBase>(value: any, type: string): T {
    const node = this.startNode();
    return this.parseLiteralAtNode<T>(value, type, node);
  }

  parseLiteralAtNode<T extends N.NodeBase>(
    value: any,
    type: string,
    node: any
  ): T {
    this.addExtra(node, "rawValue", value);
    this.addExtra(node, "raw", this.input.slice(node.start, this.state.end));
    node.value = value;
    this.next();
    return this.finishNode(node, type);
  }

  parseBigIntLiteral(value: any) {
    return this.parseLiteral<N.BigIntLiteral>(value, "BigIntLiteral");
  }

  parseDecimalLiteral(value: any) {
    return this.parseLiteral<N.DecimalLiteral>(value, "DecimalLiteral");
  }

  parseStringLiteral(value: any) {
    return this.parseLiteral<N.StringLiteral>(value, "StringLiteral");
  }

  parseNullLiteral() {
    const node = this.startNode() as any;
    this.next();
    return this.finishNode<N.NullLiteral>(node, "NullLiteral");
  }

  parseBooleanLiteral(value: boolean) {
    const node = this.startNode<N.BooleanLiteral>();
    node.value = value;
    this.next();
    return this.finishNode<N.BooleanLiteral>(node, "BooleanLiteral");
  }

  parseFunction() {
    const node = this.startNode();
    // We do not do parseIdentifier here because when parseFunctionOrFunctionSent
    // is called we already know that the current token is a "name" with the value "function"
    // This will improve perf a tiny little bit as we do not do validation but more importantly
    // here is that parseIdentifier will remove an item from the expression stack
    // if "function" or "class" is parsed as identifier (in objects e.g.), which should not happen here.
    this.next(); // eat `function`
    return this.parseFunction(node);
  }

  parseFunction<T: N.NormalFunction>(
    node: T,
    statement?: number = FUNC_NO_FLAGS,
    isAsync?: boolean = false,
  ): T {
    const isStatement = statement & FUNC_STATEMENT;
    const isHangingStatement = statement & FUNC_HANGING_STATEMENT;
    const requireId = !!isStatement && !(statement & FUNC_NULLABLE_ID);

    this.initFunction(node, isAsync);

    if (this.match(tt.star) && isHangingStatement) {
      this.raise(Errors.GeneratorInSingleStatementContext, {
        at: this.state.startLoc,
      });
    }
    node.generator = this.eat(tt.star);

    if (isStatement) {
      node.id = this.parseFunctionId(requireId);
    }

    const oldMaybeInArrowParameters = this.state.maybeInArrowParameters;
    this.state.maybeInArrowParameters = false;
    this.scope.enter(SCOPE_FUNCTION);
    this.prodParam.enter(functionFlags(isAsync, node.generator));

    if (!isStatement) {
      node.id = this.parseFunctionId();
    }

    this.parseFunctionParams(node, /* allowModifiers */ false);

    // For the smartPipelines plugin: Disable topic references from outer
    // contexts within the function body. They are permitted in function
    // default-parameter expressions, outside of the function body.
    this.withSmartMixTopicForbiddingContext(() => {
      // Parse the function body.
      this.parseFunctionBodyAndFinish(
        node,
        isStatement ? "FunctionDeclaration" : "FunctionExpression",
      );
    });

    this.prodParam.exit();
    this.scope.exit();

    if (isStatement && !isHangingStatement) {
      // We need to register this _after_ parsing the function body
      // because of TypeScript body-less function declarations,
      // which shouldn't be added to the scope.
      this.registerFunctionStatementId(node);
    }

    this.state.maybeInArrowParameters = oldMaybeInArrowParameters;
    return node;
  }
}
