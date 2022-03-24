import CommentsParser from "../parser/comments";
import {
  SourceLocation,
  createPositionWithColumnOffset,
} from "../util/location";
import State from "./state";
import {
  TokenType,
  tt,
  keywords as keywordTypes,
  tokenLabelName,
} from "./types";
import * as N from "../types";
import * as charCodes from "charcodes";
import { CommentWhitespace } from "../parser/comments";
import {
  lineBreakG,
  isNewLine,
  isWhitespace,
  skipWhiteSpace,
} from "../util/whitespace";
import { isIdentifierStart, isIdentifierChar } from "../util/identifier";
export class Token {
  constructor(state: State) {
    this.type = state.type;
    this.value = state.value;
    this.start = state.start;
    this.end = state.end;
    this.loc = new SourceLocation(state.startLoc, state.endLoc);
  }

  public type: TokenType;
  public value: any;
  public start: number;
  public end: number;
  public loc: SourceLocation;
}
export default class Tokenizer extends CommentsParser {
  public isLookahead: boolean;
  public tokens: Array<Token | N.Comment> = [];
  constructor(input: string) {
    super();
    this.state = new State();
    this.input = input;
    this.length = input.length;
    this.isLookahead = false;
  }

  public nextToken(): void {
    this.skipSpace();
    this.state.start = this.state.pos;
    if (!this.isLookahead) {
      this.state.startLoc = this.state.curPosition();
    }
    if (this.state.pos >= this.length) {
      this.finishToken(tt.eof);
      return;
    }

    this.getTokenFromCode(this.codePointAtPos(this.state.pos));
  }

  getTokenFromCode(code: number): void {
    switch (code) {
      // The interpretation of a dot depends on whether it is followed
      // by a digit or another two dots.

      case charCodes.dot:
        this.readToken_dot();
        return;

      // Punctuation tokens.
      case charCodes.leftParenthesis:
        ++this.state.pos;
        this.finishToken(tt.parenL);
        return;
      case charCodes.rightParenthesis:
        ++this.state.pos;
        this.finishToken(tt.parenR);
        return;
      case charCodes.semicolon:
        ++this.state.pos;
        this.finishToken(tt.semi);
        return;
      case charCodes.comma:
        ++this.state.pos;
        this.finishToken(tt.comma);
        return;
      case charCodes.leftSquareBracket:
        ++this.state.pos;
        this.finishToken(tt.bracketL);
        return;
      case charCodes.rightSquareBracket:
        ++this.state.pos;
        this.finishToken(tt.bracketR);
        return;
      case charCodes.leftCurlyBrace:
        ++this.state.pos;
        this.finishToken(tt.braceL);
        return;
      case charCodes.rightCurlyBrace:
        ++this.state.pos;
        this.finishToken(tt.braceR);
        return;

      case charCodes.colon:
        ++this.state.pos;
        this.finishToken(tt.colon);
        return;
      case charCodes.questionMark:
        this.readToken_question();
        return;

      case charCodes.graveAccent:
        this.readTemplateToken();
        return;

      case charCodes.digit0: {
        const next = this.input.charCodeAt(this.state.pos + 1);
        // '0x', '0X' - hex number
        if (next === charCodes.lowercaseX || next === charCodes.uppercaseX) {
          this.readRadixNumber(16);
          return;
        }
        // '0o', '0O' - octal number
        if (next === charCodes.lowercaseO || next === charCodes.uppercaseO) {
          this.readRadixNumber(8);
          return;
        }
        // '0b', '0B' - binary number
        if (next === charCodes.lowercaseB || next === charCodes.uppercaseB) {
          this.readRadixNumber(2);
          return;
        }
      }
      // Anything else beginning with a digit is an integer, octal
      // number, or float. (fall through)
      case charCodes.digit1:
      case charCodes.digit2:
      case charCodes.digit3:
      case charCodes.digit4:
      case charCodes.digit5:
      case charCodes.digit6:
      case charCodes.digit7:
      case charCodes.digit8:
      case charCodes.digit9:
        this.readNumber();
        return;

      // Quotes produce strings.
      case charCodes.quotationMark:
      case charCodes.apostrophe:
        this.readString(code);
        return;

      // Operators are parsed inline in tiny state machines. '=' (charCodes.equalsTo) is
      // often referred to. `finishOp` simply skips the amount of
      // characters it is given as second argument, and returns a token
      // of the type given by its first argument.

      case charCodes.slash:
        this.readToken_slash();
        return;

      case charCodes.percentSign:
      case charCodes.asterisk:
        this.readToken_mult_modulo(code);
        return;

      case charCodes.verticalBar:
      case charCodes.ampersand:
        this.readToken_pipe_amp(code);
        return;

      case charCodes.caret:
        this.readToken_caret();
        return;

      case charCodes.plusSign:
      case charCodes.dash:
        this.readToken_plus_min(code);
        return;

      case charCodes.lessThan:
        this.readToken_lt();
        return;

      case charCodes.greaterThan:
        this.readToken_gt();
        return;

      case charCodes.equalsTo:
      case charCodes.exclamationMark:
        this.readToken_eq_excl(code);
        return;

      case charCodes.tilde:
        this.finishOp(tt.tilde, 1);
        return;

      case charCodes.atSign:
        this.readToken_atSign();
        return;

      case charCodes.numberSign:
        this.readToken_numberSign();
        return;

      case charCodes.backslash:
        this.readWord();
        return;

      default:
        if (isIdentifierStart(code)) {
          this.readWord(code);
          return;
        }
    }
  }

