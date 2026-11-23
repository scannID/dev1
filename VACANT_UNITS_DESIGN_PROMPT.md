# AI Design Prompt: Vacant Units Showcase Page

## Context
I have a property management app where landlords can generate QR codes for their properties. When someone scans a property-level QR code, they currently see a unit picker that lists all available units. I want to transform this into a beautiful, modern property showcase page that makes vacant units look attractive to prospective tenants.

## Current Implementation
The current unit picker is functional but basic. It's embedded in `RentPayPage.tsx` under the "pickingUnit" state. Here's what it currently shows:
- Property header with Koddly logo
- Property name
- List of units grouped by floor
- Unit specs (bedrooms, bathrooms)
- Monthly rent amount
- Amenities text
- "Available" badge

## Design Goal
Transform this into a **property marketing/showcase page** that:
1. Makes vacant units look appealing and professional
2. Helps prospective tenants browse and compare units easily
3. Maintains the clean, modern aesthetic of the RentPayPage
4. Works beautifully on mobile (primary use case is scanning QR codes)
5. Encourages inquiries and applications

## Technical Constraints
- Must work with existing data structure from `TenantPayContext.units[]` (see types below)
- Must use the existing CSS design system from `RentPayPage.css`
- Mobile-first responsive design
- Should integrate smoothly into the existing RentPayPage flow
- Must maintain the Koddly branding

## Available Data Per Unit
```typescript
interface UnitPickOption {
  unitId: string
  unitNumber: string
  floor: string
  monthlyAmount: number
  hasActiveTenant: boolean
  bedrooms?: number | null
  bathrooms?: number | null
  amenities?: string | null
}

// Context also provides:
propertyName: string
propertyAddress?: string
city?: string
currency: string
ownerName: string
```

## Design Requirements

### 1. Hero Section
- **Property overview banner** at the top
  - Property name (prominent)
  - Location/address if available
  - Total available units count
  - Eye-catching background or accent
  - Optional: Property image placeholder or geometric pattern

### 2. Filter/Sort Options (Optional but Nice)
- Filter by bedrooms (Studio, 1BR, 2BR, 3BR+)
- Filter by floor
- Sort by price (low to high, high to low)
- Sort by size (bedrooms)

### 3. Unit Cards (Main Content)
Each unit should be displayed as an **attractive card** with:

**Visual Hierarchy:**
- Large, prominent unit number (e.g., "Unit 2A")
- Monthly rent (bold, eye-catching)
- Bedroom/bathroom count with icons
- Floor information
- Amenities (if available)
- "Available Now" badge or similar CTA

**Card Layout Ideas:**
- Could use a horizontal card layout (image placeholder on left, details on right)
- Could use a vertical card with top section for key info
- Could use a tile/grid layout for compact viewing
- Must handle both units with and without amenity descriptions

**Visual Enhancements:**
- Subtle shadows or borders
- Hover/tap effects for interactivity
- Color-coded availability badges
- Icon-based specs display (bed icon + number, bath icon + number)
- Price displayed prominently with currency

