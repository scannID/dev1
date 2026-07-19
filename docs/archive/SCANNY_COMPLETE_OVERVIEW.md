# 🎯 Scanny - QR Menu & Ordering Platform
## Complete Product Overview & Technical Architecture

---

## 📱 What is Scanny?

**Scanny** is a modern, contactless QR menu and ordering platform designed for restaurants, bars, schools, and boutiques. Customers scan a QR code, browse the menu on their phone, and place orders instantly—no app download required. Merchants manage their catalog and orders in real-time through a beautiful web dashboard.

---

## 🎭 Three Interfaces, One Platform

### 1. 👥 **Customer Experience** (Public Web App)
**URL:** `https://scanny.app/menu/{merchant-code}`

#### The Journey:
1. **Scan QR Code** - Customer scans QR at their table/location
2. **Browse Menu** - Instant access to full menu with photos, prices, descriptions
3. **Place Order** - Select items, add special instructions, submit order
4. **Track Status** - See order status update in real-time (Pending → Preparing → Ready)
5. **No App Required** - Everything in the browser, works on any phone

#### Key Features:
- ✅ **Zero Friction** - No download, no signup, no friction
- ✅ **Mobile-First Design** - Optimized for phone screens
- ✅ **Real-Time Updates** - Order status updates automatically
- ✅ **Offline-Friendly** - Menu loads even with poor connection
- ✅ **Accessibility** - Screen reader compatible, high contrast mode

---

### 2. 🏪 **Merchant Dashboard** (Business Portal)
**URL:** `http://localhost:5173` (Production: merchant.scanny.app)

#### What Merchants Can Do:

**📋 Catalog Management**
- Add/edit/delete menu items
- Set prices, descriptions, photos
- Organize by categories
- Mark items as available/unavailable
- Bulk import via CSV

**📦 Order Management**
- View orders in real-time as they arrive
- Update order status (Pending → Preparing → Ready → Completed)
- Mark payment status (Paid/Unpaid/Refunded)
- See customer names, table numbers, special instructions
- Order history and search

**📊 Dashboard & Analytics**
- Today's orders count and revenue
- Pending orders requiring action
- Popular items
- Revenue trends
- Customer insights

**🔍 QR Code Management**
- Download QR code as PNG/PDF
- Print-ready format with branding
- Track QR scan analytics
- Regenerate if lost

**⚙️ Settings**
- Business profile management
- Payment destination settings
- Operating hours
- Notification preferences

#### Merchant Journey:
1. **Admin creates account** via admin console
2. **Email verification** - Merchant receives email, sets password
3. **First login** - QR code auto-generates
4. **Add menu items** - Build catalog
5. **Download QR** - Print and display
6. **Receive orders** - Start serving customers

---

### 3. 🔧 **Admin Console** (Platform Management)
**URL:** `http://localhost:5174` (Production: admin.scanny.app)

#### Super Admin Powers:

**📊 Platform Overview Dashboard**
- Total merchants, orders, revenue
- QR scan statistics
- Active merchants vs pending
- Platform health metrics
- Recent activity feed

**👥 Merchant Management**
- Create new merchant accounts
- View all merchants with stats
- Suspend/activate accounts
- View merchant details and performance
- Search and filter merchants

**📦 Order Monitoring**
- View ALL orders across platform
- Filter by status, payment, merchant
- Platform-wide order statistics
- Identify issues and trends

**👤 User Management**
- View all platform users (merchants, customers, admins)
- Role management
- Account status monitoring

**⚙️ System Administration**
- Platform configuration
- System health monitoring
- API status checks
- Database metrics
- Revenue & payout tracking

---

## 🛠️ Technical Architecture

### **Frontend Stack**

#### **Customer App** (Main App)
```
📱 Technology Stack:
├── React 18 + TypeScript
├── Vite (Build Tool)
├── TailwindCSS (Styling)
├── Keycloak JS (Authentication)
├── React Router (Navigation)
└── Sonner (Toast Notifications)

🎨 Design System:
├── Outfit Font (Variable)
├── OKLCH Color System
├── Dark Mode Support
├── Responsive Grid Layout
└── Custom Component Library
```

#### **Merchant Dashboard** (Main App - Different Routes)
- Same tech stack as customer app
- Protected routes requiring authentication
- Real-time order updates via polling
- Optimistic UI updates