  next(): void {
    this.state.lastTokStart = this.state.start;
    this.state.lastTokEndLoc = this.state.endLoc;
    this.state.lastTokStartLoc = this.state.startLoc;
    this.nextToken();
  }

  match(type: TokenType): boolean {
    return this.state.type === type;
  }

  readToken_dot(): void {
    const next = this.input.charCodeAt(this.state.pos + 1);
    if (next >= charCodes.digit0 && next <= charCodes.digit9) {
      this.readNumber();
      return;
    }

    if (
      next === charCodes.dot &&
      this.input.charCodeAt(this.state.pos + 2) === charCodes.dot
    ) {
      this.state.pos += 3;
      this.finishToken(tt.ellipsis);
    } else {
      ++this.state.pos;
      this.finishToken(tt.dot);
    }
  }

  public finishToken(type: TokenType, val?: any): void {
    this.state.end = this.state.pos;
    this.state.endLoc = this.state.curPosition();
    this.state.type = type;
    this.state.value = val;
  }

  private skipSpace(): void {
    const spaceStart = this.state.pos;
    const comments: Array<N.Comment> = [];
    loop: while (this.state.pos < this.length) {
      const ch = this.input.charCodeAt(this.state.pos);
      switch (ch) {
        case charCodes.space:
        case charCodes.nonBreakingSpace:
        case charCodes.tab:
          ++this.state.pos;
          break;
        case charCodes.carriageReturn:
          if (
            this.input.charCodeAt(this.state.pos + 1) === charCodes.lineFeed
          ) {
            ++this.state.pos;
          }
        // fall through
        case charCodes.lineFeed:
        case charCodes.lineSeparator:
        case charCodes.paragraphSeparator:
          ++this.state.pos;
          ++this.state.curLine;
          this.state.lineStart = this.state.pos;
          break;

        case charCodes.slash:
          switch (this.input.charCodeAt(this.state.pos + 1)) {
            case charCodes.asterisk: {
              const comment = this.skipBlockComment();
              if (comment !== undefined) {
                this.addComment(<N.CommentBlock>comment);
              }
              break;
            }

            case charCodes.slash: {
              const comment = this.skipLineComment(2);
              if (comment !== undefined) {
                this.addComment(<N.CommentLine>comment);
              }
              break;
            }

            default:
              break loop;
          }
          break;

        default:
          if (isWhitespace(ch)) {
            ++this.state.pos;
          } else if (ch === charCodes.dash) {
            const pos = this.state.pos;
            if (
              this.input.charCodeAt(pos + 1) === charCodes.dash &&
              this.input.charCodeAt(pos + 2) === charCodes.greaterThan &&
              (spaceStart === 0 || this.state.lineStart > spaceStart)
            ) {
              // A `-->` line comment
              const comment = this.skipLineComment(3);
              if (comment !== undefined) {
                this.addComment(<N.CommentLine>comment);
              }
            } else {
              break loop;
            }
          } else if (ch === charCodes.lessThan) {
            const pos = this.state.pos;
            if (
              this.input.charCodeAt(pos + 1) === charCodes.exclamationMark &&
              this.input.charCodeAt(pos + 2) === charCodes.dash &&
              this.input.charCodeAt(pos + 3) === charCodes.dash
            ) {
              // `<!--`, an XML-style comment that should be interpreted as a line comment
              const comment = this.skipLineComment(4);
              if (comment !== undefined) {
                this.addComment(<N.CommentLine>comment);
              }
            } else {
              break loop;
            }
          } else {
            break loop;
          }
      }
    }

    if (comments.length > 0) {
      const end = this.state.pos;
      const CommentWhitespace: CommentWhitespace = {
        start: spaceStart,
        end,
        comments,
        leadingNode: null,
        trailingNode: null,
        containingNode: null,
      };
      this.state.commentStack.push(CommentWhitespace);
    }
  }

