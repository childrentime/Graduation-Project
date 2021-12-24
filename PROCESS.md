# ES6

参考：https://github.com/estree/estree/blob/master/es2015.md
为了支持 ES6 语法，我们需要如下额外的 AST 类型

## Programs

```ts
extend interface Program {
    sourceType: "script" | "module";
    body: [ Statement | ModuleDeclaration ];
}
```

如果源代码被解析为 ES6 模块，解析器必须将 sourceType 指定为 "模块"。否则，sourceType 必须是 "脚本"。

## Functions

```ts
extend interface Function {
    generator: boolean;
}
```

## Statements

### ForOfStatement

```ts
interface ForOfStatement <: ForInStatement {
    type: "ForOfStatement";
}
```

## Declarations

### VariableDeclaration

```ts
extend interface VariableDeclaration {
    kind: "var" | "let" | "const";
}
```

## Expressions

```ts
interface Super <: Node {
    type: "Super";
}

extend interface CallExpression {
    callee: Expression | Super;
}

extend interface MemberExpression {
    object: Expression | Super;
}
```

super 的表达式

```ts
interface SpreadElement <: Node {
    type: "SpreadElement";
    argument: Expression;
}

extend interface ArrayExpression {
    elements: [ Expression | SpreadElement | null ];
}

extend interface CallExpression {
    arguments: [ Expression | SpreadElement ];
}

extend interface NewExpression {
    arguments: [ Expression | SpreadElement ];
}
```

## ArrowFunctionExpression

胖箭头表达式

```ts
interface ArrowFunctionExpression <: Function, Expression {
    type: "ArrowFunctionExpression";
    body: FunctionBody | Expression;
    expression: boolean;
    generator: false;
}
```

## YieldExpression

yield 关键字

```ts
interface YieldExpression <: Expression {
    type: "YieldExpression";
    argument: Expression | null;
    delegate: boolean;
}
```

## Template Literals

### TemplateLiteral

模板表达式

```ts
interface TemplateLiteral <: Expression {
    type: "TemplateLiteral";
    quasis: [ TemplateElement ];
    expressions: [ Expression ];
}
```

### TaggedTemplateExpression

```ts
interface TaggedTemplateExpression <: Expression {
    type: "TaggedTemplateExpression";
    tag: Expression;
    quasi: TemplateLiteral;
}
```

### TemplateElement

模板表达式中模板元素

```ts
interface TemplateElement <: Node {
    type: "TemplateElement";
    tail: boolean;
    value: {
        cooked: string;
        raw: string;
    };
}
```
