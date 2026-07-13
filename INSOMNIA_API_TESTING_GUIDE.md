# Insomnia API Testing Guide

## Setup

### 1. Install Insomnia
Download from: https://insomnia.rest/download

### 2. Import the Collection
1. Open Insomnia
2. Click **Create** → **Import From File**
3. Select `insomnia-collection.json` from this directory
4. The "Scanny API" workspace will be created with all endpoints

### 3. Environment Variables
The collection includes these variables (already configured):
```json
{
  "base_url": "http://localhost:4000",
  "keycloak_url": "http://localhost:8080",
  "realm": "scanny",
  "client_id": "scanny-client",
  "admin_client_id": "scanny-admin",
  "access_token": ""
}
```

## Testing Workflow

### Step 1: Start Backend Services
```bash
# Start PostgreSQL and Keycloak
cd backend
docker-compose up -d

# Start Spring Boot backend
mvn spring-boot:run
```

Backend should be running on `http://localhost:4000`

### Step 2: Get Authentication Token

#### For Merchant APIs:
1. Go to **Authentication** → **Get Keycloak Token (Merchant)**
2. Update the request body:
   - `username`: Your merchant email
   - `password`: Your merchant password
3. Click **Send**
4. Copy the `access_token` from the response
5. Set it in the environment: Click the environment dropdown → Edit → Paste token into `access_token` field

#### For Admin APIs:
1. Go to **Authentication** → **Get Keycloak Token (Admin)**
2. Update the request body:
   - `username`: Your admin email (e.g., `admin@scanny.app`)
   - `password`: Your admin password
3. Click **Send**
4. Copy the `access_token` from the response
5. Update the environment variable `access_token`

### Step 3: Test Endpoints

## API Collections

### 🔐 Authentication
- **Merchant Registration** - Register a new merchant (no auth required)
- **Get Keycloak Token (Merchant)** - Login and get access token
- **Get Keycloak Token (Admin)** - Admin login

### 👨‍💼 Merchant APIs (Requires Merchant Token)
- **Get Merchant Profile** - View merchant details
- **Get QR Code** - Retrieve merchant's QR code

### 📋 Catalog Management (Requires Merchant Token)
- **List Menu Items** - Get all menu items
- **Create Menu Item** - Add new item to menu
- **Update Menu Item** - Edit existing item
- **Delete Menu Item** - Remove item from menu

### 📦 Order Management (Requires Merchant Token)
- **List Orders** - View all merchant orders
- **Get Order Details** - View specific order
- **Update Order Status** - Change order status (PENDING → PREPARING → READY → COMPLETED)
- **Update Payment Status** - Mark order as PAID/UNPAID/REFUNDED

### 👥 Customer APIs (Public - No Auth)
- **Get Public Menu** - View merchant's public menu
- **Create Order** - Customer places an order

### 🔧 Admin APIs (Requires Admin Token)
- **Dashboard Metrics** - Platform statistics
- **Recent Activity** - Platform activity feed
- **List All Merchants** - View all merchants
- **List All Orders** - View all orders across platform

## Quick Start Examples

### 1. Register a Merchant
```json
POST http://localhost:4000/api/auth/merchant/register

{
  "businessName": "Test Cafe",
  "businessType": "Restaurant",
  "email": "testcafe@example.com",
  "phoneNumber": "+256700000001",
  "paymentDestination": {
    "type": "MOBILE_MONEY",
    "provider": "MTN",
    "number": "+256700000001",
    "accountName": "Test Cafe"
  },
  "termsAccepted": true
}
```

### 2. Get Authentication Token
```
POST http://localhost:8080/realms/scanny/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&client_id=scanny-client&username=merchant@example.com&password=your-password
```

### 3. Create Menu Item
```json
POST http://localhost:4000/api/merchant/items
Authorization: Bearer {your-token}

{
  "name": "Chicken Wings",
  "description": "Spicy grilled chicken wings",
  "price": 25000,
  "category": "Appetizers",
  "available": true
}
```

### 4. Update Order Status
```json
PATCH http://localhost:4000/api/merchant/orders/{orderId}/status
Authorization: Bearer {your-token}

{
  "status": "PREPARING"
}
```

## Tips

### Setting Access Token
1. After getting a token, copy it
2. Click on the environment dropdown (top left)
3. Click **Manage Environments**
4. Paste the token into the `access_token` field
5. All requests will now use this token automatically

### Replacing Path Parameters
- For endpoints like `/api/merchant/items/{itemId}`
- Replace `{itemId}` with the actual ID from a previous response
- Example: `/api/merchant/items/123e4567-e89b-12d3-a456-426614174000`

### Testing Order Flow
1. **Customer**: Call `GET /api/menu/{merchantCode}` to see menu
2. **Customer**: Call `POST /api/orders` to place order
3. **Merchant**: Call `GET /api/merchant/orders` to see new order
4. **Merchant**: Call `PATCH /api/merchant/orders/{id}/status` to update status
5. **Merchant**: Call `PATCH /api/merchant/orders/{id}/payment` to mark as paid

### Debugging
- Check **Timeline** tab to see request/response details
- Use **Preview** for formatted JSON responses
- Check **Headers** tab to verify Authorization header is sent

## Common Issues

### 401 Unauthorized
- Token expired (tokens expire after 30 minutes)
- Get a new token from the Authentication folder
- Make sure you're using the correct token (merchant vs admin)

### 403 Forbidden
- You're authenticated but don't have permission
- Make sure you're using the right role (MERCHANT vs ADMIN)
- Admin endpoints require admin token

### 404 Not Found
- Check that backend is running on port 4000
- Verify the endpoint URL is correct
- Make sure you replaced path parameters like `{itemId}`

### 500 Internal Server Error
- Check backend logs in terminal
- Database might not be running (`docker-compose up -d`)
- Invalid request body format

## Status Codes
- **200 OK** - Success
- **201 Created** - Resource created successfully
- **204 No Content** - Success with no response body
- **400 Bad Request** - Invalid request data
- **401 Unauthorized** - No token or expired token
- **403 Forbidden** - Not authorized for this action
- **404 Not Found** - Resource doesn't exist
- **500 Internal Server Error** - Backend error

## Next Steps
1. Test merchant registration
2. Get authentication token
3. Test CRUD operations on menu items
4. Test order creation and status updates
5. Test admin endpoints with admin token
