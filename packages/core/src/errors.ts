export interface Sekai64ErrorContext {
  code: string
  path?: string
  backend?: string
  details?: Readonly<Record<string, unknown>>
}

export class Sekai64Error extends Error {
  readonly code: string
  readonly path?: string
  readonly backend?: string
  readonly details?: Readonly<Record<string, unknown>>

  constructor(message: string, context: Sekai64ErrorContext) {
    super(message)
    this.name = 'Sekai64Error'
    this.code = context.code
    this.path = context.path
    this.backend = context.backend
    this.details = context.details
  }
}
