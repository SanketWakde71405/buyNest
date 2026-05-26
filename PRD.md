# PRD — E-Commerce Backend API System

Tech Stack: Express.js + MongoDB

---

# 1. Product Overview

Build a scalable backend system for a modern e-commerce platform where customers can:

- Browse products
- Search and filter items
- Add products to cart
- Place orders
- Make payments
- Track orders
- Manage profiles

Admin users can:

- Manage products
- Manage inventory
- Handle orders
- Manage users
- View analytics

---

# 2. User Roles

## Customer
- Register/Login
- Browse products
- Manage cart
- Place orders
- Write reviews

## Admin
- CRUD products
- Manage categories
- Update order status
- Block users
- View sales analytics

---

# 3. Core Modules

## Module 1 — Authentication

### Features
- User registration
- Login
- Logout
- Refresh token
- Forgot password
- Reset password
- Email verification

### APIs
- POST `/api/auth/register`
- POST `/api/auth/login`
- POST `/api/auth/refresh-token`
- POST `/api/auth/forgot-password`
- POST `/api/auth/reset-password`

### Concepts to Practice
- JWT Access + Refresh Tokens
- Password hashing using bcrypt
- HTTP-only cookies
- Middleware
- Rate limiting

---

## Module 2 — User Management

### Features
- Get profile
- Update profile
- Upload avatar
- Address management
- Order history
- Wishlist

### APIs
- GET `/api/users/me`
- PATCH `/api/users/me`
- POST `/api/users/address`
- GET `/api/users/orders`
- POST `/api/users/wishlist/:productId`

---

## Module 3 — Product Management

### Features
- Create products
- Update products
- Delete products
- Product variants
- Inventory tracking
- Product images
- Categories
- Brands

### APIs
- POST `/api/products`
- GET `/api/products`
- GET `/api/products/:id`
- PATCH `/api/products/:id`
- DELETE `/api/products/:id`

### Query Examples

```bash
/api/products?page=1&limit=10
/api/products?category=electronics
/api/products?sort=price
/api/products?search=iphone
/api/products?minPrice=1000&maxPrice=5000
```

### Concepts to Practice
- Pagination
- Filtering
- Sorting
- Text indexes
- Aggregation pipeline
- MongoDB Atlas Search

---

## Module 4 — Categories

### APIs
- POST `/api/categories`
- GET `/api/categories`
- PATCH `/api/categories/:id`
- DELETE `/api/categories/:id`

---

## Module 5 — Cart System

### Features
- Add to cart
- Update quantity
- Remove item
- Apply coupon

### APIs
- POST `/api/cart`
- GET `/api/cart`
- PATCH `/api/cart/:itemId`
- DELETE `/api/cart/:itemId`

### Concepts
- Transactions
- Price recalculation
- Middleware validation

---

## Module 6 — Orders

### Features
- Create order
- COD / Online payment
- Order tracking
- Cancel order
- Return request

### APIs
- POST `/api/orders`
- GET `/api/orders/:id`
- GET `/api/orders/my-orders`
- PATCH `/api/orders/:id/cancel`
- PATCH `/api/admin/orders/:id/status`

### Concepts
- MongoDB transactions
- Stock management
- Race condition handling

---

## Module 7 — Payments

### Features
- Razorpay integration
- Verify payment
- Payment webhook

### APIs
- POST `/api/payments/create-order`
- POST `/api/payments/verify`
- POST `/api/payments/webhook`

---

## Module 8 — Reviews & Ratings

### APIs
- POST `/api/products/:id/reviews`
- GET `/api/products/:id/reviews`
- PATCH `/api/reviews/:id`
- DELETE `/api/reviews/:id`

---

## Module 9 — Coupons & Discounts

### APIs
- POST `/api/coupons`
- POST `/api/cart/apply-coupon`

---

## Module 10 — Admin Dashboard

### Analytics APIs
- GET `/api/admin/analytics/revenue`
- GET `/api/admin/analytics/top-products`
- GET `/api/admin/analytics/orders`

---

# 4. Non-Functional Requirements

## Security
- Helmet
- Rate limiting
- Input validation
- XSS protection
- CORS
- JWT auth

## Performance
- Database indexing
- Redis caching
- Compression
- Pagination

## Logging
- Morgan
- Winston

---

# 5. Suggested Folder Structure

```text
src/
├── config/
├── controllers/
├── routes/
├── models/
├── middlewares/
├── services/
├── repositories/
├── validators/
├── utils/
├── jobs/
├── uploads/
├── tests/
└── app.js
```

---

# 6. Recommended Packages

## Core
```bash
express
mongoose
dotenv
bcryptjs
jsonwebtoken
cookie-parser
cors
helmet
morgan
```

## Validation
```bash
zod
express-validator
```

## File Upload
```bash
multer
cloudinary
```

## Security
```bash
express-rate-limit
hpp
xss-clean
```

## Payments
```bash
razorpay
```

---

# 7. Final Goal

Build a backend that is:
- scalable
- secure
- modular
- production-ready
- optimized

This project is strong enough for:
- portfolio
- placements
- internships
- freelance backend work