  // Called at the start of the parse and after every token. Skips
  // whitespace and comments, and.

  private skipBlockComment(): N.CommentBlock | void {
    let startLoc;
    if (!this.isLookahead) startLoc = this.state.curPosition();
    const start = this.state.pos;
    const end = this.input.indexOf("*/", start + 2);

    this.state.pos = end + 2;
    lineBreakG.lastIndex = start + 2;
    while (lineBreakG.test(this.input) && lineBreakG.lastIndex <= end) {
      ++this.state.curLine;
      this.state.lineStart = lineBreakG.lastIndex;
    }

    // If we are doing a lookahead right now we need to advance the position (above code)
    // but we do not want to push the comment to the state.
    if (this.isLookahead) {
      return;
    }
    /*:: invariant(startLoc) */

    const comment: N.CommentBlock = {
      type: "CommentBlock",
      value: this.input.slice(start + 2, end),
      start,
      end: end + 2,
      loc: new SourceLocation(startLoc, this.state.curPosition()),
    };
    return comment;
  }

  private skipLineComment(startSkip: number): N.CommentLine | void {
    const start = this.state.pos;
    let startLoc;
    if (!this.isLookahead) startLoc = this.state.curPosition();
    let ch = this.input.charCodeAt((this.state.pos += startSkip));
    if (this.state.pos < this.length) {
      while (!isNewLine(ch) && ++this.state.pos < this.length) {
        ch = this.input.charCodeAt(this.state.pos);
      }
    }

    // If we are doing a lookahead right now we need to advance the position (above code)
    // but we do not want to push the comment to the state.
    if (this.isLookahead) return;
    /*:: invariant(startLoc) */

    const end = this.state.pos;
    const value = this.input.slice(start + startSkip, end);

    const comment: N.CommentLine = {
      type: "CommentLine",
      value,
      start,
      end,
      loc: new SourceLocation(startLoc, this.state.curPosition()),
    };
    return comment;
  }

  readNumber(): void {
    const start = this.state.pos;
    let isBigInt = false;
    let isDecimal = false;
    let isOctal = false;

    const hasLeadingZero =
      this.state.pos - start >= 2 &&
      this.input.charCodeAt(start) === charCodes.digit0;

    if (hasLeadingZero) {
      const integer = this.input.slice(start, this.state.pos);
      isOctal = hasLeadingZero && !/[89]/.test(integer);
    }

    let next = this.input.charCodeAt(this.state.pos);
    if (next === charCodes.dot && !isOctal) {
      ++this.state.pos;
      this.readInt(10);
      next = this.input.charCodeAt(this.state.pos);
    }

    if (
      (next === charCodes.uppercaseE || next === charCodes.lowercaseE) &&
      !isOctal
    ) {
      next = this.input.charCodeAt(++this.state.pos);
      if (next === charCodes.plusSign || next === charCodes.dash) {
        ++this.state.pos;
      }
      next = this.input.charCodeAt(this.state.pos);
    }

    if (next === charCodes.lowercaseN) {
      // disallow floats, legacy octal syntax and non octal decimals
      // new style octal ("0o") is handled in this.readRadixNumber
      ++this.state.pos;
      isBigInt = true;
    }

    // remove "_" for numeric literal separator, and trailing `m` or `n`
    const str = this.input.slice(start, this.state.pos).replace(/[_mn]/g, "");

    if (isBigInt) {
      this.finishToken(tt.bigint, str);
      return;
    }

    if (isDecimal) {
      this.finishToken(tt.decimal, str);
      return;
    }

    const val = isOctal ? parseInt(str, 8) : parseFloat(str);
    this.finishToken(tt.num, val);
  }

