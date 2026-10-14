export type ErrorCode = "invalid" | "auth" | "forbidden" | "conflict" | "not_found" | "blocked" | "internal";

export class ServiceError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export const invalid = (message: string, details?: unknown) => new ServiceError("invalid", message, details);
export const notFound = (what: string, id: string) =>
  new ServiceError("not_found", `${what} ${id} not found`);
export const conflict = (message: string, details?: unknown) =>
  new ServiceError("conflict", message, details);
export const blocked = (message: string, details?: unknown) => new ServiceError("blocked", message, details);
export const forbidden = (message: string) => new ServiceError("forbidden", message);
