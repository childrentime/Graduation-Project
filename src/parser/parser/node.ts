import UtilParser from "./util";
import { Comment, Node as NodeType, NodeBase } from "../types";
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
  protected startNode(): NodeType {
    return new Node(this.state.start, this.state.startLoc);
  }
  finishNode(node: NodeType, type: string): NodeType {
    return this.finishNodeAt(node, type, this.state.lastTokEndLoc);
  }
  // Finish node at given position

  finishNodeAt(node: NodeType, type: string, endLoc: Position): NodeType {
    node.type = type;
    node.end = endLoc.index;
    node.loc.end = endLoc;
    return node;
  }
}
