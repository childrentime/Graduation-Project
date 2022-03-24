export class Position {
  public line: number;
  public column: number;
  public index: number;

  constructor(line: number, col: number, index: number) {
    this.line = line;
    this.column = col;
    this.index = index;
  }
}
export class SourceLocation {
  public start: Position;
  public end: Position;
  public filename: string;
  public identifierName?: string;

  constructor(start: Position, end?: Position) {
    this.start = start;
    // $FlowIgnore (may start as null, but initialized later)
    this.end = end;
  }
}

export function createPositionWithColumnOffset(
  position: Position,
  columnOffset: number
) {
  const { line, column, index } = position;
  return new Position(line, column + columnOffset, index + columnOffset);
}
