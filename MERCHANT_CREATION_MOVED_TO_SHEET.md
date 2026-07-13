# Merchant Creation Moved to Sheet

## Changes Made

### 1. **MerchantsPage.tsx** - Added Merchant Creation Sheet
- ✅ Moved the merchant creation form from UsersPage to MerchantsPage
- ✅ Changed from Dialog (modal) to Sheet (slide-in panel from right)
- ✅ Added all form fields following backend requirements:
  - Business Name
  - Business Type (Restaurant/Bar/School/Boutique)
  - Email & Phone Number
  - Payment Method (Mobile Money or Bank Account)
  - Mobile Money: Provider + Number
  - Bank Account: Bank Name + Account Number
- ✅ Integrated with backend endpoint: `POST /api/auth/merchant/register`
- ✅ Added success/error toast notifications
- ✅ Form validation and submission handling

### 2. **UsersPage.tsx** - Removed Add User Button
- ✅ Removed "Add User" button from header
- ✅ Removed entire add user dialog and form
- ✅ Removed unused imports (useState, Plus, Button, Input, Label, Select, Dialog, toast)
- ✅ Now displays read-only user list

## UI Changes

### Before:
- **UsersPage**: Had "Add User" button that opened a dialog modal
- **MerchantsPage**: Had "Add merchant" button that did nothing

### After:
- **UsersPage**: Read-only list of all platform users
- **MerchantsPage**: "Add merchant" button opens a Sheet (600px width slide-in panel)

## Sheet Component Features
```tsx
<Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
  <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
    <SheetHeader>
      <SheetTitle>Add New Merchant</SheetTitle>
      <SheetDescription>...</SheetDescription>
    </SheetHeader>
    
    <form>...</form>
    
    <SheetFooter>
      <Button variant="outline">Cancel</Button>
      <Button type="submit">Create Merchant</Button>
    </SheetFooter>
  </SheetContent>
</Sheet>
```

## Benefits of Sheet vs Dialog
1. ✅ **More screen space** - 600px wide panel instead of centered modal
2. ✅ **Better form visibility** - Users can see the table behind while filling form
3. ✅ **Modern UX pattern** - Slide-in panels are common in admin dashboards
4. ✅ **Scrollable content** - Long forms scroll within the sheet
5. ✅ **Less disruptive** - Doesn't block the entire page

## Form Flow
1. Admin clicks "Add merchant" button in MerchantsPage
2. Sheet slides in from the right (600px wide)
3. Admin fills in all required merchant details
4. On submit:
   - Form data is sent to `POST /api/auth/merchant/register`
   - Backend creates Keycloak user with MERCHANT role
   - Backend sends verification email to merchant
   - Success toast shown: "Merchant created successfully!"
   - Sheet closes and form resets
5. Merchant receives email and sets their password via link
6. QR code auto-generates on first login

## Backend Integration
The form sends exactly what the backend expects:
```typescript
{
  businessName: string,
  businessType: 'Restaurant' | 'Bar' | 'School' | 'Boutique',
  email: string,
  phoneNumber: string,
  paymentDestination: {
    type: 'MOBILE_MONEY' | 'BANK_ACCOUNT',
    // For Mobile Money:
    provider: 'MTN' | 'AIRTEL' | 'AFRICELL',
    number: string,
    accountName: string,
    // For Bank Account:
    bankName: string,
    bankAccountNumber: string,
  },
  termsAccepted: true
}
```

## Status
✅ **COMPLETE** - Merchant creation is now available as a Sheet in MerchantsPage, and UsersPage is read-only
