/**
 * Thin wrapper around `chrome.devtools.inspectedWindow.eval()`. It stringifies a self-contained
 * function (see `inspected-scripts.ts`) and re-evaluates it inside the inspected page, since
 * `eval()` only accepts a source string, not a function reference.
 */

function evalExpression<T>(expression: string): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.devtools.inspectedWindow.eval(expression, (result, exceptionInfo) => {
      if (exceptionInfo?.isException || exceptionInfo?.isError) {
        reject(new Error(exceptionInfo.value || exceptionInfo.description || 'Evaluation failed in inspected page'));
        return;
      }
      resolve(result as T);
    });
  });
}

/** Calls a self-contained function with JSON-serializable arguments. */
export function callInInspectedWindow<T>(fn: (...args: never[]) => T, args: unknown[] = []): Promise<T> {
  const serializedArgs = args.map((arg) => JSON.stringify(arg)).join(', ');
  return evalExpression<T>(`(${fn.toString()})(${serializedArgs})`);
}

/**
 * Calls a self-contained function with the DevTools-provided `$0` (currently inspected element)
 * as its first argument, plus any additional JSON-serializable arguments.
 */
export function callWithInspectedElement<T>(fn: (...args: never[]) => T, extraArgs: unknown[] = []): Promise<T> {
  const serializedExtra = extraArgs.map((arg) => JSON.stringify(arg)).join(', ');
  const argList = serializedExtra ? `$0, ${serializedExtra}` : '$0';
  return evalExpression<T>(`(${fn.toString()})(${argList})`);
}