  readInt(
    radix: number,
    len?: number,
    allowNumSeparator: boolean | "bail" = true
  ): number | null {
    const start = this.state.pos;
    let total = 0;

    for (let i = 0, e = len == null ? Infinity : len; i < e; ++i) {
      const code = this.input.charCodeAt(this.state.pos);
      let val;

      if (code === charCodes.underscore && allowNumSeparator !== "bail") {
        ++this.state.pos;
        continue;
      }

      if (code >= charCodes.lowercaseA) {
        val = code - charCodes.lowercaseA + charCodes.lineFeed;
      } else if (code >= charCodes.uppercaseA) {
        val = code - charCodes.uppercaseA + charCodes.lineFeed;
      } else if (charCodes.isDigit(code)) {
        val = code - charCodes.digit0; // 0-9
      } else {
        val = Infinity;
      }
      ++this.state.pos;
      total = total * radix + val;
    }
    if (
      this.state.pos === start ||
      (len != null && this.state.pos - start !== len)
    ) {
      return null;
    }

    return total;
  }

  public readToken_question(): void {
    // '?'
    const next = this.input.charCodeAt(this.state.pos + 1);
    const next2 = this.input.charCodeAt(this.state.pos + 2);
    if (next === charCodes.questionMark) {
      if (next2 === charCodes.equalsTo) {
        // '??='
        this.finishOp(tt.assign, 3);
      } else {
        // '??'
        this.finishOp(tt.nullishCoalescing, 2);
      }
    } else if (
      next === charCodes.dot &&
      !(next2 >= charCodes.digit0 && next2 <= charCodes.digit9)
    ) {
      // '.' not followed by a number
      this.state.pos += 2;
      this.finishToken(tt.questionDot);
    } else {
      ++this.state.pos;
      this.finishToken(tt.question);
    }
  }

  public finishOp(type: TokenType, size: number): void {
    const str = this.input.slice(this.state.pos, this.state.pos + size);
    this.state.pos += size;
    this.finishToken(type, str);
  }

  public readTemplateToken(): void {
    let out = "",
      chunkStart = this.state.pos,
      containsInvalid = false;
    ++this.state.pos; // eat '`' or `}`
    for (;;) {
      const ch = this.input.charCodeAt(this.state.pos);
      if (ch === charCodes.graveAccent) {
        ++this.state.pos; // eat '`'
        out += this.input.slice(chunkStart, this.state.pos);
        this.finishToken(tt.templateTail, containsInvalid ? null : out);
        return;
      }
      if (
        ch === charCodes.dollarSign &&
        this.input.charCodeAt(this.state.pos + 1) === charCodes.leftCurlyBrace
      ) {
        this.state.pos += 2; // eat '${'
        out += this.input.slice(chunkStart, this.state.pos);
        this.finishToken(tt.templateNonTail, containsInvalid ? null : out);
        return;
      }
      if (ch === charCodes.backslash) {
        out += this.input.slice(chunkStart, this.state.pos);
        const escaped = this.readEscapedChar(true);
        if (escaped === null) {
          containsInvalid = true;
        } else {
          out += escaped;
        }
        chunkStart = this.state.pos;
      } else if (isNewLine(ch)) {
        out += this.input.slice(chunkStart, this.state.pos);
        ++this.state.pos;
        switch (ch) {
          case charCodes.carriageReturn:
            if (this.input.charCodeAt(this.state.pos) === charCodes.lineFeed) {
              ++this.state.pos;
            }
          // fall through
          case charCodes.lineFeed:
            out += "\n";
            break;
          default:
            out += String.fromCharCode(ch);
            break;
        }
        ++this.state.curLine;
        this.state.lineStart = this.state.pos;
        chunkStart = this.state.pos;
      } else {
        ++this.state.pos;
      }
    }
  }

