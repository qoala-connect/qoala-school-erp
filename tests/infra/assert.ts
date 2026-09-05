/**
 * Test Assertion Engine
 * Strict, expressive assertions for opaque-box contracts.
 */

export class AssertionError extends Error {
  expected: any;
  actual: any;

  constructor(message: string, expected?: any, actual?: any) {
    super(message);
    this.name = 'AssertionError';
    const truncate = (val: any) => {
      if (typeof val === 'string' && val.length > 200) {
        return val.slice(0, 200) + '... [truncated ' + (val.length - 200) + ' chars]';
      }
      return val;
    };
    this.expected = truncate(expected);
    this.actual = truncate(actual);
  }
}

export const assert = {
  isTrue(value: boolean, message = 'Expected value to be true'): void {
    if (value !== true) {
      throw new AssertionError(message, true, value);
    }
  },

  isFalse(value: boolean, message = 'Expected value to be false'): void {
    if (value !== false) {
      throw new AssertionError(message, false, value);
    }
  },

  strictEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual !== expected) {
      const msg = message || `Expected strict equality: ${JSON.stringify(actual)} === ${JSON.stringify(expected)}`;
      throw new AssertionError(msg, expected, actual);
    }
  },

  notStrictEqual<T>(actual: T, expected: T, message?: string): void {
    if (actual === expected) {
      const msg = message || `Expected strict inequality: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`;
      throw new AssertionError(msg, expected, actual);
    }
  },

  deepStrictEqual(actual: any, expected: any, message?: string): void {
    const actStr = JSON.stringify(actual);
    const expStr = JSON.stringify(expected);
    if (actStr !== expStr) {
      const msg = message || `Expected deep equality:\nActual:   ${actStr}\nExpected: ${expStr}`;
      throw new AssertionError(msg, expected, actual);
    }
  },

  ok(value: any, message = 'Expected truthy value'): void {
    if (!value) {
      throw new AssertionError(message, 'truthy', value);
    }
  },

  contains(haystack: string, needle: string, message?: string): void {
    if (!haystack || !haystack.includes(needle)) {
      const msg = message || `Expected string to contain "${needle}"`;
      throw new AssertionError(msg, needle, haystack);
    }
  },

  notContains(haystack: string, needle: string, message?: string): void {
    if (haystack && haystack.includes(needle)) {
      const msg = message || `Expected string NOT to contain "${needle}"`;
      throw new AssertionError(msg, `NOT containing "${needle}"`, haystack);
    }
  },

  matches(text: string, regex: RegExp, message?: string): void {
    if (!regex.test(text)) {
      const msg = message || `Expected text to match pattern ${regex}`;
      throw new AssertionError(msg, regex.toString(), text);
    }
  },

  notMatches(text: string, regex: RegExp, message?: string): void {
    if (regex.test(text)) {
      const msg = message || `Expected text NOT to match pattern ${regex}`;
      throw new AssertionError(msg, `NOT matching ${regex}`, text);
    }
  },

  greaterThan(actual: number, expected: number, message?: string): void {
    if (actual <= expected) {
      const msg = message || `Expected ${actual} > ${expected}`;
      throw new AssertionError(msg, `> ${expected}`, actual);
    }
  },

  greaterThanOrEqual(actual: number, expected: number, message?: string): void {
    if (actual < expected) {
      const msg = message || `Expected ${actual} >= ${expected}`;
      throw new AssertionError(msg, `>= ${expected}`, actual);
    }
  },

  lessThanOrEqual(actual: number, expected: number, message?: string): void {
    if (actual > expected) {
      const msg = message || `Expected ${actual} <= ${expected}`;
      throw new AssertionError(msg, `<= ${expected}`, actual);
    }
  },

  includes<T>(array: T[], item: T, message?: string): void {
    if (!array || !array.includes(item)) {
      const msg = message || `Expected array to include item: ${JSON.stringify(item)}`;
      throw new AssertionError(msg, item, array);
    }
  },

  throws(fn: () => void, expectedErrorSubstring?: string, message?: string): void {
    let threw = false;
    let actualError: any = null;
    try {
      fn();
    } catch (err: any) {
      threw = true;
      actualError = err;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected function to throw an error, but it returned normally', 'Error thrown', 'No error');
    }
    if (expectedErrorSubstring && !String(actualError?.message || actualError).includes(expectedErrorSubstring)) {
      throw new AssertionError(
        `Expected error message to include "${expectedErrorSubstring}", got "${actualError?.message || actualError}"`,
        expectedErrorSubstring,
        actualError?.message || actualError
      );
    }
  },

  async rejects(fn: () => Promise<void>, expectedErrorSubstring?: string, message?: string): Promise<void> {
    let threw = false;
    let actualError: any = null;
    try {
      await fn();
    } catch (err: any) {
      threw = true;
      actualError = err;
    }
    if (!threw) {
      throw new AssertionError(message || 'Expected async function to reject, but it resolved', 'Promise rejection', 'Resolved');
    }
    if (expectedErrorSubstring && !String(actualError?.message || actualError).includes(expectedErrorSubstring)) {
      throw new AssertionError(
        `Expected rejection message to include "${expectedErrorSubstring}", got "${actualError?.message || actualError}"`,
        expectedErrorSubstring,
        actualError?.message || actualError
      );
    }
  }
};
