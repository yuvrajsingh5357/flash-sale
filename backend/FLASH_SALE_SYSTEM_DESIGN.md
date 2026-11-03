# Flash Sale System: Architectural Analysis & Interview Guide

## 1. SYSTEM OVERVIEW
* **Problem Solved:** Traditional RDBMS systems experience massive transaction contention lockouts, slow row-level locking, and connection pool exhaustion when thousands of users simultaneously buy limited inventory. This system prevents DB bottlenecks and guarantees zero overselling during burst traffic.
* **Type of System:** High-concurrency, event-driven, eventually consistent, asynchronous microservices architecture.
* **Core Design Goals:** 
  * Maximize throughput and lower latency during request ingestion.
  * Strictly enforce stock limits without race conditions (Zero-Oversell).
  * Decouple the fast validation phase from the slow persistence phase.
  * Guarantee high availability against burst traffic.

---

## 2. HIGH-LEVEL ARCHITECTURE
**Request Flow diagram:**
`Client → Order Service (API) → Redis → Kafka → Worker Service → PostgreSQL`

* **Order Service:** Entry point processing high-throughput HTTP traffic. Its primary job is lightweight validation and event generation.
* **Redis:** Acts as the atomic gatekeeper. It handles rate limiting and inventory decrementing in-memory without hitting the database.
* **Kafka:** Message broker that acts as a buffer/shock absorber. It ingests large spikes in approved orders and queues them for slow processing, protecting the DB from overwhelming pressure.
* **Worker Service:** Background consumer that pulls from Kafka at its own safe pace, does the heavy lifting, and updates the permanent data store.
* **PostgreSQL:** Source of ultimate truth for order history, isolated entirely from the flash sale burst traffic.

---

## 3. DETAILED REQUEST FLOW
**Step-by-step when a User clicks “Buy”:**
1. **API Ingest:** Request hits `POST /orders/place` in `OrderService`.
2. **Rate Limiting (Redis):** Checks `RateLimiterService`. A Redis counter uses an atomic `INCR` to ensure the user hasn't exceeded the max rate within the designated time frame. If exceeded, returns `429 Too Many Requests`.
3. **Inventory Check (Redis):** A Lua script atomically fetches the current stock. If stock >= requested quantity, it decrements and allows the flow. If `0`, returns `409 Conflict` (Sold Out).
4. **Idempotency Tagging & Status Generation:** A unique `orderId` is generated. A Redis key indicating processing intent (`flashsale:idem:{orderId}`) is stored, and the order status is set to `PENDING` (`flashsale:order:{orderId}`).
5. **Event Queuing (Kafka):** The `OrderService` serializes building an `OrderEvent` and asynchronously publishes it to the `order_events` topic.
6. **Fast API Response:** The client instantly receives a `PENDING` status payload. 
7. **Async DB Persistence (Worker):** The `worker-service` consumes the Kafka topic. It validates idempotency using the DB (`existsById`). It then commits the order to PostgreSQL.
8. **Final State Resolution (Redis):** Upon successful DB commit, the worker updates the Redis order status key to `SUCCESS`. Client polling `/orders/{orderId}` will now see the terminal state.

---

## 4. REDIS DESIGN (CRITICAL)
* **Stock Storage:** The admin initially seeds the integer stock constraint to the `flashsale:stock:{productId}` key.
* **The Lua Script:**
  ```lua
  local stock = tonumber(redis.call('GET', KEYS[1]))
  if stock == nil or stock < tonumber(ARGV[1]) then
      return 0
  end
  redis.call('DECRBY', KEYS[1], ARGV[1])
  return 1
  ```
* **Why Atomicity is Needed:** Without Lua, retrieving the stock and decrementing it requires two round-trips to Redis. Thousands of users could execute `GET` when stock is 1, and all would try to decrement, resulting in a negative value (an "oversell"). Lua guarantees atomicity—the script runs entirely without interruption from other commands.
* **High Concurrency Behavior:** Redis is single-threaded. By delegating all stock-math to an atomic Lua step, Redis can perfectly sequence the decr/fail logic for over 100k requests/sec safely.

---

## 5. KAFKA DESIGN
* **Topic Structure:** A single topic `order_events` serves as the pipeline for successful stock validations.
* **Producer Flow:** The `kafkaTemplate.send()` wraps the JSON payload. Serialization logic leverages Spring's `JsonSerializer`. Delivery relies on a non-blocking asynchronous callback, logging failures if necessary. Keys are set to the `orderId`.
* **Consumer Flow:** `OrderListener` pulls events from `order-events` assigned to `worker-group`. Since `orderId` is used as the Kafka message key, ordered processing per order ID is natively handled (all events for a specific orderId route to a guaranteed partition).
* **Why Async:** If the `OrderService` blocked to write to Postgres, the Tomcat thread pool would exhaust in milliseconds under flash sale load. Kafka detaches the latency of the API from the latency of the Database.

