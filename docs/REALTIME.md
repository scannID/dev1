# Real-time behavior

Scanny uses WebSockets for ticket statistics and merchant-order updates. Real-time messages are notifications and projections; PostgreSQL remains the source of truth.

## Connections

Browser applications derive the WebSocket origin from `VITE_WS_BASE_URL`:

- local: `ws://localhost:4000`
- production: `wss://api.scanny.app`

The current ticket statistics endpoint is:

```text
/ws/tickets/stats
```

Merchant-order delivery is being hardened and its public contract may evolve. Consumers should use the shared client/configuration rather than embedding a path or origin in page components.

## Delivery model

When a write changes ticket or order state:

1. The backend commits authoritative state to PostgreSQL.
2. It publishes a small event after the successful transaction.
3. Redis pub/sub fans the event out to API instances.
4. Each instance forwards an authorized projection to connected clients.
5. Clients update their view or refetch the relevant REST resource.

Pub/sub is transient. Events published while a client is disconnected are not replayed, so reconnecting clients must fetch a fresh snapshot. Correctness must never depend on receiving every WebSocket message.

## Client behavior

Clients should:

- load an initial snapshot through REST;
- reconnect with capped exponential backoff and jitter;
- refetch after reconnecting;
- tolerate duplicate, delayed, and out-of-order notifications;
- validate message type and version before use;
- close connections when the authenticated session ends;
- surface a stale/offline state instead of pretending data is live.

Do not use local storage as a fallback source of truth for merchant orders or business data.

## Authentication and authorization

Ticket and merchant-order channels are being hardened. The intended controls are:

- exact origin allowlists;
- rate limits for connection attempts and messages;
- authentication for protected merchant subscriptions;
- per-subscription business ownership checks;
- token-expiry handling and bounded authentication time;
- connection, frame-size, queue, and idle limits.

Public ticket projections must expose only intentionally public fields. Merchant-order payloads must never be broadcast across merchant boundaries. A permitted `/ws/**` handshake is not proof that a client may subscribe to every topic.

## Scaling and failure handling

An in-memory connection registry is local to one API process. Redis pub/sub is required to fan events across multiple replicas, but Redis does not replace PostgreSQL.

Expected failure behavior:

- Redis unavailable: durable writes remain in PostgreSQL; real-time propagation may degrade and clients recover by refetching.
- WebSocket disconnected: REST remains usable.
- API replica restarted: clients reconnect and reload.
- Slow consumer: bound or drop its queue, then disconnect it rather than consuming unbounded memory.

Expose metrics for active connections, authentication failures, rejected subscriptions, publish/forward failures, reconnect rates, queue pressure, and message latency. Do not log tokens or full sensitive payloads.
