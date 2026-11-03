# Flash Sale Reservation Engine (Phase 2)

A production-grade, high-concurrency flash sale system built with Spring Boot, Redis, Kafka, and PostgreSQL.

## Features
- **Zero Overselling**: Uses atomic Lua scripts in Redis to guarantee inventory integrity.
- **Atomic Idempotency**: Prevents duplicate orders from rapid clicks via atomic Redis `SET NX` locks.
- **Reservation Lifecycle**: `RESERVED` -> `EXPIRED`/`SUCCESS`.
- **Safe Stock Recovery**: Scheduled worker uses optimistic locking on PostgreSQL to safely restore stock for expired reservations.
- **Kafka Resilience**: Graceful fallback queue processors poll for failed Kafka publishes.
- **Admin APIs**: Secured worker endpoints for monitoring orders and stock.

## Architecture

1. **Order Service (Port 8080)**
   - Hot path API: purely Redis + Kafka. No DB connections.
   - Handles rate limiting, atomic stock decrement, idempotency checks, and pushes events to Kafka.

2. **Worker Service (Port 8081)**
   - Consumes Kafka events asynchronously.
   - Saves final state to PostgreSQL.
   - Runs a scheduled chron job to expire abandoned reservations and restore stock.
   - Exposes secured admin APIs.

3. **Frontend (Port 3000)**
   - React application for countdown, rapid purchasing, and optimistic polling UI.

## Getting Started

### Using Docker Compose
1. Ensure Docker is running.
2. Build and start the entire stack:
   ```bash
   docker-compose up --build
   ```

### Demo Steps
1. **Initialize Stock (Admin)**
   ```bash
   curl -X POST http://localhost:8080/admin/init \
   -H "Content-Type: application/json" \
   -d '{"productId": 1, "stock": 100}'
   ```
2. **Access the Frontend**
   Open your browser to `http://localhost:3000` to interact with the Flash Sale.
3. **Check Admin APIs**
   ```bash
   curl -H "X-ADMIN-KEY: super-secret" http://localhost:8081/admin/reservations
   ```
