import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import generate from "@babel/generator";
import fs from "fs";
import path from "path";
import { Console } from "console";

const output = fs.createWriteStream(path.join(__dirname, "./structure.txt"));
const logger = new Console({ stdout: output });

const input = fs.readFileSync(path.join(__dirname, "./input.js"), "utf-8");
const ast = parse(input);

traverse(ast, {
  VariableDeclaration(path, state) {
    logger.log(path.node);
    path.node.kind = "var";
  },
  FunctionDeclaration(path, state) {
    logger.log(path.node);
  },
  ArrowFunctionExpression(path, state) {
    logger.log(path.node);
  },
  ForOfStatement(path, state) {
    logger.log(path.node);
  },
});

const transformedCode = generate(ast).code;
fs.writeFile(path.join(__dirname, "./output.js"), transformedCode, () => {
  console.log("write success");
});
