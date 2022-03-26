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

export type PatternBase = NodeBase & {
  // Flow/TypeScript only:
  typeAnnotation?: TypeAnnotationBase;
};

export type Identifier = PatternBase & {
  type: "Identifier";
  name: string;

  // @deprecated
  __clone(): Identifier;

  // TypeScript only. Used in case of an optional parameter.
  optional?: true;
};

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
export type TypeAnnotationBase = NodeBase & {
  typeAnnotation: Node;
};
export type Node = NodeBase & { [key: string]: any };
export type Expression = Node;
export type Statement = Node;

export type BlockStatement = NodeBase & {
  type: "BlockStatement";
  body: Array<Statement>;
  directives: Array<Directive>;
};

export type DoWhileStatement = NodeBase & {
  type: "DoWhileStatement";
  body: Statement;
  test: Expression;
};
export type DebuggerStatement = NodeBase & {
  type: "DebuggerStatement";
};

export type BreakStatement = NodeBase & {
  type: "BreakStatement";
  label: Identifier;
};

export type ContinueStatement = NodeBase & {
  type: "ContinueStatement";
  label: Identifier;
};

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

export type BlockStatementLike = Program | BlockStatement;

export type PrivateName = NodeBase & {
  type: "PrivateName";
  id: Identifier;
};

export type NumericLiteral = NodeBase & {
  type: "NumericLiteral";
  value: number;
};

export type BigIntLiteral = NodeBase & {
  type: "BigIntLiteral";
  value: number;
};

export type DecimalLiteral = NodeBase & {
  type: "DecimalLiteral";
  value: number;
};

export type NullLiteral = NodeBase & {
  type: "NullLiteral";
};

export type BooleanLiteral = NodeBase & {
  type: "BooleanLiteral";
  value: boolean;
};

export type Super = NodeBase & { type: "Super" };
export type ThisExpression = NodeBase & { type: "ThisExpression" };
export type UnaryExpression = NodeBase & {
  type: "UnaryExpression";
  operator: UnaryOperator;
  prefix: boolean;
  argument: Expression;
};

export type UnaryOperator =
  | "-"
  | "+"
  | "!"
  | "~"
  | "typeof"
  | "void"
  | "delete"
  | "throw";
