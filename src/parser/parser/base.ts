import State from "../token/state";

export default class BaseParser {
  // Initialized by Tokenizer
  public state: State;
  // input and length are not in state as they are constant and we do
  // not want to ever copy them, which happens if state gets cloned
  public input: string;
  public expressionScope: ExpressionScopeHandler;
  public length: number;
}
