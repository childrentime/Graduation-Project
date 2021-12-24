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

## Patterns

### ObjectPattern

```ts
interface AssignmentProperty <: Property {
    type: "Property"; // inherited
    value: Pattern;
    kind: "init";
    method: false;
}

interface ObjectPattern <: Pattern {
    type: "ObjectPattern";
    properties: [ AssignmentProperty ];
}
```

### ArrayPattern

```ts
interface ArrayPattern <: Pattern {
    type: "ArrayPattern";
    elements: [ Pattern | null ];
}
```

### RestElement

```ts
interface RestElement <: Pattern {
    type: "RestElement";
    argument: Pattern;
}
```

### AssignmentPattern

```ts
interface AssignmentPattern <: Pattern {
    type: "AssignmentPattern";
    left: Pattern;
    right: Expression;
}
```

## Classes

```ts
interface Class <: Node {
    id: Identifier | null;
    superClass: Expression | null;
    body: ClassBody;
}
```

### ClassBody

```ts
interface ClassBody <: Node {
    type: "ClassBody";
    body: [ MethodDefinition ];
}
```

### MethodDefinition

```ts
interface MethodDefinition <: Node {
    type: "MethodDefinition";
    key: Expression;
    value: FunctionExpression;
    kind: "constructor" | "method" | "get" | "set";
    computed: boolean;
    static: boolean;
}
```

### ClassDeclaration

```ts
interface ClassDeclaration <: Class, Declaration {
    type: "ClassDeclaration";
    id: Identifier;
}
```

### ClassExpression

```ts
interface ClassExpression <: Class, Expression {
    type: "ClassExpression";
}
```

### MetaProperty

```ts
interface MetaProperty <: Expression {
    type: "MetaProperty";
    meta: Identifier;
    property: Identifier;
}
```

## Modules

### ModuleDeclaration

```ts
interface ModuleDeclaration <: Node { }
```

A module import or export declaration.

### ModuleSpecifier

```ts
interface ModuleSpecifier <: Node {
    local: Identifier;
}
```

A specifier in an import or export declaration.

### Imports

#### ImportDeclaration

```ts
interface ImportDeclaration <: ModuleDeclaration {
    type: "ImportDeclaration";
    specifiers: [ ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier ];
    source: Literal;
}
```

An import declaration, e.g., import foo from "mod";.

#### ImportSpecifier

```ts
interface ImportSpecifier <: ModuleSpecifier {
    type: "ImportSpecifier";
    imported: Identifier;
}
```

<p>An imported variable binding, e.g., {foo} in import {foo} from "mod" or {foo as bar} in import {foo as bar} from "mod". The imported field refers to the name of the export imported from the module. The local field refers to the binding imported into the local module scope. If it is a basic named import, such as in import {foo} from "mod", both imported and local are equivalent Identifier nodes; in this case an Identifier node representing foo. If it is an aliased import, such as in import {foo as bar} from "mod", the imported field is an Identifier node representing foo, and the local field is an Identifier node representing bar.</p>

#### ImportDefaultSpecifier

```ts
interface ImportDefaultSpecifier <: ModuleSpecifier {
    type: "ImportDefaultSpecifier";
}
```

A default import specifier, e.g., foo in import foo from "mod.js".

#### ImportNamespaceSpecifier

```ts
interface ImportNamespaceSpecifier <: ModuleSpecifier {
    type: "ImportNamespaceSpecifier";
}
```

A namespace import specifier, e.g., _ as foo in import _ as foo from "mod.js"

### Exports

#### ExportNamedDeclaration

```ts
interface ExportNamedDeclaration <: ModuleDeclaration {
    type: "ExportNamedDeclaration";
    declaration: Declaration | null;
    specifiers: [ ExportSpecifier ];
    source: Literal | null;
}
```

An export named declaration, e.g., export {foo, bar};, export {foo} from "mod"; or export var foo = 1;.

Note: Having declaration populated with non-empty specifiers or non-null source results in an invalid state.

#### ExportSpecifier

```ts
interface ExportSpecifier <: ModuleSpecifier {
    type: "ExportSpecifier";
    exported: Identifier;
}
```

An exported variable binding, e.g., {foo} in export {foo} or {bar as foo} in export {bar as foo}. The exported field refers to the name exported in the module. The local field refers to the binding into the local module scope. If it is a basic named export, such as in export {foo}, both exported and local are equivalent Identifier nodes; in this case an Identifier node representing foo. If it is an aliased export, such as in export {bar as foo}, the exported field is an Identifier node representing foo, and the local field is an Identifier node representing bar.

#### ExportDefaultDeclaration

```ts
interface AnonymousDefaultExportedFunctionDeclaration <: Function {
    type: "FunctionDeclaration";
    id: null;
}


interface AnonymousDefaultExportedClassDeclaration <: Class {
    type: "ClassDeclaration";
    id: null;
}

interface ExportDefaultDeclaration <: ModuleDeclaration {
    type: "ExportDefaultDeclaration";
    declaration: AnonymousDefaultExportedFunctionDeclaration | FunctionDeclaration | AnonymousDefaultExportedClassDeclaration | ClassDeclaration | Expression;
}
```

An export default declaration, e.g., export default function () {}; or export default 1;.

#### ExportAllDeclaration

```ts
interface ExportAllDeclaration <: ModuleDeclaration {
    type: "ExportAllDeclaration";
    source: Literal;
}
```

An export batch declaration, e.g., export \* from "mod";.
