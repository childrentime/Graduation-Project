import * as charCodes from "charcodes";
import { isIdentifierStart } from "@babel/helper-validator-identifier";

export {
  isIdentifierStart,
  isIdentifierChar,
  isReservedWord,
  isStrictBindOnlyReservedWord,
  isStrictBindReservedWord,
  isStrictReservedWord,
  isKeyword,
} from "@babel/helper-validator-identifier";

export function isIteratorStart(
  current: number,
  next: number,
  next2: number
): boolean {
  return (
    current === charCodes.atSign &&
    next === charCodes.atSign &&
    isIdentifierStart(next2)
  );
}