### 4. Floor Grouping
- Keep the floor grouping (it's useful for apartment buildings)
- Make floor headers more prominent and styled
- Add floor count badges
- Consider collapsible floor sections for buildings with many floors

### 5. Call-to-Action
Since these are vacant units, add a way for prospects to express interest:
- "Contact Landlord" button (could show owner contact info or phone number)
- "Schedule Viewing" button
- WhatsApp/call button with owner's number
- Email inquiry option

### 6. Empty State
If no units are available:
- Beautiful "fully occupied" message
- Option to leave contact info for waitlist (future feature)
- Encourage visitors to check back later

### 7. Footer
- Keep "Powered by Koddly" branding
- Maybe add a "List your property" CTA

## Design Inspiration Keywords
- **Airbnb** - clean property cards, great use of white space
- **Zillow/Realtor.com** - real estate listings, prominent pricing
- **Modern real estate websites** - professional, trustworthy
- **Boutique hotel websites** - aspirational, lifestyle-focused

## Color Palette (from RentPayPage.css)
```css
--rp-blue: #2563eb       /* Primary brand color */
--rp-green: #059669      /* Success/available */
--rp-red: #dc2626        /* Alerts */
--rp-amber: #d97706      /* Warnings */
--rp-text: #111827       /* Primary text */
--rp-muted: #6b7280      /* Secondary text */
--rp-border: #e5e7eb     /* Borders */
--rp-bg: #f3f4f6         /* Background */
--rp-card: #ffffff       /* Card background */
```

## Typography Scale
- Heading 1: 24px, weight 800, tight letter-spacing
- Heading 2: 20px, weight 800
- Heading 3: 17px, weight 800
- Body: 14-16px
- Small text: 12-13px
- Tiny text: 11px

## Mobile Considerations
- Large tap targets (minimum 44x44px)
- Easy scrolling through units
- Prominent pricing visible without scrolling
- Quick comparison between units
- One-handed usage friendly
- Fast loading (no heavy images in MVP)

## Suggested Improvements to Current Design

### Current Issues:
1. Plain text lists feel clinical, not inviting
2. Amenities are just a text string (could be more visual)
3. No clear way to contact the landlord
4. "Available" badge is small and not prominent enough
5. No property-level information (address, description)
6. Floor grouping is functional but not beautiful

### Recommended Changes:
1. **Larger unit cards** with more breathing room
2. **Prominent pricing** - make it the focal point
3. **Icon-based specs** - bed/bath icons instead of text
4. **Better "Available" indicator** - use green accent, make it pop
5. **Add contact CTA** - "Inquire" or "Contact Owner" button per unit
6. **Property header** - add a hero section with property details
7. **Floor navigation** - make it easier to jump between floors
8. **Comparison view** - side-by-side comparison option (advanced)

## Deliverables Requested

Please provide:
1. **Component structure** - How should the page be organized?
2. **Detailed JSX/TSX code** - Full implementation with proper TypeScript types
3. **Additional CSS** - Any new styles needed (can extend RentPayPage.css or create a new file)
4. **Responsive behavior** - How should it adapt from mobile to tablet to desktop?
5. **Interaction patterns** - Hover states, tap effects, animations
6. **Empty states** - What to show when no units available
7. **Loading states** - What to show while data loads

## Success Criteria
The redesigned page should:
- ✅ Make property owners proud to show their available units
- ✅ Make prospective tenants excited to inquire
- ✅ Be significantly more visually appealing than the current design
- ✅ Work flawlessly on mobile (80% of QR code scans)
- ✅ Load quickly and feel smooth
- ✅ Maintain professional brand consistency with the rest of the app
- ✅ Be implementable within the existing codebase structure

## Reference Files
- Current implementation: `src/rent/RentPayPage.tsx` (around line 220-350, the "pickingUnit" section)
- Styles: `src/rent/RentPayPage.css`
- Types: `src/rent/types.ts`
- API: `src/rent/api.ts`

## Bonus Features (Optional)
- Photo upload support (placeholder for now, actual upload later)
- Virtual tour link field
- Property description/highlights section
- Nearby amenities (transit, schools, shopping)
- Floor plan sketches
- 3D unit visualization placeholder
- Share button (share specific unit via WhatsApp/SMS)
- Favorite/save units (if multi-property browsing in future)

---

## Example User Flow
1. Prospective tenant sees "For Rent" poster with QR code
2. Scans QR code → lands on property showcase page
3. Sees beautiful header with property name and "5 units available"
4. Scrolls through attractive unit cards
5. Finds unit they like → taps "Contact Owner" button
6. Gets owner's WhatsApp/phone number or sends inquiry
7. Successfully converts interest into viewing/application

---

Please design a modern, beautiful, mobile-first vacant units showcase page that transforms this functional unit picker into a marketing tool that landlords will be proud to share and tenants will love to browse.
