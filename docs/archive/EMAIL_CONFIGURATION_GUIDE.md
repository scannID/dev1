# 📧 Email Configuration Guide for Scanny

This guide covers how to configure email sending in Keycloak so merchants receive verification emails after registration.

---

## 🎯 What Emails Are Sent?

1. **Email Verification** - When merchant is registered
2. **Password Reset** - When merchant forgets password
3. **Account Actions** - Various Keycloak actions

---

## 📋 Option 1: Gmail SMTP (Recommended for Development)

### **Step 1: Enable 2-Factor Authentication on Gmail**

1. Go to your Google Account: https://myaccount.google.com/
2. Click **Security** (left sidebar)
3. Scroll to **"How you sign in to Google"**
4. Click **"2-Step Verification"**
5. Follow the steps to enable it

### **Step 2: Generate App Password**

1. Go to: https://myaccount.google.com/apppasswords
2. Select **"Mail"** for app
3. Select **"Other"** for device, name it **"Scanny Keycloak"**
4. Click **Generate**
5. **Copy the 16-character password** (you'll need this)

### **Step 3: Configure Keycloak**

1. **Open Keycloak Admin Console**
   - Go to: http://localhost:8080
   - Click **Administration Console**
   - Login with admin credentials

2. **Select Your Realm**
   - Select **"scanny"** realm from dropdown (top left)

3. **Go to Email Settings**
   - Click **Realm settings** (left sidebar)
   - Click **Email** tab

4. **Configure SMTP Settings**
   ```
   From: your-email@gmail.com
   From Display Name: Scanny Platform
   Reply To: (leave empty or same as From)
   Reply To Display Name: (leave empty)
   Envelope From: (leave empty)
   
   Host: smtp.gmail.com
   Port: 587
   Encryption: Enable StartTLS ✓
   
   Authentication: Enable Authentication ✓
   Username: your-email@gmail.com
   Password: [paste the 16-character app password]
   ```

5. **Test Email**
   - Scroll down
   - Click **Test connection**
   - Enter your email in the popup
   - Click **Send test email**
   - Check your inbox!

6. **Save**
   - Click **Save** button

---

## 📋 Option 2: Other Email Providers

### **Outlook/Hotmail**
```
Host: smtp-mail.outlook.com
Port: 587
Enable StartTLS: ✓
Authentication: ✓
Username: your-email@outlook.com
Password: your-outlook-password
```

### **Yahoo Mail**
```
Host: smtp.mail.yahoo.com
Port: 587
Enable StartTLS: ✓
Authentication: ✓
Username: your-email@yahoo.com
Password: your-yahoo-app-password (generate at: https://login.yahoo.com/account/security)
```

### **SendGrid (Production Recommended)**
```
Host: smtp.sendgrid.net
Port: 587
Enable StartTLS: ✓
Authentication: ✓
Username: apikey
Password: [your SendGrid API key]
```

### **Amazon SES (Production Recommended)**
```
Host: email-smtp.us-east-1.amazonaws.com (or your region)
Port: 587
Enable StartTLS: ✓
Authentication: ✓
Username: [your SMTP username from AWS]
Password: [your SMTP password from AWS]
```

### **Mailgun (Production Recommended)**
```
Host: smtp.mailgun.org
Port: 587
Enable StartTLS: ✓
Authentication: ✓
Username: postmaster@your-domain.mailgun.org
Password: [your Mailgun SMTP password]
```

---

## 📋 Option 3: Local Development (MailHog)

For testing without real email sending:

### **Step 1: Install MailHog**
```bash
# Mac (Homebrew)
brew install mailhog

# Or use Docker
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

### **Step 2: Configure Keycloak**
```
From: noreply@scanny.local
Host: localhost
Port: 1025
Encryption: Disabled
Authentication: Disabled
```

### **Step 3: View Emails**
- Go to: http://localhost:8025
- All emails will appear here (not actually sent)

---

## 🔧 Keycloak Email Configuration via Admin Console

### **Detailed Steps with Screenshots Guide:**

1. **Access Keycloak Admin**
   ```
   URL: http://localhost:8080
   Click: Administration Console
   Username: admin
   Password: [your admin password]
   ```

2. **Navigate to Email Settings**
   ```
   Top Left Dropdown → Select "scanny" realm
   Left Sidebar → Click "Realm settings"
   Top Tabs → Click "Email" tab
   ```

3. **Fill in the Form**
   ```
   ┌─────────────────────────────────────────┐
   │ Email Settings                          │
   ├─────────────────────────────────────────┤
   │                                         │
   │ From: noreply@scanny.app               │
   │ From Display Name: Scanny Platform      │
   │ Reply To:                              │
   │ Reply To Display Name:                 │
   │ Envelope From:                         │
   │                                         │
   │ ☑ Enable SSL                           │
   │ ☑ Enable StartTLS                      │
   │ ☑ Enable Authentication                │
   │                                         │
   │ Host: smtp.gmail.com                   │
   │ Port: 587                              │
   │ Username: your-email@gmail.com         │
   │ Password: ****************             │
   │                                         │
   │ [Test connection] [Save] [Revert]      │
   └─────────────────────────────────────────┘
   ```

4. **Test Configuration**
   - Click **"Test connection"** button
   - Enter email address to test
   - Click **"Send test email"**
   - Check inbox for test email

5. **Save Configuration**
   - If test successful, click **"Save"**
   - Configuration is now active

---

## 📧 Customizing Email Templates

### **Step 1: Navigate to Email Templates**
```
Keycloak Admin Console
→ Realm Settings
→ Themes tab
→ Email Theme: [select or create]
```

### **Step 2: Create Custom Email Theme**

1. **Create theme directory:**
   ```bash
   mkdir -p keycloak-theme/scanny/email
   cd keycloak-theme/scanny/email
   ```

2. **Create `theme.properties`:**
   ```properties
   parent=base
   styles=css/email.css
   ```

3. **Customize email templates:**
   ```bash
   # Create text versions
   touch email-verification.txt
   touch password-reset.txt
   
   # Create HTML versions
   touch email-verification.html
   touch password-reset.html
   ```

4. **Example: Email Verification Template**
   
   **File: `email-verification.html`**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
       <style>
           body { font-family: 'Outfit', Arial, sans-serif; }
           .container { max-width: 600px; margin: 0 auto; }
           .header { background: oklch(0.60 0.15 250); color: white; padding: 20px; }
           .content { padding: 30px; }
           .button { 
               background: oklch(0.60 0.15 250); 
               color: white; 
               padding: 12px 24px; 
               text-decoration: none;
               border-radius: 8px;
               display: inline-block;
           }
       </style>
   </head>
   <body>
       <div class="container">
           <div class="header">
               <h1>Welcome to Scanny! 🎉</h1>
           </div>
           <div class="content">
               <p>Hi ${user.firstName},</p>
               <p>Welcome to Scanny! Your merchant account has been created.</p>
               <p>Please verify your email address by clicking the button below:</p>
               <p>
                   <a href="${link}" class="button">Verify Email & Set Password</a>
               </p>
               <p>This link will expire in ${linkExpiration} minutes.</p>
               <p>If you didn't create this account, you can safely ignore this email.</p>
               <p>Best regards,<br>The Scanny Team</p>
           </div>
       </div>
   </body>
   </html>
   ```

5. **Install custom theme:**
   ```bash
   # Copy to Keycloak
   docker cp keycloak-theme/scanny scanit-keycloak:/opt/keycloak/themes/
   
   # Restart Keycloak
   docker restart scanit-keycloak
   ```

6. **Activate theme in Keycloak:**
   ```
   Realm Settings → Themes
   Email Theme: scanny
   Save
   ```

---

## 🧪 Testing Email Configuration

### **Method 1: Test Connection Button**
```
Keycloak → Realm Settings → Email tab
→ Click "Test connection"
→ Enter test email
→ Click "Send test email"
```

### **Method 2: Register Test Merchant**
```bash
# Use Insomnia or cURL
POST http://localhost:4000/api/auth/merchant/register
{
  "businessName": "Test Restaurant",
  "businessType": "RESTAURANT",
  "email": "your-test-email@gmail.com",
  "phoneNumber": "+256700000000",
  "paymentDestination": {
    "type": "MOBILE_MONEY",
    "provider": "MTN",
    "number": "+256700000000",
    "accountName": "Test Restaurant"
  },
  "termsAccepted": true
}
```
Check inbox for verification email!

### **Method 3: Check Keycloak Email Queue**
```
Keycloak Admin → Events → Login Events
→ Filter: Type = "SEND_VERIFY_EMAIL"
→ Check status
```

---

## 🐛 Troubleshooting

### **Issue: "Failed to send email"**

**Possible Causes:**
1. **Wrong SMTP credentials**
   - Check username and password
   - For Gmail, use app password, not regular password

2. **Firewall/Port blocked**
   - Try port 587 (TLS) or 465 (SSL)
   - Check firewall settings

3. **Authentication not enabled**
   - Make sure "Enable Authentication" is checked

**Solution:**
```bash
# Check Keycloak logs
docker logs scanit-keycloak

# Look for email-related errors
docker logs scanit-keycloak | grep -i email
```

---

### **Issue: "Authentication failed"**

**For Gmail:**
- Enable 2FA on Google account
- Generate app-specific password
- Use app password, not regular password

**For Other Providers:**
- Check if "less secure apps" setting needs to be enabled
- Verify SMTP credentials are correct

---

### **Issue: Emails go to spam**

**Solutions:**
1. **Use proper From address**
   - Use a real domain email (e.g., noreply@scanny.app)
   - Don't use generic Gmail addresses in production

2. **Set up SPF, DKIM, DMARC**
   - Configure DNS records for your domain
   - Use services like SendGrid, Mailgun, or Amazon SES

3. **Use professional email service**
   - For production, don't use Gmail
   - Use SendGrid, Mailgun, Amazon SES, etc.

---

### **Issue: Emails not received**

**Check:**
1. ✅ Email exists in Keycloak user (Users → View all users → Check email)
2. ✅ Email verification is required (Authentication → Required actions → Verify Email)
3. ✅ SMTP settings are correct
4. ✅ Test connection works
5. ✅ Check spam folder
6. ✅ Check Keycloak logs for errors

---

## 📊 Production Recommendations

### **Use Professional Email Service**

**Why?**
- ✅ Better deliverability
- ✅ Less likely to be marked as spam
- ✅ Analytics and tracking
- ✅ Scalability
- ✅ Compliance (unsubscribe links, etc.)

### **Recommended Services:**

1. **SendGrid** (Recommended)
   - Free tier: 100 emails/day
   - Easy setup
   - Good documentation
   - Great deliverability
   - Signup: https://sendgrid.com

2. **Amazon SES**
   - Very cheap ($0.10 per 1000 emails)
   - High sending limits
   - Requires AWS account
   - Signup: https://aws.amazon.com/ses/

3. **Mailgun**
   - Free tier: 5,000 emails/month
   - Developer-friendly
   - Good API
   - Signup: https://www.mailgun.com

### **Best Practices:**

1. **Use dedicated email domain**
   ```
   Good: noreply@scanny.app
   Bad:  test123@gmail.com
   ```

2. **Configure DNS records**
   - SPF record
   - DKIM signature
   - DMARC policy

3. **Monitor email metrics**
   - Delivery rate
   - Open rate
   - Bounce rate
   - Spam complaints

4. **Include unsubscribe link**
   - Required for marketing emails
   - Good practice for all emails

5. **Use email templates**
   - Branded design
   - Responsive HTML
   - Consistent styling

---

## 🎯 Quick Start: Gmail Setup (5 Minutes)

```bash
# 1. Enable 2FA on Gmail
Go to: https://myaccount.google.com/security
Enable 2-Step Verification

# 2. Generate App Password
Go to: https://myaccount.google.com/apppasswords
App: Mail, Device: Other (Scanny)
Copy the 16-character password

# 3. Configure Keycloak
http://localhost:8080
→ Administration Console
→ Scanny realm
→ Realm settings → Email

From: your-email@gmail.com
Host: smtp.gmail.com
Port: 587
Enable StartTLS: ✓
Enable Authentication: ✓
Username: your-email@gmail.com
Password: [paste app password]

# 4. Test
Click "Test connection"
Enter test email
Check inbox!

# 5. Save
Click "Save"
```

Done! ✅

---

## 📝 Summary

**For Development:**
- Use Gmail with app password
- Or use MailHog for local testing

**For Production:**
- Use SendGrid, Amazon SES, or Mailgun
- Configure DNS records (SPF, DKIM)
- Use custom domain email
- Monitor deliverability

**Next Steps:**
1. Configure email in Keycloak
2. Test with merchant registration
3. Customize email templates (optional)
4. Monitor email delivery

---

## 🆘 Need Help?

If emails still aren't working:

1. **Check Keycloak logs:**
   ```bash
   docker logs scanit-keycloak
   ```

2. **Check backend logs:**
   ```bash
   cd backend
   mvn spring-boot:run
   # Watch console for errors
   ```

3. **Common error messages:**
   - "Authentication failed" → Wrong credentials
   - "Connection refused" → Wrong host/port
   - "Unknown host" → Wrong SMTP server
   - "SSL handshake failed" → Wrong encryption settings

4. **Test SMTP manually:**
   ```bash
   # Install swaks (SMTP testing tool)
   brew install swaks
   
   # Test SMTP connection
   swaks --to test@example.com \
         --from noreply@scanny.app \
         --server smtp.gmail.com:587 \
         --auth LOGIN \
         --auth-user your-email@gmail.com \
         --auth-password "your-app-password" \
         --tls
   ```

---

**You're all set! 📧 Emails should now work for merchant registration!**
