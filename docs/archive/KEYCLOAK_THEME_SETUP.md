# Scanny Keycloak Theme Setup

This guide explains how to install and activate the custom Scanny theme for Keycloak.

## 📦 Theme Structure

```
keycloak-theme/
└── scanny/
    └── login/
        ├── theme.properties
        └── resources/
            ├── css/
            │   └── scanny-custom.css
            └── img/
```

## 🚀 Installation Steps

### Option 1: Copy Theme to Keycloak Directory (Development)

1. **Locate your Keycloak themes directory:**
   ```bash
   # If using Keycloak 21+ standalone:
   cd /path/to/keycloak/themes/
   
   # On macOS with Homebrew:
   cd /opt/homebrew/opt/keycloak/libexec/themes/
   
   # Or if installed in a custom location, find it:
   find / -name "keycloak" -type d 2>/dev/null | grep themes
   ```

2. **Copy the Scanny theme:**
   ```bash
   # From your project root
   cp -r keycloak-theme/scanny /path/to/keycloak/themes/
   ```

3. **Restart Keycloak:**
   ```bash
   # If using Homebrew:
   brew services restart keycloak
   
   # Or if running manually:
   # Stop Keycloak (Ctrl+C) and restart it
   ```

### Option 2: Deploy as JAR (Production)

1. **Create a JAR file with the theme:**
   ```bash
   cd keycloak-theme
   jar -cf scanny-theme.jar scanny/
   ```

2. **Copy JAR to Keycloak deployments:**
   ```bash
   cp scanny-theme.jar /path/to/keycloak/providers/
   ```

3. **Rebuild Keycloak:**
   ```bash
   /path/to/keycloak/bin/kc.sh build
   ```

## 🎨 Activate the Theme

### Via Keycloak Admin Console (Recommended)

1. Open Keycloak Admin Console: http://localhost:8080
2. Login with admin credentials
3. Select your realm: **scanny**
4. Go to **Realm Settings** → **Themes** tab
5. Set **Login Theme** to: **scanny**
6. Click **Save**

### Via Keycloak CLI

```bash
# Update realm theme
/path/to/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user admin

/path/to/keycloak/bin/kcadm.sh update realms/scanny \
  -s loginTheme=scanny
```

## ✅ Verify Installation

1. Open your app and click "Get Started"
2. You should see:
   - ✅ Scanny logo and branding
   - ✅ Custom green color scheme (#0f766e)
   - ✅ Grid background pattern
   - ✅ Rounded, modern input fields
   - ✅ Custom button styling
   - ✅ All Keycloak functionality intact (login, register, forgot password)

## 🎯 What This Theme Does

### Visual Changes
- Custom Scanny logo with QR icon
- Forest green primary color (#0f766e)
- Grid background pattern (matching your landing page)
- Rounded, modern cards and inputs
- Custom typography (Inter font family)
- Professional shadows and spacing

### Keycloak Functionality (Unchanged)
- ✅ Username/email login
- ✅ Password authentication
- ✅ "Forgot password" flow
- ✅ User registration
- ✅ Email verification
- ✅ Remember me checkbox
- ✅ Social login buttons (if configured)
- ✅ Two-factor authentication (if enabled)
- ✅ All security features

## 🛠️ Customization

Edit `keycloak-theme/scanny/login/resources/css/scanny-custom.css` to customize:

```css
:root {
  --scanny-primary: #0f766e;        /* Main brand color */
  --scanny-primary-light: #14b8a6;  /* Hover states */
  --scanny-primary-dark: #0d6460;   /* Active states */
  --scanny-bg: #ffffff;             /* Background */
  --scanny-bg-alt: #f9fafb;         /* Input backgrounds */
  --scanny-text: #111827;           /* Text color */
  --scanny-text-muted: #6b7280;     /* Muted text */
  --scanny-border: #e5e7eb;         /* Borders */
}
```

After changes, restart Keycloak and clear browser cache.

## 📱 Username vs Email Login

By default, Keycloak can accept both username and email. To configure:

1. Go to **Realm Settings** → **Login** tab
2. Enable/disable these options:
   - ☑️ **Login with email** - Allow email as username
   - ☑️ **Edit username** - Users can change username
   - ☑️ **Registration allowed** - Show registration link
   - ☑️ **Forgot password** - Show forgot password link
   - ☑️ **Remember me** - Show remember me checkbox

## 🐛 Troubleshooting

### Theme not appearing?
```bash
# Clear Keycloak cache
rm -rf /path/to/keycloak/data/tmp/*

# Restart Keycloak
brew services restart keycloak
```

### CSS not loading?
- Clear browser cache (Cmd+Shift+R on Mac)
- Check browser console for 404 errors
- Verify theme files are in correct directory

### Still seeing default theme?
- Confirm theme is selected in Realm Settings → Themes
- Verify theme name matches folder name exactly: `scanny`
- Check Keycloak logs for theme loading errors

## 📁 File Locations

**Development (Homebrew on Mac):**
```
/opt/homebrew/opt/keycloak/libexec/themes/scanny/
```

**Production:**
```
/opt/keycloak/themes/scanny/
```

**Or as JAR:**
```
/opt/keycloak/providers/scanny-theme.jar
```

## 🎉 That's It!

Your Keycloak login pages will now match your Scanny branding while keeping all Keycloak's powerful authentication features!
