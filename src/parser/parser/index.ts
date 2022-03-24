import { File } from "../types";
import StatementParser from "./statement";

export default class Parser extends StatementParser {
  constructor(input: string) {
    super(input);
  }

  parse(): File {
    const file = this.startNode();
    const program = this.startNode();
    this.nextToken();
    this.parseTopLevel(file, program);
    return file;
  }
}
