import UtilParser from "./util";
import { Comment, NodeBase } from "../types";
import { Position, SourceLocation } from "../util/location";

class Node implements NodeBase {
  constructor(pos: number, loc: Position) {
    this.start = pos;
    this.end = 0;
    this.loc = new SourceLocation(loc);
  }
  public type: string = "";
  public start: number;
  public end: number;
  public loc: SourceLocation;
  public range: [number, number];
  public leadingComments: Array<Comment>;
  public trailingComments: Array<Comment>;
  public innerComments: Array<Comment>;
  public extra: { [key: string]: any };
}
export class NodeUtils extends UtilParser {
  protected startNode<T extends NodeBase>(): T {
    // @ts-ignore
    return new Node(this.state.start, this.state.startLoc);
  }
  finishNode<T extends NodeBase & { type: string }>(node: T, type: string): T {
    return this.finishNodeAt(node, type, this.state.lastTokEndLoc);
  }
  // Finish node at given position

  finishNodeAt<T extends NodeBase & { type: string }>(
    node: T,
    type: string,
    endLoc: Position
  ): T {
    node.type = type;
    node.end = endLoc.index;
    node.loc.end = endLoc;
    return node;
  }
}
