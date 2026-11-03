# 📘 PRD v3 — Flash Sale Engine (Single Region, Build-Ready)

---

# 1. 🎯 Scope (What you WILL build vs WON’T)

## ✅ In Scope

- High-concurrency order placement
- Redis-based stock control (zero oversell)
- Kafka async processing
- Order status tracking
- Rate limiting
- Observability (basic)

## ❌ Out of Scope (don’t get distracted)

- Multi-region replication
- Payment gateway
- Fancy UI
- Kubernetes

👉 Finish core system first. Everything else is ego.

---

# 2. 🧠 Final Architecture (Simplified but Strong)

![Image](https://miro.medium.com/v2/resize%3Afit%3A1400/1%2Aepet8HYZIJ9M4fb_3HV1Hg.jpeg)

![Image](https://miro.medium.com/v2/resize%3Afit%3A1200/1%2A5Bj64mvXDRDhec0Mw-uJdQ.png)

![Image](https://miro.medium.com/1%2Ab2phvszQyKIEbdMDzoBz4Q.png)

![Image](https://developer.ibm.com/developer/default/articles/eda-and-microservices-architecture-best-practices/images/order-processing-topology.png)

---

# 3. ⚙️ Services Breakdown (Keep it minimal)

## 🔹 1. Order Service (Spring Boot)

👉 Your main API

**Endpoints:**

```
POST /orders/place
GET  /orders/{orderId}
POST /admin/init
```

---

## 🔹 2. Worker Service (Spring Boot - separate module)

👉 Kafka consumer

---

## 🔹 3. Infra

- Redis
- Kafka
- PostgreSQL

---

# 4. 🔥 CORE CONTRACTS (Do NOT violate these)

This is where most people mess up.

---

## ✅ Contract 1: Hot path = Redis ONLY

```id="contract1"
Controller → Redis → Kafka → Return response
```

❌ No DB calls
❌ No heavy logic

---

## ✅ Contract 2: DB = eventual consistency only

```id="contract2"
Kafka → Consumer → PostgreSQL
```

---

## ✅ Contract 3: Every request must be idempotent

If this fails → your system is broken.

---

# 5. 🔁 Detailed Flow (Execution-Level)

---

## ⚡ Order API Flow

```id="order_flow"
1. Validate request
2. Rate limit check (Redis)
3. Execute Lua script
4. If success:
      → generate orderId
      → push to Kafka
      → store status = PENDING in Redis
      → return response
5. If fail:
      → return SOLD_OUT
```

---

## 🔁 Consumer Flow

```id="consumer_flow"
1. Consume Kafka message
2. Check idempotency (DB/Redis)
3. Insert into orders table
4. Update Redis status = SUCCESS
```

---

# 6. 🧱 Data Design

---

## PostgreSQL

```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    user_id INT,
    product_id INT,
    status VARCHAR(20),
    created_at TIMESTAMP
);
```

---

## Redis Keys

```id="redis_design"
flashsale:stock:{productId}
flashsale:user:{userId}:count
flashsale:order:{orderId}
```

---

# 7. 🧪 Failure Scenarios (YOU MUST HANDLE THESE)

---

## ❌ Case 1: Double Click Spam

👉 Fix: Rate limiting + idempotency

---

## ❌ Case 2: Redis success but Kafka fails

👉 Fix:

- Retry publish
- OR fallback queue (log-based retry)

---

## ❌ Case 3: Consumer crashes

👉 Kafka will replay

---

## ❌ Case 4: Duplicate Kafka message

👉 Idempotency check before DB insert

---

# 8. 🧠 Smart Tradeoffs (Mention in interview)

| Decision             | Why                          |
| -------------------- | ---------------------------- |
| Redis over DB        | latency + atomic ops         |
| Kafka async          | decoupling + reliability     |
| Single region        | simpler consistency          |
| Eventual consistency | performance over strict sync |

---

# 9. 🎨 Frontend PRD (Claude-Ready)

---

## 🖥️ Pages

### Flash Sale Page

- Product
- Countdown
- Buy button

---

## 🔄 States

```id="ui_states"
IDLE → COUNTDOWN → LIVE → PENDING → SUCCESS / FAILED
```

---

## ⚡ API Integration

```javascript
POST / orders / place;
GET / orders / { orderId };
```

---

## 🧠 Claude Prompt (use this EXACT)

```id="claude_prompt"
Build a high-performance React.js flash sale UI with:
- Countdown timer
- Buy button with loading state
- Handle API responses: SOLD_OUT, PENDING, SUCCESS
- Poll order status every 2 seconds
- Optimistic UI updates
- Minimal re-renders for performance
```

---

# 10. 🤖 Antigravity Prompt (Backend)

Use this:

```id="backend_prompt"
Generate a Spring Boot 3 project with:
- REST API for order placement
- Redis integration with Lua script for atomic stock decrement
- Kafka producer for order events
- Idempotency handling using Redis
- Separate Kafka consumer service
- PostgreSQL integration for order persistence
- Clean layered architecture (controller, service, repository)
```

---

# 11. 🐳 Docker Setup Plan

You’ll run:

- Redis
- Kafka + Zookeeper
- PostgreSQL

👉 Keep everything local first.

---

# 12. 📊 Metrics to Track

- API latency
- Redis ops/sec
- Kafka lag
- Success vs failure orders
