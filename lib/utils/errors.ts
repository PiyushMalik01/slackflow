export class AiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiError'
  }
}

export class AiTimeoutError extends AiError {
  constructor() {
    super('AI request timed out after 30s')
    this.name = 'AiTimeoutError'
  }
}

export class AiParseError extends AiError {
  constructor(public raw: string) {
    super('Failed to parse AI output')
    this.name = 'AiParseError'
  }
}

export class SlackVerificationError extends Error {
  constructor() {
    super('Slack signature verification failed')
    this.name = 'SlackVerificationError'
  }
}

export class DbError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message)
    this.name = 'DbError'
  }
}

export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} not found`)
    this.name = 'NotFoundError'
  }
}

export class RateLimitError extends Error {
  constructor(public key: string) {
    super(`Rate limit exceeded for ${key}`)
    this.name = 'RateLimitError'
  }
}
