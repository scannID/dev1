import type { MarketingSlug } from './routes'

/** Per-slug SEO title and description for marketing pages. */
export const marketingMeta: Record<MarketingSlug, { title: string; description: string }> = {
  'how-it-works': {
    title: 'How Kode works',
    description:
      'Go from empty catalog to live QR ordering in minutes. Three steps — no hardware, no app installs for your customers.',
  },
  dashboard: {
    title: 'Merchant dashboard',
    description:
      'One live workspace for orders, catalog, and payment status — built for busy floors, not cluttered admin panels.',
  },
  ordering: {
    title: 'Customer ordering',
    description:
      'Guests order from their own phone. No downloads, no accounts required — just scan and order.',
  },
  pricing: {
    title: 'Pricing',
    description:
      'Start free while you set up. Scale when your venue is ready — simple, transparent pricing with no surprise hardware fees.',
  },
  about: {
    title: 'About Kode',
    description:
      'Kode helps modern venues turn menus into scannable ordering experiences — so customers move faster and teams stay in control.',
  },
  careers: {
    title: 'Careers at Kode',
    description:
      'We are building ordering infrastructure for real venues. If you care about craft, reliability, and customer experience, we want to hear from you.',
  },
  contact: {
    title: 'Contact',
    description:
      'Questions about onboarding, partnerships, or support? Reach the Kode team — we respond during business hours.',
  },
  press: {
    title: 'Press',
    description:
      'Brand assets and company facts for journalists, partners, and analysts covering Kode.',
  },
  help: {
    title: 'Help center',
    description:
      'Answers to the questions merchants ask most when going live with Kode QR ordering.',
  },
  guides: {
    title: 'Guides',
    description:
      'Practical playbooks for launching and running QR ordering well at your restaurant, bar, or venue.',
  },
  status: {
    title: 'System status',
    description: 'Current availability of Kode services — live status and incident updates.',
  },
  api: {
    title: 'API',
    description:
      'Programmatic access to Kode for partners and advanced operators. REST API documentation for orders, tickets, and payments.',
  },
  privacy: {
    title: 'Privacy Policy',
    description:
      'How Kode collects, uses, and protects information from merchants, customers, and visitors.',
  },
  terms: {
    title: 'Terms of Service',
    description:
      'The terms that govern your use of Kode — QR ordering, event ticketing, and payment features.',
  },
  security: {
    title: 'Security',
    description:
      'How Kode protects merchant and customer data — a practical, layered approach to platform security.',
  },
  cookies: {
    title: 'Cookie Policy',
    description:
      'How Kode uses cookies and similar technologies on this site and in the merchant app.',
  },
}
