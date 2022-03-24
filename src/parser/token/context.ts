export class TokContext {
  constructor(token: string, preserveSpace?: boolean) {
    this.token = token;
    this.preserveSpace = !!preserveSpace;
  }

  public token: string;
  public preserveSpace: boolean;
}

const types: {
  [key: string]: TokContext;
} = {
  brace: new TokContext("{"), // normal JavaScript expression
  j_oTag: new TokContext("<tag"), // JSX openning tag
  j_cTag: new TokContext("</tag"), // JSX closing tag
  j_expr: new TokContext("<tag>...</tag>", true), // JSX expressions
};

export { types };
