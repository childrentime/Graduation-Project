import { Position } from "../util/location";
import * as N from "../types";
import { tt, type TokenType } from "./types";
import { types as ct, TokContext } from "./context";
import { CommentWhitespace } from "../parser/comments";

type TopicContextState = {
  // When a topic binding has been currently established,
  // then this is 1. Otherwise, it is 0. This is forwards compatible
  // with a future plugin for multiple lexical topics.
  maxNumOfResolvableTopics: number;

  // When a topic binding has been currently established, and if that binding
  // has been used as a topic reference `#`, then this is 0. Otherwise, it is
  // `null`. This is forwards compatible with a future plugin for multiple
  // lexical topics.
  maxTopicIndex: null | 0;
};
export default class State {
  public strict: boolean;
  public curLine: number;
  public lineStart: number;

  public startLoc: Position;
  public endLoc: Position;

  potentialArrowAt: number = -1;

  // Used to signify the start of an expression which looks like a
  // typed arrow function, but it isn't
  // e.g. a ? (b) : c => d
  //          ^
  noArrowAt: number[] = [];

  // Used to signify the start of an expression whose params, if it looks like
  // an arrow function, shouldn't be converted to assignable nodes.
  // This is used to defer the validation of typed arrow functions inside
  // conditional expressions.
  // e.g. a ? (b) : c => d
  //          ^
  noArrowParamsConversionAt: number[] = [];

  // Flags to track
  maybeInArrowParameters: boolean = false;
  inType: boolean = false;
  noAnonFunctionType: boolean = false;
  hasFlowComment: boolean = false;
  isAmbientContext: boolean = false;
  inAbstractClass: boolean = false;

  // For the Hack-style pipelines plugin
  topicContext: TopicContextState = {
    maxNumOfResolvableTopics: 0,
    maxTopicIndex: null,
  };

  // For the F#-style pipelines plugin
  soloAwait: boolean = false;
  inFSharpPipelineDirectBody: boolean = false;

  // Labels in scope.
  labels: Array<{
    kind?: "loop" | "switch";
    name?: string;
    statementStart?: number;
  }> = [];

  // Comment store for Program.comments
  comments: Array<N.Comment> = [];

  // Comment attachment store
  commentStack: Array<CommentWhitespace> = [];

  // The current position of the tokenizer in the input.
  pos: number = 0;

  // Properties of the current token:
  // Its type
  type: TokenType = tt.eof;

  // For tokens that include more information than their type, the value
  value: any = null;

  // Its start and end offset
  start: number = 0;
  end: number = 0;

  // Position information for the previous token
  // $FlowIgnore this is initialized when generating the second token.
  lastTokEndLoc: Position = null;
  // $FlowIgnore this is initialized when generating the second token.
  lastTokStartLoc: Position = null;
  lastTokStart: number = 0;

  // The context stack is used to track whether the apostrophe "`" starts
  // or ends a string template
  context: Array<TokContext> = [ct.brace];
  // Used to track whether a JSX element is allowed to form
  canStartJSXElement: boolean = true;

  // Used to signal to callers of `readWord1` whether the word
  // contained any escape sequences. This is needed because words with
  // escape sequences must not be interpreted as keywords.
  containsEsc: boolean = false;

  // Tokens length in token store
  tokensLength: number = 0;

  curPosition(): Position {
    return new Position(this.curLine, this.pos - this.lineStart, this.pos);
  }

  clone(skipArrays?: boolean): State {
    const state = new State();
    const keys = Object.keys(this);
    for (let i = 0, length = keys.length; i < length; i++) {
      const key = keys[i];
      // @ts-ignore
      let val = this[key];

      if (!skipArrays && Array.isArray(val)) {
        val = val.slice();
      }

      // @ts-ignore
      state[key] = val;
    }

    return state;
  }
}
