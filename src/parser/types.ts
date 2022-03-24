import { Token } from "./token";
import { SourceLocation } from "./util/location";

type SourceType = "script";
type CommentBase = {
  type: "CommentBlock" | "CommentLine";
  value: string;
  start: number;
  end: number;
  loc: SourceLocation;
};

export type CommentBlock = CommentBase & {
  type: "CommentBlock";
};
export type CommentLine = CommentBase & {
  type: "CommentLine";
};
export type Comment = CommentBlock | CommentLine;
export interface NodeBase {
  start: number;
  end: number;
  loc: SourceLocation;
  range: [number, number];
  leadingComments?: Array<Comment>;
  trailingComments?: Array<Comment>;
  innerComments?: Array<Comment>;

  extra: { [key: string]: any };
}
export type Node = NodeBase & { [key: string]: any };
export type Expression = Node;
export type Statement = Node;

export type StringLiteral = NodeBase & {
  type: "StringLiteral";
  value: string;
};

export type InterpreterDirective = NodeBase & {
  type: "InterpreterDirective";
  value: string;
};

export type ParserOutput = {
  comments: Array<Comment>;
  tokens?: Array<Token | Comment>;
};

export type File = NodeBase & {
  type: "File";
  program: Program;
} & ParserOutput;

export type Program = NodeBase & {
  type: "Program";
  sourceType: SourceType;
  body: Array<Statement>;
  directives: Array<Directive>;
  interpreter: InterpreterDirective | null;
};

export type Directive = NodeBase & {
  type: "Directive";
  value: DirectiveLiteral;
};

export type DirectiveLiteral = StringLiteral & { type: "DirectiveLiteral" };

export type CommentWhitespace = {
  start: number;
  end: number;
  comments: Array<Comment>;
  leadingNode: Node | null;
  trailingNode: Node | null;
  containerNode: Node | null;
};
