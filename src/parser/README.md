# Parser

1. tokenizer 用来解析获取 Token，包括 state 和 context;
2. parser 包含 node、statement、expression 等;

调用@babel/parser 的 parse 方法的时候，会先通过 getParser 实例化一个 Parser，然后调用 Parser 上面的 parse 方法。
