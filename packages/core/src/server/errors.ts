// Domain errors: what code below the route throws when a request cannot be honoured. The message
// is for logs and never reaches the browser; `failFrom` (fail-from.ts, web only) decides what the visitor sees.

export class Forbidden extends Error {
  constructor(message = 'forbidden') {
    super(message);
    this.name = 'Forbidden';
  }
}

export class NotFound extends Error {
  constructor(message = 'not found') {
    super(message);
    this.name = 'NotFound';
  }
}

/** There is no seat left. Not a permission problem: the player may join if one frees up. */
export class TableFull extends Error {
  constructor(message = 'table full') {
    super(message);
    this.name = 'TableFull';
  }
}

/** The first session has not ended yet, so there is nothing to rate. Not a permission problem: try again later. */
export class TooEarly extends Error {
  constructor(message = 'too early') {
    super(message);
    this.name = 'TooEarly';
  }
}

/** The player already rated this table's GM. A rating is final: it is not edited. */
export class AlreadyRated extends Error {
  constructor(message = 'already rated') {
    super(message);
    this.name = 'AlreadyRated';
  }
}

/** The player already has a place at this table, confirmed or pending. */
export class AlreadyRegistered extends Error {
  constructor(message = 'already registered') {
    super(message);
    this.name = 'AlreadyRegistered';
  }
}

/** The person did this too often lately. Not a permission problem: they may try again once `retryAfterSeconds` have passed. */
export class RateLimited extends Error {
  constructor(
    readonly retryAfterSeconds: number,
    message = 'rate limited',
  ) {
    super(message);
    this.name = 'RateLimited';
  }
}

/** The input is well formed but cannot be accepted: it names a system that does not exist, say. */
export class Invalid extends Error {
  constructor(
    readonly field: string,
    message = 'invalid',
  ) {
    super(message);
    this.name = 'Invalid';
  }
}

/** The other person turned direct messages off. Not a permission problem the sender can fix. */
export class DirectMessagesOff extends Error {
  constructor(message = 'direct messages are off') {
    super(message);
    this.name = 'DirectMessagesOff';
  }
}
