# Flash Sale Engine API Documentation

Base URL: `http://localhost:8080` (Order Service)

Both services (Order Service and Worker Service) work together, but all frontend and admin traffic routes through the **Order Service**.

---

## 1. Init Sale (Admin)
Seeds the initial stock for a product into Redis.

- **URL:** `/admin/init`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
```json
{
  "productId": 1,
  "stock": 100
}
```

### Response
- **200 OK**: `Flash sale initialized for productId: 1`

---

## 2. Place Order
Places a flash sale order. This endpoint is highly concurrent, rate-limited, and interacts natively with Redis to ensure zero oversell.

- **URL:** `/orders/place`
- **Method:** `POST`
- **Content-Type:** `application/json`

### Request Body
```json
{
  "userId": 42,
  "productId": 1,
  "quantity": 1
}
```

### Responses
**Success (202 Accepted)**
Order securely registered in Redis and enqueued to Kafka.
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "message": "Order placed successfully. Processing..."
}
```

**Sold Out (409 Conflict)**
```json
{
  "orderId": null,
  "status": "SOLD_OUT",
  "message": "Sorry, this item is sold out."
}
```

**Rate Limited (429 Too Many Requests)**
Triggered if the user exceeds the limit (e.g., >3 requests per 60 seconds).
```json
{
  "orderId": null,
  "status": "RATE_LIMITED",
  "message": "Too many requests. Please try again later."
}
```

---

## 3. Get Order Status
Validates the eventual state of an order. Useful for frontend polling.

- **URL:** `/orders/{orderId}`
- **Method:** `GET`
- **Content-Type:** `application/json`

### Responses
**Still Processing (200 OK)**
Worker service hasn't saved it to the DB yet.
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PENDING",
  "message": "Order status retrieved."
}
```

**Completed (200 OK)**
Worker service successfully persisted the order to PostgreSQL.
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "SUCCESS",
  "message": "Order status retrieved."
}
```

**Not Found (404 Not Found)**
```json
{
  "orderId": "INVALID_ID",
  "status": "NOT_FOUND",
  "message": "Order not found."
}
```