#### **Admin Console** (Separate App)
```
🔧 Technology Stack:
├── React 18 + TypeScript
├── Vite (Build Tool)
├── TailwindCSS + Custom Admin CSS
├── Keycloak JS (Admin Authentication)
├── shadcn/ui Components
└── Lucide React Icons

📊 Features:
├── Separate Keycloak client (scanny-admin)
├── Admin-specific styling
├── Data visualization
├── Bulk operations
└── Advanced filtering
```

---

### **Backend Stack**

```
☕ Core Framework:
├── Spring Boot 3.2
├── Java 21
├── Maven (Build Tool)
└── RESTful API Architecture

🔐 Authentication & Authorization:
├── Keycloak (Identity Provider)
├── OAuth 2.0 / OpenID Connect
├── JWT Token-based auth
├── Role-based access control (RBAC)
└── Roles: MERCHANT, ADMIN, CUSTOMER

💾 Database:
├── PostgreSQL 15
├── JPA/Hibernate (ORM)
├── Flyway (Migrations)
└── Connection Pooling (HikariCP)

🔒 Security:
├── Spring Security
├── CORS Configuration
├── CSRF Protection
├── Token Validation
└── Secure Password Hashing

📦 Key Libraries:
├── Lombok (Boilerplate reduction)
├── Jackson (JSON processing)
├── Validation API
├── QR Code Generator
└── Spring Data JPA
```

---

### **Infrastructure & DevOps**

```
🐳 Containerization:
├── Docker (PostgreSQL + Keycloak)
├── Docker Compose (Local dev)
└── Ready for production containerization

🔑 Identity Management:
├── Keycloak Server (Port 8080)
├── Realm: "scanny"
├── Clients: scanny-client, scanny-admin
└── Custom Theme (Branded login pages)

🗄️ Database:
├── PostgreSQL 15
├── Port: 5432
├── Database: scanit_db
└── Automated migrations

🌐 Ports & URLs:
├── Backend API: localhost:4000
├── Customer/Merchant App: localhost:5173
├── Admin Console: localhost:5174
├── Keycloak: localhost:8080
└── PostgreSQL: localhost:5432
```

---

## 🔄 Complete User Flows

### **Flow 1: Merchant Onboarding**

```
1. Admin Console
   └── Admin creates merchant account
   └── Enters: Business name, type, email, phone, payment info
   └── Submits to: POST /api/auth/merchant/register

2. Backend Processing
   └── Creates Keycloak user (MERCHANT role)
   └── Saves merchant to PostgreSQL
   └── Sends verification email

3. Merchant Email
   └── Receives verification link
   └── Clicks link → Keycloak verification page
   └── Sets password

4. Merchant First Login
   └── Goes to merchant.scanny.app
   └── Logs in with email + password
   └── QR code auto-generates (6-char token)
   └── Sees dashboard

5. Merchant Setup
   └── Adds menu items (name, price, photo, category)
   └── Downloads QR code
   └── Prints and displays QR at location
   └── Ready to receive orders! ✅
```

---

### **Flow 2: Customer Ordering**

```
1. Customer Arrival
   └── Customer arrives at restaurant/venue
   └── Sees QR code on table/counter
   └── Opens phone camera
   └── Scans QR code

2. Menu Loading
   └── Browser opens: scanny.app/menu/ABC123
   └── GET /api/menu/{merchantCode}
   └── Merchant's full menu loads
   └── Shows items with photos, prices, availability

3. Browsing & Selection
   └── Customer browses categories
   └── Clicks items to see details
   └── Adds items to cart
   └── Adds special instructions (e.g., "No onions")
   └── Enters name and table number

4. Order Placement
   └── Clicks "Place Order"
   └── POST /api/orders
   └── Order sent to backend
   └── Order saved to database
   └── Response: Order ID + status

5. Merchant Notification
   └── Merchant dashboard shows new order
   └── Real-time update (or refresh)
   └── Shows: Customer name, items, table, time
   └── Status: PENDING

6. Order Processing
   └── Merchant clicks "Preparing"
   └── PATCH /api/merchant/orders/{id}/status
   └── Status → PREPARING
   
   └── Kitchen prepares food
   
   └── Merchant clicks "Ready"
   └── Status → READY
   
   └── Customer picks up order
   
   └── Merchant clicks "Completed"
   └── Status → COMPLETED
   
   └── Marks as "Paid"
   └── PATCH /api/merchant/orders/{id}/payment

7. Payment & Completion
   └── Order complete
   └── Statistics updated
   └── Revenue recorded
   └── Available in order history
```

---

### **Flow 3: Admin Monitoring**

