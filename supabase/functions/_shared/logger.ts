// Supabase Edge Functions environment runs on Deno.
// We use a structured JSON format so that logs can be easily parsed by Logflare / Datadog / Supabase Logs Explorer.

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface EdgeLogPayload {
  message: string;
  tenant_id?: string;
  req_id?: string;
  context?: Record<string, any>;
  error?: Error | unknown;
}

export class EdgeLogger {
  private baseContext: Record<string, any>;

  constructor(baseContext: Record<string, any> = {}) {
    this.baseContext = baseContext;
  }

  // Permite criar um logger derivado com contexto extra (ex: um req_id específico)
  withContext(context: Record<string, any>) {
    return new EdgeLogger({ ...this.baseContext, ...context });
  }

  private log(level: LogLevel, payload: EdgeLogPayload) {
    const timestamp = new Date().toISOString();

    // Qualquer chave fora do contrato entra no contexto em vez de sumir.
    //
    // POR QUE ISTO EXISTE: quase todo chamador escreve
    // `log.error('...', undefined, { response: charge })` — `response` não é
    // `context`, então o spread jogava a chave fora e o log saía com
    // `context: {}`. Foi assim que a recusa de cartão da Efí (08/09) ficou
    // registrada como "Efí recusou o cartão" e MAIS NADA: a resposta do
    // provedor, única coisa capaz de explicar a recusa, era descartada na
    // hora de gravar. O mesmo valia para Pix, iFood e assinatura — todos os
    // caminhos de dinheiro logando cego.
    //
    // O typecheck não pegava porque `npm run typecheck` cobre src/, e as
    // edge functions rodam em Deno, fora dele.
    const { message, tenant_id, req_id, context, error, ...resto } = payload as EdgeLogPayload & Record<string, unknown>;

    const logEntry = {
      timestamp,
      level,
      message,
      tenant_id: tenant_id ?? this.baseContext.tenant_id,
      req_id: req_id ?? this.baseContext.req_id,
      context: { ...this.baseContext.context, ...context, ...resto },
      error: error ? this.formatError(error) : undefined,
    };

    // Imprimir o objeto como string JSON puro garante que o Supabase/Logflare extraia os campos corretamente
    const logString = JSON.stringify(logEntry);

    switch (level) {
      case 'info':
        console.info(logString);
        break;
      case 'warn':
        console.warn(logString);
        break;
      case 'error':
        console.error(logString);
        break;
      case 'debug':
        console.debug(logString);
        break;
    }
  }

  private formatError(error: unknown) {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return String(error);
  }

  info(message: string, payload?: Omit<EdgeLogPayload, 'message' | 'error'>) {
    this.log('info', { message, ...payload });
  }

  warn(message: string, payload?: Omit<EdgeLogPayload, 'message' | 'error'>) {
    this.log('warn', { message, ...payload });
  }

  error(message: string, error?: unknown, payload?: Omit<EdgeLogPayload, 'message' | 'error'>) {
    this.log('error', { message, error, ...payload });
  }

  debug(message: string, payload?: Omit<EdgeLogPayload, 'message' | 'error'>) {
    this.log('debug', { message, ...payload });
  }
}

export const logger = new EdgeLogger();
