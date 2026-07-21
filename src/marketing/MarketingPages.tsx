import type { ReactNode } from 'react'
import type { MarketingSlug } from './routes'

export type MarketingPage = {
  eyebrow: string
  title: string
  lead: string
  narrow?: boolean
  showCta?: boolean
  body: ReactNode
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 40 }}>
      <h2
        style={{
          margin: '0 0 12px',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: '-0.02em',
          color: 'var(--foreground)',
        }}
      >
        {title}
      </h2>
      <div style={{ color: 'var(--muted-foreground)', fontSize: 15, lineHeight: 1.7 }}>{children}</div>
    </section>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul style={{ margin: '12px 0 0', padding: '0 0 0 18px', display: 'grid', gap: 8 }}>
      {items.map(item => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  )
}

function SimpleTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 16, border: '1px solid rgba(15,23,42,0.08)', borderRadius: 12 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: 'rgba(15,23,42,0.03)', textAlign: 'left' }}>
            {headers.map(h => (
              <th key={h} style={{ padding: '12px 14px', fontWeight: 700, color: 'var(--foreground)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderTop: '1px solid rgba(15,23,42,0.06)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '12px 14px', color: 'var(--muted-foreground)', verticalAlign: 'top' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const LEGAL_UPDATED = 'July 22, 2026'

export const marketingPages: Record<MarketingSlug, MarketingPage> = {
  'how-it-works': {
    eyebrow: 'Product',
    title: 'How Scanny works',
    lead: 'Go from empty catalog to live QR ordering in minutes. Three steps — no hardware, no app installs for your guests.',
    showCta: true,
    body: (
      <>
        <Section title="1. Build your catalog">
          Add meals, drinks, services, or goods with clear names and prices. Toggle availability anytime — changes appear for customers immediately.
        </Section>
        <Section title="2. Share your QR">
          Every business gets a unique QR code and customer URL. Print it for tables, counters, or packaging. Guests scan with their phone camera.
        </Section>
        <Section title="3. Run your dashboard">
          New orders land in your merchant dashboard in real time. Update status, track payments, and keep service moving from one screen.
        </Section>
        <Section title="What you need">
          <Bullets
            items={[
              'A modern browser and internet connection',
              'A Scanny merchant account',
              'A printer or screen to display your QR (optional but recommended)',
            ]}
          />
        </Section>
      </>
    ),
  },

  dashboard: {
    eyebrow: 'Product',
    title: 'Merchant dashboard',
    lead: 'One live workspace for orders, catalog, and payment status — built for busy floors, not cluttered admin panels.',
    showCta: true,
    body: (
      <>
        <Section title="Stay ahead of every ticket">
          Open orders appear the moment a customer checks out. Highlight new arrivals, advance status from Pending to Ready, and clear completed work without hunting across tools.
        </Section>
        <Section title="Operational clarity">
          <Bullets
            items={[
              'Summary metrics for open orders, paid sales, and awaiting payment',
              'Fast status updates designed for counter and kitchen workflows',
              'Catalog edits that sync to the customer menu instantly',
            ]}
          />
        </Section>
        <Section title="Built for real venues">
          Whether you run a café, hotel lounge, boutique, or canteen, the dashboard stays focused on what matters: who ordered, what they need, and whether they have paid.
        </Section>
      </>
    ),
  },

  ordering: {
    eyebrow: 'Product',
    title: 'Customer ordering',
    lead: 'Guests order from their own phone. No downloads, no accounts required for a smooth first visit.',
    showCta: true,
    body: (
      <>
        <Section title="Scan. Browse. Order.">
          Customers open your live menu through the QR experience, select items, review their cart, and confirm payment preferences — then the kitchen or counter sees the order at once.
        </Section>
        <Section title="Designed for speed">
          <Bullets
            items={[
              'Mobile-first layout that works on any modern smartphone browser',
              'Clear item names, prices, and availability',
              'Table or takeaway context so staff know where the order belongs',
            ]}
          />
        </Section>
        <Section title="Less friction, more throughput">
          Reduce queue pressure and missed tickets by letting guests order when they are ready — while you retain full control from the merchant dashboard.
        </Section>
      </>
    ),
  },

  pricing: {
    eyebrow: 'Product',
    title: 'Simple, transparent pricing',
    lead: 'Start free while you set up. Scale when your venue is ready — no surprise hardware fees.',
    showCta: true,
    body: (
      <>
        <SimpleTable
          headers={['Plan', 'Best for', 'Includes']}
          rows={[
            ['Starter', 'Trying Scanny with one location', 'QR ordering, catalog, live dashboard, core payment tracking'],
            ['Growth', 'Busy restaurants, cafés, and hotels', 'Everything in Starter plus priority support and advanced ops views'],
            ['Enterprise', 'Groups and multi-site operators', 'Custom onboarding, dedicated support, and volume arrangements'],
          ]}
        />
        <Section title="What we do not charge for">
          <Bullets
            items={[
              'Customer app downloads — guests use the browser',
              'Per-table hardware lock-in',
              'Hidden setup kits you do not need',
            ]}
          />
        </Section>
        <Section title="Talk to us">
          Need a quote for multiple sites? Reach out via Contact and we will tailor Growth or Enterprise to your operation.
        </Section>
      </>
    ),
  },

  about: {
    eyebrow: 'Company',
    title: 'About Scanny',
    lead: 'Scanny helps modern venues turn menus into scannable ordering experiences — so customers move faster and teams stay in control.',
    showCta: true,
    body: (
      <>
        <Section title="Our mission">
          Make QR-powered ordering dependable for African hospitality and retail — starting with the workflows restaurants, hotels, and service businesses actually use every day.
        </Section>
        <Section title="What we believe">
          <Bullets
            items={[
              'Software should reduce queues, not create new ones',
              'Merchants deserve real-time clarity, not delayed reports',
              'Customers should order without installing yet another app',
            ]}
          />
        </Section>
        <Section title="Where we focus">
          We build for operators who care about speed, presentation, and trust — from Kampala cafés to hotel lounges and multi-outlet brands.
        </Section>
      </>
    ),
  },

  careers: {
    eyebrow: 'Company',
    title: 'Careers',
    lead: 'We are building ordering infrastructure for real venues. If you care about craft, reliability, and customer experience, we want to hear from you.',
    showCta: false,
    body: (
      <>
        <Section title="How we work">
          Small teams, clear ownership, and product decisions grounded in merchant feedback. We value people who ship carefully and communicate directly.
        </Section>
        <Section title="Roles we often hire">
          <Bullets
            items={[
              'Full-stack engineers (TypeScript, React, Java)',
              'Product designers with systems thinking',
              'Customer success and onboarding specialists',
            ]}
          />
        </Section>
        <Section title="Apply">
          Send a short note and CV to <strong style={{ color: 'var(--foreground)' }}>careers@scanny.app</strong>. Tell us what you want to build and why Scanny.
        </Section>
      </>
    ),
  },

  contact: {
    eyebrow: 'Company',
    title: 'Contact',
    lead: 'Questions about onboarding, partnerships, or support — we respond during business hours.',
    showCta: true,
    body: (
      <>
        <Section title="Channels">
          <Bullets
            items={[
              'General: hello@scanny.app',
              'Support: support@scanny.app',
              'Press: press@scanny.app',
            ]}
          />
        </Section>
        <Section title="Send a message">
          <form
            onSubmit={e => {
              e.preventDefault()
            }}
            style={{ display: 'grid', gap: 12, maxWidth: 480, marginTop: 8 }}
          >
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Name
              <input
                name="name"
                placeholder="Your name"
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(15,23,42,0.12)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Email
              <input
                name="email"
                type="email"
                placeholder="you@business.com"
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(15,23,42,0.12)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>
              Message
              <textarea
                name="message"
                rows={4}
                placeholder="How can we help?"
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(15,23,42,0.12)',
                  fontSize: 14,
                  fontFamily: 'inherit',
                  resize: 'vertical',
                }}
              />
            </label>
            <button
              type="submit"
              style={{
                justifySelf: 'start',
                background: 'var(--primary)',
                color: 'var(--primary-foreground)',
                border: 'none',
                borderRadius: 8,
                padding: '10px 18px',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Send message
            </button>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--muted-foreground)' }}>
              This demo form does not submit to a server yet. Email us directly for a guaranteed reply.
            </p>
          </form>
        </Section>
      </>
    ),
  },

  press: {
    eyebrow: 'Company',
    title: 'Press',
    lead: 'Brand assets and company facts for journalists, partners, and analysts.',
    showCta: false,
    body: (
      <>
        <Section title="About the company">
          Scanny is a QR ordering platform for merchants. Customers scan, browse a live catalog, and place orders; merchants manage fulfillment from a real-time dashboard.
        </Section>
        <Section title="Boilerplate">
          Scanny turns menus and catalogs into scannable ordering experiences. Built for restaurants, hotels, cafés, and service businesses that need speed without forcing guests to install an app.
        </Section>
        <Section title="Media contact">
          For interviews, logos, or product briefings: <strong style={{ color: 'var(--foreground)' }}>press@scanny.app</strong>
        </Section>
      </>
    ),
  },

  help: {
    eyebrow: 'Resources',
    title: 'Help center',
    lead: 'Answers to the questions merchants ask most when going live with Scanny.',
    showCta: true,
    body: (
      <>
        <Section title="Getting started">
          <Bullets
            items={[
              'Create your merchant account and complete business profile',
              'Add catalog items with prices and availability',
              'Download or print your QR and place it where guests can scan',
            ]}
          />
        </Section>
        <Section title="Orders & payments">
          <Bullets
            items={[
              'New orders appear on the Orders screen as soon as customers check out',
              'Update status as you prepare and complete each ticket',
              'Mark payment state so your awaiting-pay list stays accurate',
            ]}
          />
        </Section>
        <Section title="Still stuck?">
          Email <strong style={{ color: 'var(--foreground)' }}>support@scanny.app</strong> with your business name and a short description of the issue.
        </Section>
      </>
    ),
  },

  guides: {
    eyebrow: 'Resources',
    title: 'Guides',
    lead: 'Practical playbooks for launching and running QR ordering well.',
    showCta: true,
    body: (
      <>
        <Section title="Launch checklist">
          <Bullets
            items={[
              'Confirm catalog names are guest-friendly and prices are correct',
              'Test the customer flow on a phone before printing QR materials',
              'Brief staff on status updates and unpaid order handling',
            ]}
          />
        </Section>
        <Section title="Floor best practices">
          <Bullets
            items={[
              'Place QR codes at eye level on tables or counters',
              'Keep one dashboard screen visible during peak hours',
              'Review unpaid tickets at closing every day',
            ]}
          />
        </Section>
        <Section title="More coming">
          We publish new guides as merchant patterns emerge. Request a topic via support@scanny.app.
        </Section>
      </>
    ),
  },

  status: {
    eyebrow: 'Resources',
    title: 'System status',
    lead: 'Current availability of Scanny services. We aim for transparent, timely updates.',
    showCta: false,
    body: (
      <>
        <div
          style={{
            marginTop: 28,
            padding: '14px 16px',
            borderRadius: 12,
            background: 'rgba(34,197,94,0.1)',
            border: '1px solid rgba(34,197,94,0.25)',
            color: '#166534',
            fontSize: 14,
            fontWeight: 650,
          }}
        >
          All systems operational
        </div>
        <SimpleTable
          headers={['Component', 'Status']}
          rows={[
            ['Merchant dashboard', 'Operational'],
            ['Customer ordering', 'Operational'],
            ['Authentication', 'Operational'],
            ['API', 'Operational'],
            ['Realtime order updates', 'Operational'],
          ]}
        />
        <Section title="Incidents">
          No active incidents. Historical notices will appear here when applicable.
        </Section>
      </>
    ),
  },

  api: {
    eyebrow: 'Resources',
    title: 'API',
    lead: 'Programmatic access for partners and advanced operators. Documentation expands as endpoints stabilize.',
    showCta: false,
    body: (
      <>
        <Section title="Overview">
          Scanny exposes authenticated HTTP APIs for catalog, orders, and business configuration used by the merchant and customer applications.
        </Section>
        <SimpleTable
          headers={['Area', 'Capability']}
          rows={[
            ['Catalog', 'List and manage items and availability'],
            ['Orders', 'Create, list, and update order status'],
            ['Business', 'Profile and QR / customer entry points'],
            ['Auth', 'Secured via Keycloak-issued tokens'],
          ]}
        />
        <Section title="Access">
          API access for production integrations is granted per account. Contact <strong style={{ color: 'var(--foreground)' }}>hello@scanny.app</strong> with your use case.
        </Section>
      </>
    ),
  },

  privacy: {
    eyebrow: 'Legal',
    title: 'Privacy Policy',
    lead: `Last updated ${LEGAL_UPDATED}. This policy explains how Scanny collects, uses, and protects information.`,
    narrow: true,
    showCta: false,
    body: (
      <>
        <Section title="Who we are">
          Scanny provides QR ordering software for merchants and ordering experiences for their customers. For privacy questions, contact privacy@scanny.app.
        </Section>
        <Section title="Information we collect">
          <Bullets
            items={[
              'Account details you provide when registering as a merchant',
              'Business catalog, order, and operational data you enter into the product',
              'Customer order details necessary to fulfill a purchase (for example items and table context)',
              'Technical logs such as IP address, device type, and approximate usage timestamps',
            ]}
          />
        </Section>
        <Section title="How we use information">
          We use data to operate the service, authenticate users, process orders, improve reliability, prevent abuse, and communicate service-related notices.
        </Section>
        <Section title="Sharing">
          We do not sell personal information. We may share data with infrastructure providers under contract, or when required by law.
        </Section>
        <Section title="Retention">
          We retain information for as long as needed to provide the service and meet legal obligations, then delete or anonymize it where feasible.
        </Section>
        <Section title="Your choices">
          Merchants may update account information in-product. For access or deletion requests, email privacy@scanny.app. We will respond within a reasonable period.
        </Section>
      </>
    ),
  },

  terms: {
    eyebrow: 'Legal',
    title: 'Terms of Service',
    lead: `Last updated ${LEGAL_UPDATED}. By using Scanny you agree to these terms.`,
    narrow: true,
    showCta: false,
    body: (
      <>
        <Section title="The service">
          Scanny provides software for QR-based ordering, catalog management, and merchant order operations. Features may evolve; we will aim to avoid material disruption where practical.
        </Section>
        <Section title="Accounts">
          You are responsible for safeguarding login credentials and for activity under your merchant account. Provide accurate business information and keep it current.
        </Section>
        <Section title="Acceptable use">
          You may not misuse the service, attempt unauthorized access, interfere with other customers, or use Scanny for unlawful activity.
        </Section>
        <Section title="Your content">
          You retain rights to catalogs and business content you upload. You grant Scanny a limited license to host and process that content solely to operate the product.
        </Section>
        <Section title="Disclaimers">
          The service is provided on an “as is” basis to the extent permitted by law. We do not warrant uninterrupted availability, though we work to maintain high reliability.
        </Section>
        <Section title="Contact">
          Questions about these terms: legal@scanny.app.
        </Section>
      </>
    ),
  },

  security: {
    eyebrow: 'Legal',
    title: 'Security',
    lead: 'We take a practical, layered approach to protecting merchant and customer data.',
    narrow: true,
    showCta: false,
    body: (
      <>
        <Section title="Controls">
          <Bullets
            items={[
              'Authentication via industry-standard identity (Keycloak) for merchant access',
              'Transport encryption (HTTPS) for application traffic',
              'Role-oriented access for merchant versus administrative surfaces',
              'Operational logging to investigate suspected abuse',
            ]}
          />
        </Section>
        <Section title="Your responsibilities">
          Use strong credentials, limit staff access to trusted operators, and report suspected account compromise promptly.
        </Section>
        <Section title="Report a vulnerability">
          Email security@scanny.app with enough detail to reproduce the issue. Please avoid public disclosure until we have had a reasonable chance to respond.
        </Section>
      </>
    ),
  },

  cookies: {
    eyebrow: 'Legal',
    title: 'Cookie Policy',
    lead: `Last updated ${LEGAL_UPDATED}. This page describes how Scanny uses cookies and similar technologies.`,
    narrow: true,
    showCta: false,
    body: (
      <>
        <Section title="What we use">
          <Bullets
            items={[
              'Essential cookies and storage for authentication and session continuity',
              'Preference storage such as theme settings on your device',
              'Limited technical diagnostics to keep the product reliable',
            ]}
          />
        </Section>
        <Section title="Managing preferences">
          You can clear site data in your browser settings. Disabling essential storage may prevent sign-in or core features from working.
        </Section>
        <Section title="Updates">
          We may update this policy as the product changes. The “Last updated” date at the top will reflect the latest revision.
        </Section>
      </>
    ),
  },
}
