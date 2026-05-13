export class InflectionError extends Error {
	readonly requestId: string;

	constructor(message: string, requestId: string) {
		super(message);
		this.name = "InflectionError";
		this.requestId = requestId;
	}
}

export class InflectionHttpError extends InflectionError {
	readonly status: number;
	readonly body: unknown;

	constructor(message: string, requestId: string, status: number, body: unknown) {
		super(message, requestId);
		this.name = "InflectionHttpError";
		this.status = status;
		this.body = body;
	}
}

export class InflectionNetworkError extends InflectionError {
	override readonly cause?: Error;

	constructor(message: string, requestId: string, cause?: Error) {
		super(message, requestId);
		this.name = "InflectionNetworkError";
		this.cause = cause;
	}
}
