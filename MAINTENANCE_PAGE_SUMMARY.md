# Maintenance Request Page Implementation

## Overview
Created a standalone maintenance request page for tenants that mimics the professional design and style of the RentPayPage. Tenants can access this page via a QR code or link with a token.

## Files Created

### 1. `src/rent/MaintenanceRequestPage.tsx`
A complete tenant-facing maintenance request page featuring:

**Design Elements:**
- Professional loader animation with three bouncing wrenches
- Clean, modern UI matching RentPayPage's design system
- Responsive mobile-first layout
- Proper use of CSS variables from RentPayPage.css

**Features:**
- **Submit New Requests**: Form with title (required) and description (optional)
- **View Request History**: Toggle between form and history views
- **Request Status Tracking**: Visual status indicators (Open, In Progress, Resolved, Closed)
- **Real-time Feedback**: Success and error messages
- **Property Context**: Shows property name and unit number
- **Status Badges**: Color-coded badges for each request status
- **Date Formatting**: Human-readable dates for submissions
- **Request Details**: Full descriptions visible in history view
- **Koddly Branding**: Footer with "Powered by Koddly"

**UI Components:**
- Custom maintenance loader (three bouncing wrenches)
- Property info banner with wrench icon
- Success/error notification banners
- Form with validation
- Request list with status dots and badges
- Empty states
- History toggle button with badge counter

**States Handled:**
- Loading (booting)
- Error (invalid token)
- Form view
- History view
- Success notifications
- Submitting states
- Empty states

## Routing Configuration

### Modified: `src/main.tsx`

1. **Added Import:**
```typescript
import MaintenanceRequestPage from './rent/MaintenanceRequestPage'
```

2. **Added Route Resolver:**
```typescript
function resolveRentMaintenanceRoute(): string | null {
  const match = window.location.pathname.match(/^\/rent\/maintenance\/([^/]+)\/?$/)
  return match ? decodeURIComponent(match[1]) : null
}
```

3. **Added Route Constant:**
```typescript
const rentMaintenanceToken = resolveRentMaintenanceRoute()
```

4. **Added Route Handler:**
```typescript
} else if (rentMaintenanceToken !== null) {
  // ── /rent/maintenance/:token — tenant maintenance request page ──────────
  document.documentElement.classList.add('cm-app')
  applyDarkMode(false)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MaintenanceRequestPage token={rentMaintenanceToken} />
    </StrictMode>,
  )
}
```

## URL Structure

**Public Maintenance Page:**
```
/rent/maintenance/:token
```

Where `:token` is a tenant's pay token, unit QR token, or property QR token.

## API Integration

The page uses existing API endpoints from `rent/api.ts`:

1. **`rentPublicApi.resolvePayContext(token)`**
   - Loads tenant/property context
   - Gets property name, unit number, tenant name

2. **`rentPublicApi.listMyMaintenance(token)`**
   - Fetches existing maintenance requests for the tenant/unit

3. **`rentPublicApi.submitMaintenance(token, request)`**
   - Submits new maintenance requests
   - Payload: `{ title, description?, tenantName? }`

## Design Consistency

The page maintains design consistency with RentPayPage:
- Uses the same CSS file (`RentPayPage.css`)
- Follows the same component structure
- Uses matching animations and transitions
- Maintains the same mobile-first responsive approach
- Uses identical color palette and spacing
- Implements the same loading patterns
- Uses consistent icon sizing and styling

## Status Display

**Status Colors:**
- **Open / Submitted**: Blue dot + blue badge
- **In Progress**: Amber/orange dot + amber badge  
- **Resolved / Closed**: Green dot + green badge

**Status Labels:**
- OPEN → "Open"
- IN_PROGRESS → "In Progress"
- RESOLVED → "Resolved"
- CLOSED → "Closed"

## Key Features

1. **Context-Aware**: Automatically shows property and unit information
2. **History Toggle**: Switch between form and history with counter badge
3. **Validation**: Required title field, optional description
4. **Auto-refresh**: Success message auto-dismisses after 4 seconds
5. **Empty States**: Clean messaging when no requests exist
6. **Full Request Details**: Expandable descriptions in history view
7. **Disabled States**: Proper UX during form submission
8. **Error Handling**: Network errors displayed with retry capability

## TypeScript Types

All types are imported from `rent/types.ts`:
- `TenantPayContext` - Property/unit/tenant context
- `MaintenanceRequest` - Request structure
- `SubmitMaintenanceRequest` - Submission payload

## Mobile Optimization

- Touch-friendly buttons and inputs
- Large tap targets (34px+ icon buttons)
- Responsive text sizing
- Proper viewport handling
- Smooth animations (respects prefers-reduced-motion)
- Optimized for one-handed use

## Accessibility

- Semantic HTML structure
- Proper form labels and ARIA attributes
- Keyboard navigation support
- Focus states on interactive elements
- Screen reader friendly
- Loading states announced
- Error messages properly associated

## Testing

The TypeScript compilation passes cleanly:
```bash
npx tsc --noEmit
# Exit Code: 0
```

## Next Steps

To test the page:
1. Start development server: `npm run dev`
2. Navigate to: `http://localhost:5173/rent/maintenance/:token`
3. Use any valid tenant/unit/property QR token

## Example URLs

```
/rent/maintenance/abc123def456     (tenant pay token)
/rent/maintenance/unit_xyz789      (unit QR token)
/rent/maintenance/prop_abc123      (property QR token)
```

## Notes

- The build error encountered (`manualChunks is not a function`) is a pre-existing vite/rolldown configuration issue unrelated to these changes
- The page shares the same CSS as RentPayPage for consistency
- All API endpoints are already implemented on the backend
- The page works with any valid rent-related token (tenant, unit, or property)