```
1. Platform Overview
   └── Admin logs into admin console
   └── Dashboard shows:
       ├── Total merchants: 142
       ├── Orders today: 1,847
       ├── Active QR scans: 8,304
       ├── Platform revenue: UGX 4.2M
       └── Recent activity feed

2. Merchant Management
   └── Views merchant list
   └── Sees: Active, pending, suspended
   └── Can create new merchants
   └── Can suspend accounts
   └── Views merchant statistics

3. Order Monitoring
   └── Views all orders across platform
   └── Filters by:
       ├── Status (Pending, Completed, etc.)
       ├── Payment status (Paid, Unpaid)
       ├── Merchant
       └── Date range
   └── Identifies issues
   └── Platform-wide insights

4. System Health
   └── API status: Operational
   └── Database status: Operational
   └── QR Engine: Operational
   └── Payment system: Operational
   └── Notifications: Operational
```

---

## 🔐 Security Architecture

### **Authentication Flow**
```
1. User Login Request
   └── Frontend: POST to Keycloak
   └── Endpoint: /realms/scanny/protocol/openid-connect/token
   └── Body: username, password, client_id, grant_type

2. Keycloak Validation
   └── Validates credentials
   └── Checks user roles
   └── Generates JWT tokens:
       ├── Access Token (30 min)
       └── Refresh Token (30 days)

3. Token Storage
   └── Access token stored in memory
   └── Refresh token in secure httpOnly cookie
   └── Token included in API requests

4. Backend Validation
   └── Every API request checked
   └── Spring Security validates JWT
   └── Checks token signature
   └── Verifies not expired
   └── Validates user roles

5. Role-Based Access
   └── MERCHANT role:
       ├── Can access own catalog
       ├── Can manage own orders
       └── Cannot access other merchants
   
   └── ADMIN role:
       ├── Can view all merchants
       ├── Can view all orders
       ├── Can create merchants
       └── Platform-wide access
   
   └── CUSTOMER role (future):
       ├── Order history
       ├── Saved preferences
       └── Loyalty points
```

---

## 📊 Data Architecture

### **Core Entities**

```sql
-- Merchants
├── id (UUID)
├── email (unique)
├── business_name
├── business_type (RESTAURANT, BAR, etc.)
├── phone_number
├── qr_code_token (6-char unique)
├── qr_code_url
├── payment_destination (JSON)
├── status (PENDING, ACTIVE, SUSPENDED)
├── created_at
└── email_verified

-- Menu Items
├── id (UUID)
├── merchant_id (FK)
├── name
├── description
├── price (decimal)
├── category
├── image_url
├── available (boolean)
├── created_at
└── updated_at

-- Orders
├── id (UUID)
├── merchant_id (FK)
├── order_number (auto-increment)
├── customer_name
├── table_number
├── items (JSON array)
├── total_amount (decimal)
├── status (PENDING, PREPARING, READY, COMPLETED, CANCELLED)
├── payment_status (UNPAID, PAID, REFUNDED)
├── special_instructions
├── created_at
└── updated_at

-- Order Items (separate table)
├── id (UUID)
├── order_id (FK)
├── menu_item_id (FK)
├── quantity
├── unit_price
├── special_instructions
└── subtotal
```

---

## 🚀 API Architecture

### **Public Endpoints** (No Auth Required)
```
GET  /api/menu/{merchantCode}     - Get merchant's public menu
POST /api/orders                   - Customer places order
GET  /api/merchants/{code}/info    - Get merchant business info
```

### **Merchant Endpoints** (Requires MERCHANT role)
```
GET    /api/merchant/profile         - Get merchant profile
GET    /api/merchant/qr-code          - Get/generate QR code

GET    /api/merchant/items            - List menu items
POST   /api/merchant/items            - Create menu item
PUT    /api/merchant/items/{id}       - Update menu item
DELETE /api/merchant/items/{id}       - Delete menu item

GET    /api/merchant/orders           - List merchant's orders
GET    /api/merchant/orders/{id}      - Get order details
PATCH  /api/merchant/orders/{id}/status     - Update order status
PATCH  /api/merchant/orders/{id}/payment    - Update payment status

GET    /api/merchant/dashboard        - Dashboard statistics
```

### **Admin Endpoints** (Requires ADMIN role)
```
POST /api/auth/merchant/register     - Create merchant account

GET  /api/admin/dashboard/metrics    - Platform metrics
GET  /api/admin/dashboard/activity   - Recent activity
GET  /api/admin/merchants            - List all merchants
GET  /api/admin/merchants/{id}       - Get merchant details
GET  /api/admin/orders               - List all orders
GET  /api/admin/orders/status/{status}         - Orders by status
GET  /api/admin/orders/payment/{paymentStatus} - Orders by payment
GET  /api/admin/merchants/{id}/stats - Merchant statistics
```

