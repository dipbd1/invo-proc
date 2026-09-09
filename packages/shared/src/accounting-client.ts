import { envelopeSchema, partnerSchema, registerInvoiceSchema, type Partner, type RegisterInvoice } from "./types.ts";

export type Envelope<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
};

export class AccountingApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: Envelope<unknown>,
  ) {
    super(message);
  }
}

async function parseEnvelope<T>(response: Response): Promise<{ status: number; body: Envelope<T> }> {
  const json: unknown = await response.json();
  const body = envelopeSchema.parse(json) as Envelope<T>;
  return { status: response.status, body };
}

export class AccountingClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
  ) {}

  private headers(json = false): HeadersInit {
    const headers: Record<string, string> = { "X-API-Key": this.apiKey };
    if (json) headers["Content-Type"] = "application/json";
    return headers;
  }

  async health(): Promise<{ status: string; registered_invoices: number }> {
    const response = await fetch(`${this.baseUrl}/health`);
    const { body } = await parseEnvelope<{ status: string; registered_invoices: number }>(response);
    if (!body.success || !body.data) {
      throw new AccountingApiError(body.error?.message ?? "health failed", response.status, body);
    }
    return body.data;
  }

  async partners(): Promise<Partner[]> {
    const response = await fetch(`${this.baseUrl}/partners`, { headers: this.headers() });
    const { body } = await parseEnvelope<{ partners: Partner[] }>(response);
    if (!body.success || !body.data) {
      throw new AccountingApiError(body.error?.message ?? "partners failed", response.status, body);
    }
    return body.data.partners.map((p) => partnerSchema.parse(p));
  }

  async listInvoices(): Promise<Array<{ partner_code: string; invoice_number: string }>> {
    const response = await fetch(`${this.baseUrl}/invoices`, { headers: this.headers() });
    const { body } = await parseEnvelope<{
      invoices: Array<{ partner_code: string; invoice_number: string }>;
    }>(response);
    if (!body.success || !body.data) {
      throw new AccountingApiError(body.error?.message ?? "list invoices failed", response.status, body);
    }
    return body.data.invoices;
  }

  async createInvoice(payload: RegisterInvoice): Promise<{ status: number; body: Envelope<{ accounting_id: string }> }> {
    registerInvoiceSchema.parse(payload);
    const response = await fetch(`${this.baseUrl}/invoices`, {
      method: "POST",
      headers: this.headers(true),
      body: JSON.stringify(payload),
    });
    return parseEnvelope<{ accounting_id: string }>(response);
  }

  async deleteAll(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/invoices`, {
      method: "DELETE",
      headers: this.headers(),
    });
    const { body } = await parseEnvelope(response);
    if (!body.success) {
      throw new AccountingApiError(body.error?.message ?? "delete failed", response.status, body);
    }
  }
}