  public readEscapedChar(inTemplate: boolean): string | null {
    const ch = this.input.charCodeAt(++this.state.pos);
    ++this.state.pos;
    switch (ch) {
      case charCodes.lowercaseN:
        return "\n";
      case charCodes.lowercaseR:
        return "\r";
      case charCodes.lowercaseX: {
        const code = this.readHexChar(2);
        return code === null ? null : String.fromCharCode(code);
      }
      case charCodes.lowercaseU: {
        const code = this.readCodePoint();
        return code === null ? null : String.fromCodePoint(code);
      }
      case charCodes.lowercaseT:
        return "\t";
      case charCodes.lowercaseB:
        return "\b";
      case charCodes.lowercaseV:
        return "\u000b";
      case charCodes.lowercaseF:
        return "\f";
      case charCodes.carriageReturn:
        if (this.input.charCodeAt(this.state.pos) === charCodes.lineFeed) {
          ++this.state.pos;
        }
      // fall through
      case charCodes.lineFeed:
        this.state.lineStart = this.state.pos;
        ++this.state.curLine;
      // fall through
      case charCodes.lineSeparator:
      case charCodes.paragraphSeparator:
        return "";
      case charCodes.digit8:
      case charCodes.digit9:
        if (inTemplate) {
          return null;
        }
      // fall through
      default:
        if (ch >= charCodes.digit0 && ch <= charCodes.digit7) {
          // We immediately follow a "\\", and we're something between 0 and 7,
          // so we must be on the same line.
          const codePos = createPositionWithColumnOffset(
            this.state.curPosition(),
            -1
          );
          const match = this.input
            .slice(this.state.pos - 1, this.state.pos + 2)
            .match(/^[0-7]+/);

          // This is never null, because of the if condition above.
          /*:: invariant(match !== null) */
          let octalStr = match[0];

          let octal = parseInt(octalStr, 8);
          if (octal > 255) {
            octalStr = octalStr.slice(0, -1);
            octal = parseInt(octalStr, 8);
          }
          this.state.pos += octalStr.length - 1;
          const next = this.input.charCodeAt(this.state.pos);
          if (
            octalStr !== "0" ||
            next === charCodes.digit8 ||
            next === charCodes.digit9
          ) {
            if (inTemplate) {
              return null;
            }
          }

          return String.fromCharCode(octal);
        }

        return String.fromCharCode(ch);
    }
  }

  readHexChar(len: number): number | null {
    return this.readInt(16, len, false);
  }

  public readCodePoint(): number | null {
    const ch = this.input.charCodeAt(this.state.pos);
    let code;

    if (ch === charCodes.leftCurlyBrace) {
      ++this.state.pos;
      code = this.readHexChar(
        this.input.indexOf("}", this.state.pos) - this.state.pos
      );
      ++this.state.pos;
      if (code !== null && code > 0x10ffff) {
        return null;
      }
    } else {
      code = this.readHexChar(4);
    }
    return code;
  }

  readRadixNumber(radix: number): void {
    const startLoc = this.state.curPosition();
    let isBigInt = false;

    this.state.pos += 2; // 0x
    const val = this.readInt(radix);
    const next = this.input.charCodeAt(this.state.pos);

    if (next === charCodes.lowercaseN) {
      ++this.state.pos;
      isBigInt = true;
    }

    if (isBigInt) {
      const str = this.input
        .slice(startLoc.index, this.state.pos)
        .replace(/[_n]/g, "");
      this.finishToken(tt.bigint, str);
      return;
    }

    this.finishToken(tt.num, val);
  }

  readString(quote: number): void {
    let out = "",
      chunkStart = ++this.state.pos;
    for (;;) {
      const ch = this.input.charCodeAt(this.state.pos);
      if (ch === quote) break;
      if (ch === charCodes.backslash) {
        out += this.input.slice(chunkStart, this.state.pos);
        out += this.readEscapedChar(false);
        chunkStart = this.state.pos;
      } else if (
        ch === charCodes.lineSeparator ||
        ch === charCodes.paragraphSeparator
      ) {
        ++this.state.pos;
        ++this.state.curLine;
        this.state.lineStart = this.state.pos;
      } else {
        ++this.state.pos;
      }
    }
    out += this.input.slice(chunkStart, this.state.pos++);
    this.finishToken(tt.string, out);
  }

