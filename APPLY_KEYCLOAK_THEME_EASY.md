# Easy Keycloak Theme Application (No Installation Needed!)

Since finding the Keycloak installation can be tricky, here's the **easiest way** to apply custom styling:

## 🎨 Option 1: Use Keycloak's Built-in Theme Editor (Recommended)

Unfortunately, Keycloak doesn't have a built-in visual theme editor, BUT we can deploy the theme via the Admin Console if we know where Keycloak is running from.

## 🔍 First, Let's Find Your Keycloak

Run these commands to locate Keycloak:

```bash
# Check if running via Docker
docker ps | grep keycloak

# Check if running as a process
ps aux | grep keycloak | grep -v grep

# Check common installation paths
ls -la /opt/homebrew/opt/keycloak 2>/dev/null
ls -la /usr/local/keycloak 2>/dev/null
ls -la ~/keycloak* 2>/dev/null
```

## 🎯 Quick Method: Apply CSS via Keycloak Admin

For now, let's **just customize Keycloak's appearance** without installing a full theme:

### Step 1: Access Keycloak Admin
1. Go to http://localhost:8080
2. Login as admin
3. Select the **scanny** realm

### Step 2: Customize Login Page Settings
1. Go to **Realm Settings** → **Themes** tab
2. Try these built-in themes first:
   - **Login Theme**: Try `keycloak` or `base` (default)
3. Click **Save**

### Step 3: Configure Login Requirements
1. Go to **Realm Settings** → **Login** tab
2. Enable these options:
   - ☑️ **User registration** - Shows "Register" link
   - ☑️ **Forgot password** - Shows "Forgot password?" link
   - ☑️ **Remember me** - Shows remember me checkbox
   - ☑️ **Login with email** - Allow username OR email
   - ☑️ **Edit username** - Allow username changes
3. Click **Save**

## 📦 If You Want the Full Custom Theme

### Find Keycloak the Easy Way:

**Method 1: Check your terminal history**
```bash
# Look for how you started Keycloak
history | grep keycloak
```

**Method 2: Check running processes**
```bash
# This shows the full command used to start Keycloak
ps aux | grep -i keycloak | grep -v grep
```

**Method 3: Common locations**
```bash
# Homebrew on Mac
/opt/homebrew/opt/keycloak/libexec/themes/

# Manual installation
~/keycloak-*/themes/
/opt/keycloak/themes/
/usr/local/keycloak/themes/
```

### Once You Find It:

1. Copy the theme folder:
```bash
cp -r keycloak-theme/scanny /path/to/keycloak/themes/
```

2. Restart Keycloak

3. Set theme in Admin Console:
   - Realm Settings → Themes → Login Theme: **scanny**

## 🆘 Still Can't Find It?

**Tell me how you installed Keycloak:**
- [ ] Homebrew? (`brew install keycloak`)
- [ ] Docker? (`docker run ...`)
- [ ] Downloaded ZIP/TAR?
- [ ] Some other way?

Then I can give you the exact path!

## 🎨 Alternative: Use Custom CSS in Your App

If Keycloak theming is too complex, we can:
1. Keep the Keycloak flow as-is
2. Style it with CSS overrides in your frontend
3. Or use an iframe approach with custom CSS injection

Let me know which approach you prefer!