---

## 6. IDEMPOTENCY
* **Consumer Duplicate Handling (Implemented correctly):** Kafka delivers at-least-once. For resilience, when the `WorkerService` consumes, it first hits the database `orderRepository.existsById()`. If found, it drops the duplicate message.
* **Client Request Retries (Current Flaw):** Though the code writes an idempotency key (`flashsale:idem:{orderId}`), `orderId` is generated purely on the backend. This means if a user is trapped in a network timeout and retries, the backend creates an entirely separate order and deducts *more* stock. Ideal idempotency should rely on a unique `Idempotency-Key` passed via the client request header.

---

## 7. DATA CONSISTENCY
* **Eventual Consistency:** Redis holds volatile state and controls stock validity. Postgres holds durable truth logic. The system is unconcerned with DB lag; stock limits are absolute in Redis, bypassing typical RDBMS replication lag issues.
* **Inconsistency Scenarios:** 
  1. *Stock Leak:* Redis stock is decremented in `OrderService` natively, but the subsequent Kafka publish throws an exception (e.g. timeout). The 1 unit of stock is gone forever.
  2. *Status Desync:* The `WorkerService` successfully saves an order to PostgreSQL, but fails or crashes immediately before updating `flashsale:order:{orderId}` to `SUCCESS`. The database shows success, but the frontend polling user receives `PENDING` indefinitely.

---

## 8. FAILURE SCENARIOS (VERY IMPORTANT)
* **Redis failure:**
  * *Currently:* Entire system goes offline. `OrderService` throws connection exceptions. No users can purchase.
  * *Ideally:* System is configured with Redis Sentinel/Cluster for HA. Fallback mechanisms are incredibly difficult for Flash Sales, rejecting requests quickly is preferred.
* **Kafka failure:**
  * *Currently:* `OrderService` deducts Redis stock but silently swallows the Kafka error (only logs it). Data is lost and users' orders are permanently `PENDING`.
  * *Ideally:* Utilize a Transactional Outbox Pattern to stash events in a local Redis queue or DB table if Kafka is offline.
* **Worker crash:**
  * *Currently:* No data loss. The worker simply stops pulling from Kafka. Upon restart, it natively resumes from its last committed offset. Safe against drops due to at-least-once + DB validation.
* **DB failure:**
  * *Currently:* `worker-service` throws JpaSystemExceptions and messages likely bounce back to Kafka retries, stalling partition consumption depending on Spring auto-offset configs.
  * *Ideally:* Implement exponential backoff for consumer retries and route poison-pill payloads to a Dead Letter Queue (DLQ).
* **Network issues (Client-API):**
  * *Currently:* Potential duplicate orders up to the rate-limit cap if the frontend retries blindly.

---

## 9. SCALABILITY ANALYSIS
* **Horizontal Scaling:** The `order-service` is entirely stateless and can scale to arbitrarily many nodes. It heavily depends on Redis. 
* **Bottlenecks:** Redis CPU single-thread capacity bounds maximum theoretical throughput. The `WorkerService` can only scale horizontally up to the maximum number of partitions allocated to the `order_events` Kafka topic. If the topic has 10 partitions, no more than 10 Workers can achieve concurrency.

---

## 10. DESIGN TRADE-OFFS
* **Redis vs DB:** Traded strong ACID constraints and relational integrity in the hot path for blistering speed and throughput limits.
* **Kafka vs Synchronous HTTP:** Traded application simplicity and immediate client feedback (Client knows final terminal order status instantaneously) for high availability and shock-absorption. 
* **Worker Polling vs Webhooks:** Client must actively poll for their PENDING order to turn SUCCESS. Traded bandwidth and frontend complexity for backend simplicity (no WebSocket/SSE management necessary in a highly chaotic server environment).

---

## 11. IMPROVEMENTS / RED FLAGS (CRITICAL)
1. **Critical: No Outbox Pattern.** Subtracting stock in Redis but relying on a non-transactional Kafka push opens the system to data loss/stock rot if Kafka brokers drop connections.
2. **Critical: Broken Client Idempotency.** `PlaceOrderRequest` must accept a client-generated UUID for the `IDEM_KEY` limit. Currently, double-clicks = double charges (up to max rate limit). 
3. **Missing Dead Letter Queues (DLQs).** Errors in worker deserialization presently `return` and are ignored, permanently throwing away the order event despite it removing stock.
4. **Resiliency:** Rate limiter operates on bare increments; does not utilize sliding windows gracefully, making edge-bursts over the minute boundary possible.
5. **No Stock Recovery Loop:** Unpaid or cancelled transactions have no scheduled event or mechanism to return "PENDING/FAILED" stock back to the Redis stock integer.

