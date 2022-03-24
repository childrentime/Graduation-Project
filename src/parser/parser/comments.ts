import BaseParser from "./base";
import type { Comment, Node } from "../types";

export type CommentWhitespace = {
  start: number;
  end: number;
  comments: Array<Comment>;
  leadingNode: Node | null;
  trailingNode: Node | null;
  containingNode: Node | null;
};

export default class CommentsParser extends BaseParser {
  addComment(comment: Comment): void {
    this.state.comments.push(comment);
  }
}
