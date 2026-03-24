import pino from 'pino'

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  redact: {
    paths: [
      'access_token_enc',
      'api_key_enc',
      '*.token',
      '*.key',
      '*.secret',
      '*.password',
    ],
    censor: '[REDACTED]',
  },
})

export function createCorrelatedLogger(correlationId: string) {
  return logger.child({ correlationId })
}