  readToken_slash(): void {
    const next = this.input.charCodeAt(this.state.pos + 1);
    if (next === charCodes.equalsTo) {
      this.finishOp(tt.slashAssign, 2);
    } else {
      this.finishOp(tt.slash, 1);
    }
  }

  readToken_mult_modulo(code: number): void {
    // '%' or '*'
    let type = code === charCodes.asterisk ? tt.star : tt.modulo;
    let width = 1;
    let next = this.input.charCodeAt(this.state.pos + 1);

    // Exponentiation operator '**'
    if (code === charCodes.asterisk && next === charCodes.asterisk) {
      width++;
      next = this.input.charCodeAt(this.state.pos + 2);
      type = tt.exponent;
    }

    // '%=' or '*='
    if (next === charCodes.equalsTo && !this.state.inType) {
      width++;
      // `tt.moduloAssign` is only needed to support % as a Hack-pipe topic token.
      // If the proposal ends up choosing a different token,
      // it can be merged with tt.assign.
      type = code === charCodes.percentSign ? tt.moduloAssign : tt.assign;
    }

    this.finishOp(type, width);
  }

  readToken_pipe_amp(code: number): void {
    // '||' '&&' '||=' '&&='
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      if (this.input.charCodeAt(this.state.pos + 2) === charCodes.equalsTo) {
        this.finishOp(tt.assign, 3);
      } else {
        this.finishOp(
          code === charCodes.verticalBar ? tt.logicalOR : tt.logicalAND,
          2
        );
      }
      return;
    }

    if (code === charCodes.verticalBar) {
      // '|>'
      if (next === charCodes.greaterThan) {
        this.finishOp(tt.pipeline, 2);
        return;
      }
    }

    if (next === charCodes.equalsTo) {
      this.finishOp(tt.assign, 2);
      return;
    }

