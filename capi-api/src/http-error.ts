export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);
export const unauthorized = (message = 'missing or invalid player secret') => new HttpError(401, 'UNAUTHORIZED', message);
export const forbidden = (code: string, message: string) => new HttpError(403, code, message);
export const badRequest = (message: string) => new HttpError(400, 'BAD_REQUEST', message);
export const unavailable = (code: string, message: string) => new HttpError(503, code, message);
