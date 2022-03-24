import Parser from "./parser";
const parse = (input: string) => {
  const parser = new Parser(input);
  const ast = parser.parse();
  return ast;
};

export default parse;
