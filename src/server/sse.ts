type Client = {
  send: (event: string, data: unknown) => void;
  close: () => void;
};

const clients = new Set<Client>();

export function broadcast(event: string, data: unknown) {
  for (const client of [...clients]) {
    try {
      client.send(event, data);
    } catch {
      client.close();
    }
  }
}

export function createSseResponse(): Response {
  let clientRef: Client | null = null;
  let ping: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const client: Client = {
        send,
        close: () => {
          if (closed) return;
          closed = true;
          clients.delete(client);
          if (ping) clearInterval(ping);
          try {
            controller.close();
          } catch {
            // already closed
          }
        },
      };

      clientRef = client;
      clients.add(client);
      send("connected", { ok: true });

      ping = setInterval(() => {
        if (!closed) send("ping", {});
      }, 25_000);
    },
    cancel() {
      clientRef?.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
