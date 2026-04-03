export class PublicError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "PublicError";
    this.status = status;
  }
}

export function isPublicError(error: unknown): error is PublicError {
  return error instanceof PublicError;
}
