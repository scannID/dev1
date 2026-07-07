# Keycloak Client Configuration Guide

## Current Setup Status

### Services Running
- **Keycloak**: http://localhost:8080 (Docker container)
- **Customer App**: http://localhost:5173
- **Admin Console**: http://localhost:5174
- **Backend API**: http://localhost:4000

### Realm
- **Realm Name**: `scanny`

## Required Client Configurations

You need to create **two clients** in the Keycloak `scanny` realm:

### 1. Customer App Client: `scanny-client`

#### Basic Settings
- **Client ID**: `scanny-client`
- **Client Protocol**: openid-connect
- **Access Type**: public
- **Standard Flow Enabled**: ON
- **Direct Access Grants Enabled**: ON

#### Redirect URIs
Add these Valid Redirect URIs:
```
http://localhost:5173/*
http://localhost:5173
```

#### Web Origins
Add these Web Origins:
```
http://localhost:5173
+
```
(The `+` allows all origins from Valid Redirect URIs)

---

### 2. Admin Console Client: `scanny-admin`

#### Basic Settings
- **Client ID**: `scanny-admin`
- **Client Protocol**: openid-connect
- **Access Type**: public
- **Standard Flow Enabled**: ON
- **Direct Access Grants Enabled**: ON

#### Redirect URIs
Add these Valid Redirect URIs:
```
http://localhost:5174/*
http://localhost:5174
```

#### Web Origins
Add these Web Origins:
```
http://localhost:5174
+
```

---

## How to Configure Clients in Keycloak

### Step 1: Access Keycloak Admin Console
1. Open browser: http://localhost:8080
2. Click **Administration Console**
3. Login with admin credentials (default: admin/admin)

### Step 2: Select the Scanny Realm
1. In the top-left dropdown, select **scanny** realm
2. Make sure you're NOT in the **master** realm

### Step 3: Create Customer App Client
1. Click **Clients** in left sidebar
2. Click **Create** button
3. Fill in:
   - Client ID: `scanny-client`
   - Client Protocol: `openid-connect`
4. Click **Save**
5. In the Settings tab:
   - Access Type: `public`
   - Standard Flow Enabled: `ON`
   - Direct Access Grants Enabled: `ON`
   - Valid Redirect URIs: `http://localhost:5173/*`
   - Web Origins: `+`
6. Click **Save**

### Step 4: Create Admin Console Client
1. Click **Clients** in left sidebar
2. Click **Create** button
3. Fill in:
   - Client ID: `scanny-admin`
   - Client Protocol: `openid-connect`
4. Click **Save**
5. In the Settings tab:
   - Access Type: `public`
   - Standard Flow Enabled: `ON`
   - Direct Access Grants Enabled: `ON`
   - Valid Redirect URIs: `http://localhost:5174/*`
   - Web Origins: `+`
6. Click **Save**

---

## Testing the Setup

### Test Customer App
1. Open http://localhost:5173
2. You should see the login page (not "client not found")
3. Click login - it should redirect to Keycloak
4. After login, you should be redirected back to the app

### Test Admin Console
1. Open http://localhost:5174
2. You should see the admin login page
3. Click login - it should redirect to Keycloak
4. After login, you should be redirected back to the admin console

---

## Troubleshooting

### "Client not found" Error
- Make sure the client exists in the **scanny** realm (not master)
- Check the Client ID matches exactly: `scanny-client` or `scanny-admin`

### "Invalid redirect_uri" Error
- Verify the redirect URIs in Keycloak match the URLs exactly
- Make sure you added the wildcard: `http://localhost:5174/*`
- Check that Web Origins is set to `+` or includes the specific origin

### App redirects to wrong port
- Verify the apps are running on the correct ports:
  - Customer app: 5173
  - Admin console: 5174
- Check the keycloak.ts files have the correct redirectUri in login/logout calls

---

## Current Application Configuration

### Customer App (`/src/keycloak.ts`)
```typescript
const keycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'scanny',
  clientId: 'scanny-client',
})
```

### Admin Console (`/admin-console/src/keycloak.ts`)
```typescript
const adminKeycloak = new Keycloak({
  url: 'http://localhost:8080',
  realm: 'scanny',
  clientId: 'scanny-admin',
})
```

Both are configured correctly and ready to use once the Keycloak clients are created!
