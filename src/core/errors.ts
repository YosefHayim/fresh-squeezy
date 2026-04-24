/**
 * Unified error type for fresh-squeezy. All HTTP and validation failures that
 * bubble up to consumers pass through this class so caller code can branch on
 * a single `instanceof` check.
 *
 * Why a class over a discriminated union: Node's `fetch` rejections interleave
 * with library errors in user stack traces. A class keeps the stack readable
 * and gives one stable prototype chain for consumer `catch` blocks.
 */
export class FreshSqueezyError extends Error {
  public readonly code: string;
  public readonly status?: number;
  public readonly detail?: unknown;

  constructor(opts: { code: string; message: string; status?: number; detail?: unknown }) {
    super(opts.message);
    this.name = "FreshSqueezyError";
    this.code = opts.code;
    this.status = opts.status;
    this.detail = opts.detail;
    Object.setPrototypeOf(this, FreshSqueezyError.prototype);
  }
}
