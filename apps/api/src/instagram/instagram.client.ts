import { Injectable } from '@nestjs/common';
import type {
  InstagramMessage,
  InstagramRecipient,
} from './domain/outgoing.js';
import { InstagramConfig } from './instagram.config.js';

export class InstagramApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(`Instagram API ${status}: ${message}`);
  }
}

// Instagram API with Instagram Login (graph.instagram.com).
@Injectable()
export class InstagramClient {
  constructor(private readonly config: InstagramConfig) {}

  // Send API. With a comment recipient this is a private reply: one message
  // per comment, within 7 days of it.
  async sendMessage(recipient: InstagramRecipient, message: InstagramMessage) {
    return this.post<{ recipient_id: string; message_id: string }>(
      `/${this.config.accountId}/messages`,
      { recipient, message },
    );
  }

  // Public answer under a comment.
  async replyToComment(commentId: string, text: string) {
    return this.post<{ id: string }>(
      `/${encodeURIComponent(commentId)}/replies`,
      { message: text },
    );
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.config.graphUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      throw new InstagramApiError(
        response.status,
        json?.error?.message ?? response.statusText,
      );
    }
    return json as T;
  }
}
