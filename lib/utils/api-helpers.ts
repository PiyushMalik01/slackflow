import { NextResponse } from 'next/server'

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function jsonError(error: string, code: string, status: number) {
  return NextResponse.json({ error, code }, { status })
}

export function json400(message: string) {
  return jsonError(message, 'BAD_REQUEST', 400)
}

export function json401() {
  return jsonError('Unauthorized', 'UNAUTHORIZED', 401)
}

export function json403(message = 'Forbidden') {
  return jsonError(message, 'FORBIDDEN', 403)
}

export function json429() {
  return jsonError('Too many requests', 'RATE_LIMITED', 429)
}

export function json500() {
  return jsonError('Internal server error', 'INTERNAL_ERROR', 500)
}
