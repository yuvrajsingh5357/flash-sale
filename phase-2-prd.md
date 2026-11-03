So we’ll design it properly as:

> **Flash Sale Reservation Engine (Phase 2)**
> → Stock is reserved temporarily
> → Must expire or confirm later (future payment phase)

---

# 🧠 Decisions Locked

- Target → **Developer showcase + deployable product**
- Model → **Single-tenant**
- Scope → **Reservation-based (no payments yet)**
- Goal → **Production-grade system, not demo**

---

# 🚀 PHASE 2 PRD (Refined for YOUR direction)

## 🎯 Product Positioning

> “A deployable flash sale reservation engine that guarantees zero oversell and supports high concurrency with real-time order tracking.”

---

# 1. 🔥 Core Problem You STILL Haven’t Solved

Right now:

- Stock decreases ✅
- Order becomes SUCCESS ❌ (fake success)

👉 That’s wrong.

We fix this by introducing **reservation lifecycle**.

---

# 2. 🔁 NEW ORDER LIFECYCLE

```text
PENDING → RESERVED → CONFIRMED / EXPIRED / CANCELLED
```

### Meaning:

- **PENDING** → request accepted
- **RESERVED** → stock locked (user has time window)
- **CONFIRMED** → (future: payment success)
- **EXPIRED** → user didn’t complete flow → stock returned
- **CANCELLED** → user manually cancels

👉 This alone upgrades your system from “demo” → “real system”

---

# 3. ⚙️ REQUIRED FEATURES (No excuses)

## 3.1 ⏳ Reservation TTL System (CRITICAL)

You MUST implement:

- Each reservation expires after **X minutes (e.g., 5 min)**
- Redis key:

```text
flashsale:reservation:{orderId} → TTL = 300s
```

### Expiry Handling:

Two options:

### Option A (simple)

- Background scheduler (Spring @Scheduled)

### Option B (better)

- Redis Keyspace Notifications (event-driven)

👉 Start with A. Don’t get fancy yet.

---

## 3.2 🔄 Stock Recovery (Fix your leak)

Flow:

```text
If order EXPIRED:
    → INCR stock in Redis
    → update status = EXPIRED
```

👉 This fixes the biggest flaw already identified

---

## 3.3 🧠 Client Idempotency (MANDATORY)

Right now:

> Double click = double stock deduction

Fix:

Header:

```text
Idempotency-Key: UUID
```

Redis:

```text
flashsale:idem:{key}
```

Behavior:

- If exists → return same response
- If not → process

---

## 3.4 📊 Admin APIs (Make it usable)

You need:

### Product Management

- Create product
- Set stock
- Set sale time

### Monitoring

- Active reservations
- Remaining stock
- Orders count

👉 Without this, no one can _use_ your system.

---

## 3.5 📡 Replace Polling (Optional but strong upgrade)

Your current polling is fine, but:

If you want to stand out:

- Use **SSE (Server-Sent Events)**

Why SSE over WebSocket?

- Simpler
- One-way (perfect for status updates)
- Easier to implement in Spring

---

## 3.6 🧱 Minimal Resilience Upgrade

Don’t go full enterprise yet.

Just fix:

### Kafka failure retry

- Retry send 3 times
- If fail → log + fallback queue (Redis list)

---

# 4. 🧠 UPDATED FLOW (CLEAN + REAL)

```text
1. User clicks BUY

2. Order Service:
   → Rate limit
   → Redis Lua (stock--)
   → create orderId
   → store status = RESERVED
   → set TTL (reservation)

3. Push event to Kafka

4. Worker:
   → persist to DB
   → confirm RESERVED state

5. Scheduler:
   → check expired reservations
   → restore stock
   → mark EXPIRED
```

---

# 5. 🧱 DATA MODEL UPDATE

## PostgreSQL

```sql
orders (
    id UUID,
    user_id INT,
    product_id INT,
    status VARCHAR(20),
    reserved_until TIMESTAMP,
    created_at TIMESTAMP
)
```

---

## Redis Keys

```text
flashsale:stock:{productId}
flashsale:order:{orderId}
flashsale:reservation:{orderId} (TTL)
flashsale:idem:{key}
```

---

# 6. 🎯 MVP CHECKLIST (SHIP THIS)

Don’t drift. Build only this:

- [ ] Reservation lifecycle (RESERVED, EXPIRED)
- [ ] TTL + stock recovery
- [ ] Idempotency fix
- [ ] Admin APIs
- [ ] Docker setup
- [ ] Clean README + demo

👉 That’s enough to impress AND deploy.