---

## 12. INTERVIEW PREP SECTION

### A. 2-Minute Explanation
"This codebase implements a high-throughput, eventually consistent Flash Sale system using Spring Boot, Redis, Kafka, and Postgres. To handle massive bursts of traffic safely while preventing overselling, traditional DB validation was bypassed. Instead, the `OrderService` uses Redis as its primary validator, leveraging atomic Lua scripts to decree stock decrements and manage user rate limits in a single round trip. Once an order validates in Redis, it immediately enters a `PENDING` state and passes asynchronously into Kafka. This allows the backend to return an HTTP status to the user in milliseconds. A secondary `WorkerService` quietly consumes these Kafka events at a controlled rate, performing DB-level deduplication to prevent duplicates, inserting the order into PostgreSQL natively, and then finally bouncing back to Redis to mark the order `SUCCESS`, which the client polling receives."

### B. 30-Second Explanation
"It's an event-driven choke-valve architecture to prevent database blowups. Requests hit an API, an atomic Lua script validates stock in Redis in-memory. If approved, the request is published to Kafka and the user gets a lightweight PENDING status. A background Worker pulls from Kafka, writes to Postgres, and flips Redis to SUCCESS. It guarantees high throughput and zero DB locks, but trades off absolute consistency and instantaneous feedback."

### C. 5 Strong Talking Points
1. **Lua Predictability:** "We used Lua in Redis to guarantee atomicity. It eliminates standard read-modify-write race conditions under high thread contention without needing expensive synchronization locks."
2. **Async Shock Absorption:** "Kafka handles the burst impedance mismatch. Postgres processes 1000 ops/sec, while our API ingests 100,000 ops/sec. Kafka holds the line."
3. **Idempotency Dual-Layering:** "We consider idempotency on two fronts: Client to API (which needs a client UUID), and robust Consumer idempotency where database primary key checks repel any Kafka at-least-once duplicate deliveries."
4. **Rate Limiting:** "Implemented lightweight Redis TTL incrementing to repel abusive bot traffic from exhausting actual valid connections."
5. **Eventual Consistency Reality:** "I readily admit the system accepts potential stock leaks. An API crash after Redis deduplication but before Kafka ingestion causes lost inventory. A formalized Outbox Pattern is the natural next step for strict durability."

### D. 10 Likely Interview Questions with Answers

1. **Q:** Why Lua script and not `Redisson` distributed locks?
   * **A:** Locks introduce latency and possible deadlocks. Lua scripts execute sequentially in the Redis engine natively for microsecond latency.
2. **Q:** If user clicks "Buy" twice gracefully bypassing frontend blocks, what happens here?
   * **A:** Rate Limiter triggers at 3. The backend generates unique order IDs for both. They both consume stock. This is a flaw; idempotency keys must come from the client request.
3. **Q:** How do you handle Kafka's "at-least-once" message delivery creating duplicate orders in the DB?
   * **A:** The `WorkerService` relies on natural database existence checks (`existsById`) against the generated order ID. 
4. **Q:** If Redis goes down, can the sale continue?
   * **A:** No. Redis is a hard dependency here. The only mitigation is robust clustered high availability environments or Redis Sentinels.
5. **Q:** How does a user know their order succeeded if the operation is fundamentally async?
   * **A:** Short polling. The client hits `/orders/{orderId}` every few seconds to check if the state flipped from PENDING to SUCCESS.
6. **Q:** You decrement stock in Redis, then call `kafkaTemplate.send()`. If `send()` throws an exception, what happens to the stock?
   * **A:** It acts as leaked stock. The order fails asynchronously, but stock is gone. Implementing a transactional outbox would fix this.
7. **Q:** How can we ensure we never have more workers than necessary?
   * **A:** Kafka Consumer groups map 1:1 up to the number of partitions. Any workers greater than the topic's partition count will sit idle. 
8. **Q:** Why use `Integer` for stock but rely on strings for serialization? 
   * **A:** Simplifies debugging across microservices mapping via Jackson without imposing heavy class dependencies across modules natively.
9. **Q:** If the worker crashes mid-DB save, what happens to the message?
   * **A:** Kafka tracks offsets. If it hasn't committed the offset natively as complete via spring configurations context, upon restart, it fetches the same message and retries.
10. **Q:** What is the tradeoff of relying on Eventual Consistency for an Ecommerce application?
    * **A:** The immediate benefit is extreme scalability and reliability. The cost is architectural complexity; error remediation requires complicated tools like DLQs and reconciliation jobs instead of relying on a single DB transaction rollback.