---

## 🎨 Design System

### **Color Palette (OKLCH)**
```css
/* Primary */
--primary: oklch(0.60 0.15 250)      /* Blue */
--primary-hover: oklch(0.50 0.15 250)

/* Semantic Colors */
--success: oklch(0.65 0.15 145)      /* Green */
--warning: oklch(0.75 0.15 75)       /* Yellow */
--error: oklch(0.577 0.245 27.325)   /* Red */

/* Neutrals */
--background: oklch(1.0 0 0)         /* White */
--foreground: oklch(0.15 0 0)        /* Dark Gray */
--muted: oklch(0.95 0 0)             /* Light Gray */

/* Dark Mode */
--dark-bg: oklch(0.15 0 0)
--dark-fg: oklch(0.95 0 0)
```

### **Typography**
```
Font Family: Outfit (Variable Weight)
Headings: 600-700 weight
Body: 400-500 weight
Code: JetBrains Mono
```

### **Components**
- Custom Button styles (Primary, Secondary, Ghost, Outline)
- Card components with shadow effects
- Form inputs with validation states
- Toast notifications (Sonner)
- Modal dialogs
- Loading states and skeletons
- Empty states with illustrations

---

## 📈 Performance & Optimization

### **Frontend Optimization**
- ⚡ Vite for fast builds and HMR
- 🗜️ Code splitting by route
- 📦 Lazy loading for images
- 🔄 Optimistic UI updates
- 💾 Local storage caching
- 🎯 Minimal re-renders with React.memo

### **Backend Optimization**
- 🚀 Connection pooling (HikariCP)
- 📊 Database indexing on common queries
- 🔍 Efficient JPA queries
- 💾 Response caching for public menus
- ⚡ Async processing for emails

### **Database Optimization**
- Indexes on: merchant_id, order_id, email, qr_code_token
- Foreign key constraints for referential integrity
- Pagination for large result sets
- Database migrations for schema changes

---

## 🔧 Development Workflow

### **Local Development Setup**
```bash
# 1. Start database and Keycloak
cd backend
docker-compose up -d

# 2. Start backend API
mvn spring-boot:run

# 3. Start merchant/customer app
npm run dev

# 4. Start admin console
cd admin-console
npm run dev
```

### **Project Structure**
```
scanIT/
├── backend/                     # Spring Boot API
│   ├── src/main/java/com/scanit/
│   │   ├── controller/         # REST controllers
│   │   ├── service/            # Business logic
│   │   ├── repository/         # Data access
│   │   ├── entity/             # JPA entities
│   │   ├── dto/                # Data transfer objects
│   │   ├── config/             # Spring configuration
│   │   └── security/           # Security config
│   ├── src/main/resources/
│   │   ├── application.yml     # App configuration
│   │   └── db/migration/       # Flyway migrations
│   ├── docker-compose.yml      # Local services
│   └── pom.xml                 # Maven dependencies
│
├── src/                        # Customer/Merchant Frontend
│   ├── pages/                  # Page components
│   ├── components/             # Reusable components
│   ├── api/                    # API client
│   ├── hooks/                  # Custom hooks
│   ├── keycloak.ts            # Auth config
│   └── main.tsx               # Entry point
│
├── admin-console/              # Admin Frontend
│   ├── src/
│   │   ├── pages/             # Admin pages
│   │   ├── components/ui/     # UI components
│   │   ├── hooks/             # Data fetching hooks
│   │   ├── api/               # Admin API client
│   │   └── main.tsx           # Admin entry point
│   └── vite.config.ts
│
├── keycloak-theme/             # Custom Keycloak theme
│   └── scanny/
│       └── login/             # Login page theme
│
└── public/                     # Static assets
    ├── fonts/
    └── images/
```

---

## 🌟 Key Differentiators

### **Why Scanny?**

1. **🚀 Zero Friction for Customers**
   - No app download
   - No account creation
   - Instant access via QR scan
   - Works on any device

2. **💼 Complete Solution for Merchants**
   - Menu management
   - Order tracking
   - Payment tracking
   - QR code generation
   - Analytics dashboard

3. **🔒 Enterprise-Grade Security**
   - Keycloak authentication
   - JWT tokens
   - Role-based access
   - Secure by design

