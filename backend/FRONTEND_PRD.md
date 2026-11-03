# Flash Sale Frontend PRD

**Goal:** Build a high-performance, responsive React application (using Vite + Tailwind CSS) for a Flash Sale Engine. 

**Note to AI (Claude):** Read this specification carefully. The backend is already built in Spring Boot and highly concurrent. You must implement specific optimisic UI updates and polling logic to support the backend's eventual consistency model.

---

## 1. Tech Stack
- React 18+ (Vite)
- Tailwind CSS (for styling)
- Axios or Fetch
- Lucide React (for icons)

## 2. Pages & Layout
### Single Page App: "Flash Sale Live Event"
- **Header:** Simple logo, User ID simulator (allow typing/changing a mock `userId` between 1-100 to test rate limiting).
- **Hero Section:** Product Image, Title, Description, and Price.
- **Action Area:** Countdown Timer and the Buy Button.
- **Status Toast / Banner:** To show success, error, or rate-limited messages.

## 3. UI States & Flow

```text
[ IDLE ] -> [ COUNTDOWN ] -> [ LIVE ] -> [ PENDING ] -> [ SUCCESS / FAILED / SOLD_OUT ]
```

1. **COUNTDOWN:** Sale hasn't started. Button is disabled.
2. **LIVE:** Sale is active. Button says "Buy Now".
3. **PENDING:** User clicked Buy. The backend returned `PENDING`. Button shows a loading spinner.
4. **SUCCESS / SOLD_OUT:** Final state based on polling.

## 4. API Integration Details

The backend runs on `http://localhost:8080`.

### 4.1. Place Order
- **Endpoint:** `POST /orders/place`
- **Payload:** `{ "userId": <state>, "productId": 1, "quantity": 1 }`
- **Behaviors:**
  - If `202 PENDING` -> Extract `orderId`, transition UI to `PENDING` state, start polling.
  - If `409 SOLD_OUT` -> Show sold out UI, disable button.
  - If `429 RATE_LIMITED` -> Show toast: "Too many requests. Please slow down."

### 4.2. Polling Order Status
- **Endpoint:** `GET /orders/{orderId}`
- **Requirement:** Once an order is `PENDING`, poll this endpoint exactly every **2 seconds**.
- **Behaviors:**
  - If response returns `"status": "SUCCESS"` -> Stop polling, show Success Confetti/Receipt.
  - If response returns `"status": "FAILED"` -> Stop polling, show Error.
  - If response returns `"status": "PENDING"` -> Continue polling.

## 5. Performance Requirements (CRITICAL)
- **Minimal Re-renders:** The countdown timer must NOT force the entire page to re-render every second. Extract the timer into its own isolated component.
- **Optimistic UI:** When the user clicks "Buy", immediately show the loading state before the `POST` request even completes.
- **Debouncing:** If the user spams the Buy button, disable it instantly on the first click to prevent frontend-induced rate limits (though backend will catch it).

## 6. Prompt to Generate the Code
*(Pass this to the AI generating the code)*

> "Initialize a new React project using Vite and Tailwind CSS. Implement the Flash Sale UI based on the states and API endpoints provided in this PRD. Ensure that the countdown timer is an isolated component to prevent parent re-renders. Use standard `fetch` or `axios` to hit `http://localhost:8080/orders`. Implement the 2-second polling logic cleanly using custom hooks."
