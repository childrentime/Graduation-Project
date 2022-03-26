import Tokenizer from "../token";
import { TokenType, tt } from "../token/types";
import { NodeBase } from "../types";
import { lineBreak } from "../util/whitespace";

export default class UtilParser extends Tokenizer {
  isLineTerminator(): boolean {
    return this.eat(tt.semi) || this.canInsertSemicolon();
  }

  canInsertSemicolon(): boolean {
    return (
      this.match(tt.eof) ||
      this.match(tt.braceR) ||
      this.hasPrecedingLineBreak()
    );
  }

  hasPrecedingLineBreak(): boolean {
    return lineBreak.test(
      this.input.slice(this.state.lastTokEndLoc.index, this.state.start)
    );
  }

  semicolon(allowAsi: boolean = true): void {
    if (allowAsi ? this.isLineTerminator() : this.eat(tt.semi)) {
      return;
    }
  }

  expect(type: TokenType): void {
    this.eat(type);
  }

  addExtra(
    node: NodeBase,
    key: string,
    value: any,
    enumerable: boolean = true
  ): void {
    if (!node) return;

    const extra = (node.extra = node.extra || {});
    if (enumerable) {
      extra[key] = value;
    } else {
      Object.defineProperty(extra, key, { enumerable, value });
    }
  }
}