4. **📊 Admin Control**
   - Platform-wide visibility
   - Merchant management
   - System monitoring
   - Revenue tracking

5. **🎨 Modern UX**
   - Beautiful design
   - Dark mode support
   - Mobile-optimized
   - Accessible

6. **⚡ Performance**
   - Fast loading
   - Real-time updates
   - Offline-capable
   - Optimized bundle

---

## 🎯 Target Market

### **Industries**
- 🍽️ Restaurants & Cafes
- 🍹 Bars & Nightclubs
- 🎓 School Canteens
- 👗 Boutiques & Retail
- 🚗 Parking Services
- 🎪 Event Venues
- 💇 Salons & Spas

### **Geography**
- Primary: Uganda (UGX currency, MTN/Airtel Money)
- Expandable: East Africa region
- Future: Global expansion

---

## 📱 **Scanny in Action**

### **Before Scanny:**
❌ Physical menus (dirty, outdated, expensive to print)
❌ Staff taking orders (time-consuming, errors)
❌ Phone calls for orders (missed calls, confusion)
❌ Manual order tracking (paper tickets)
❌ Payment confusion (who paid? cash vs mobile money)

### **After Scanny:**
✅ Digital menu always up-to-date
✅ Customers order themselves
✅ Orders go directly to kitchen
✅ Real-time status tracking
✅ Clear payment records
✅ Analytics and insights

---

## 🚀 Roadmap & Future Features

### **Phase 2 (Q3 2024)**
- Customer accounts & order history
- Loyalty points & rewards
- Push notifications for order status
- Multi-language support
- Advanced analytics dashboard

### **Phase 3 (Q4 2024)**
- Payment integration (Flutterwave, Paystack)
- Table reservation system
- Inventory management
- Staff management & permissions
- Mobile apps (iOS/Android)

### **Phase 4 (2025)**
- AI-powered recommendations
- Integration with delivery services
- Kitchen display system (KDS)
- POS system integration
- Franchise management

---

## 🎓 Technical Highlights

### **Best Practices Implemented**
- ✅ Clean Architecture (Controller → Service → Repository)
- ✅ DTOs for API layer separation
- ✅ Dependency Injection
- ✅ Exception handling with global handlers
- ✅ Validation at DTO level
- ✅ Database migrations (Flyway)
- ✅ Environment-based configuration
- ✅ Proper logging
- ✅ API documentation ready (Swagger)
- ✅ Test-friendly architecture

### **Scalability Considerations**
- Stateless backend (horizontal scaling ready)
- Database connection pooling
- Token-based authentication (no server sessions)
- CDN-ready for static assets
- Database indexes for performance
- Caching strategy for public endpoints

---

## 💡 Value Proposition

**For Merchants:**
> "Set up your QR menu in under 5 minutes. Start taking orders instantly. No hardware, no installation, no complexity."

**For Customers:**
> "Scan. Browse. Order. Track. All in your browser. No app download. No hassle."

**For Platform Owner:**
> "Complete platform control. Monitor all merchants, orders, and revenue from one dashboard."

---

## 📞 Support & Documentation

- API Documentation: `/api/docs` (Swagger UI)
- Admin Guide: `ADMIN_QUICK_START.md`
- Merchant Guide: `MERCHANT_ONBOARDING.md`
- API Testing: `INSOMNIA_API_TESTING_GUIDE.md`
- Database Schema: `DATABASE_CONNECTION_SUMMARY.md`
- Keycloak Setup: `KEYCLOAK_INTEGRATION_COMPLETE.md`

---

## 🎉 Conclusion

**Scanny is a complete, production-ready QR menu and ordering platform built with modern technologies and best practices.**

It solves real problems for real businesses while providing an excellent experience for customers. The architecture is clean, secure, scalable, and maintainable.

**Tech Stack Summary:**
- **Frontend:** React + TypeScript + Vite + TailwindCSS
- **Backend:** Spring Boot + Java 21 + PostgreSQL
- **Auth:** Keycloak + OAuth 2.0 + JWT
- **DevOps:** Docker + Docker Compose

**Three Interfaces:**
- 👥 Customer: Browse & order (public)
- 🏪 Merchant: Manage business (protected)
- 🔧 Admin: Platform control (protected)

**Ready for:**
- ✅ Production deployment
- ✅ Real merchant onboarding
- ✅ Customer orders
- ✅ Revenue generation
- ✅ Future scaling

---

**Built with ❤️ by the Scanny Team**
*Making contactless ordering simple and beautiful*