    this.finishOp(
      code === charCodes.verticalBar ? tt.bitwiseOR : tt.bitwiseAND,
      1
    );
  }

  readToken_caret(): void {
    const next = this.input.charCodeAt(this.state.pos + 1);

    // '^='
    if (next === charCodes.equalsTo && !this.state.inType) {
      // `tt.xorAssign` is only needed to support ^ as a Hack-pipe topic token.
      // If the proposal ends up choosing a different token,
      // it can be merged with tt.assign.
      this.finishOp(tt.xorAssign, 2);
    }
    // '^'
    else {
      this.finishOp(tt.bitwiseXOR, 1);
    }
  }

  readToken_atSign(): void {
    // '@'
    this.finishOp(tt.at, 1);
  }

  readToken_numberSign(): void {
    if (this.state.pos === 0 && this.readToken_interpreter()) {
      return;
    }

    const nextPos = this.state.pos + 1;
    const next = this.codePointAtPos(nextPos);

    if (isIdentifierStart(next)) {
      ++this.state.pos;
      this.finishToken(tt.privateName, this.readWord1(next));
    } else if (next === charCodes.backslash) {
      ++this.state.pos;
      this.finishToken(tt.privateName, this.readWord1());
    } else {
      this.finishOp(tt.hash, 1);
    }
  }

  readToken_interpreter(): boolean {
    if (this.state.pos !== 0 || this.length < 2) return false;

    let ch = this.input.charCodeAt(this.state.pos + 1);
    if (ch !== charCodes.exclamationMark) return false;

    const start = this.state.pos;
    this.state.pos += 1;

    while (!isNewLine(ch) && ++this.state.pos < this.length) {
      ch = this.input.charCodeAt(this.state.pos);
    }

    const value = this.input.slice(start + 2, this.state.pos);

    this.finishToken(tt.interpreterDirective, value);

    return true;
  }

  codePointAtPos(pos: number): number {
    // The implementation is based on
    // https://source.chromium.org/chromium/chromium/src/+/master:v8/src/builtins/builtins-string-gen.cc;l=1455;drc=221e331b49dfefadbc6fa40b0c68e6f97606d0b3;bpv=0;bpt=1
    // We reimplement `codePointAt` because `codePointAt` is a V8 builtin which is not inlined by TurboFan (as of M91)
    // since `input` is mostly ASCII, an inlined `charCodeAt` wins here
    let cp = this.input.charCodeAt(pos);
    if ((cp & 0xfc00) === 0xd800 && ++pos < this.input.length) {
      const trail = this.input.charCodeAt(pos);
      if ((trail & 0xfc00) === 0xdc00) {
        cp = 0x10000 + ((cp & 0x3ff) << 10) + (trail & 0x3ff);
      }
    }
    return cp;
  }

  readWord1(firstCode: number | void): string {
    this.state.containsEsc = false;
    let word = "";
    let chunkStart = this.state.pos;
    if (firstCode !== undefined) {
      this.state.pos += firstCode <= 0xffff ? 1 : 2;
    }

    while (this.state.pos < this.length) {
      const ch = this.codePointAtPos(this.state.pos);
      if (isIdentifierChar(ch)) {
        this.state.pos += ch <= 0xffff ? 1 : 2;
      } else if (ch === charCodes.backslash) {
        this.state.containsEsc = true;

        word += this.input.slice(chunkStart, this.state.pos);

        if (this.input.charCodeAt(++this.state.pos) !== charCodes.lowercaseU) {
          chunkStart = this.state.pos - 1;
          continue;
        }

        ++this.state.pos;
        const esc = this.readCodePoint();
        if (esc !== null) {
          word += String.fromCodePoint(esc);
        }
        chunkStart = this.state.pos;
      } else {
        break;
      }
    }
    return word + this.input.slice(chunkStart, this.state.pos);
  }

  readToken_plus_min(code: number): void {
    // '+-'
    const next = this.input.charCodeAt(this.state.pos + 1);

    if (next === code) {
      this.finishOp(tt.incDec, 2);
      return;
    }

    if (next === charCodes.equalsTo) {
      this.finishOp(tt.assign, 2);
    } else {
      this.finishOp(tt.plusMin, 1);
    }
  }

  readToken_lt(): void {
    // '<'
    const { pos } = this.state;
    const next = this.input.charCodeAt(pos + 1);

    if (next === charCodes.lessThan) {
      if (this.input.charCodeAt(pos + 2) === charCodes.equalsTo) {
        this.finishOp(tt.assign, 3);
        return;
      }
      this.finishOp(tt.bitShiftL, 2);
      return;
    }

    if (next === charCodes.equalsTo) {
      // <=
      this.finishOp(tt.relational, 2);
      return;
    }

    this.finishOp(tt.lt, 1);
  }

  readToken_gt(): void {
    // '>'
    const { pos } = this.state;
    const next = this.input.charCodeAt(pos + 1);

    if (next === charCodes.greaterThan) {
      const size =
        this.input.charCodeAt(pos + 2) === charCodes.greaterThan ? 3 : 2;
      if (this.input.charCodeAt(pos + size) === charCodes.equalsTo) {
        this.finishOp(tt.assign, size + 1);
        return;
      }
      this.finishOp(tt.bitShiftR, size);
      return;
    }

    if (next === charCodes.equalsTo) {
      // <= | >=
      this.finishOp(tt.relational, 2);
      return;
    }

    this.finishOp(tt.gt, 1);
  }

  readWord(firstCode: number | void): void {
    const word = this.readWord1(firstCode);
    const type = keywordTypes.get(word);
    if (type !== undefined) {
      // We don't use word as state.value here because word is a dynamic string
      // while token label is a shared constant string
      this.finishToken(type, tokenLabelName(type));
    } else {
      this.finishToken(tt.name, word);
    }
  }

  readToken_eq_excl(code: number): void {
    // '=!'
    const next = this.input.charCodeAt(this.state.pos + 1);
    if (next === charCodes.equalsTo) {
      this.finishOp(
        tt.equality,
        this.input.charCodeAt(this.state.pos + 2) === charCodes.equalsTo ? 3 : 2
      );
      return;
    }
    if (code === charCodes.equalsTo && next === charCodes.greaterThan) {
      // '=>'
      this.state.pos += 2;
      this.finishToken(tt.arrow);
      return;
    }
    this.finishOp(code === charCodes.equalsTo ? tt.eq : tt.bang, 1);
  }
}
