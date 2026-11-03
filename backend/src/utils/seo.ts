import { Request } from 'express';
import prisma from '../config/database';
import { getBrand } from './settings';

/**
 * Search engines and link previews (WhatsApp, Facebook, X, LinkedIn) read the
 * page's <head> without running JavaScript, so the server fills it in for each
 * page: title, description, preview image, canonical URL and structured data.
 */

type Brand = Awaited<ReturnType<typeof getBrand>>;

interface PageMeta {
  title: string;
  description: string;
  image?: string;
  noindex?: boolean;
  type?: 'website' | 'product' | 'article';
  jsonLd?: Record<string, unknown>[];
}

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const clip = (v: string, n = 158) => {
  const s = v.replace(/\s+/g, ' ').trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

export function siteOrigin(req: Request) {
  return `${req.protocol}://${req.get('host')}`;
}

const absolute = (origin: string, url?: string | null) => (!url ? undefined : /^https?:\/\//.test(url) ? url : `${origin}${url}`);

/** Signed-in or admin-only areas that should never appear in search results. */
const PRIVATE = /^\/(admin|dashboard|messages|profile|favorites|notifications|set-password|login|register|post)(\/|$)|\/(create|edit)$/;

const SECTIONS: Record<string, (b: Brand) => Omit<PageMeta, 'jsonLd'>> = {
  '/marketplace': (b) => ({ title: `Campus Market · ${b.appName}`, description: `Buy and sell second-hand items within the ${b.universityName} community: books, electronics, furniture and more.`, image: b.heroMarket }),
  '/marketplace/browse': (b) => ({ title: `Browse items · ${b.appName}`, description: `Search items for sale from verified members of ${b.universityName}.`, image: b.heroMarket }),
  '/services': (b) => ({ title: `Services Hub · ${b.appName}`, description: `Find and offer services within the ${b.universityName} community: tutoring, design, repairs, events and more.`, image: b.heroServices }),
  '/services/browse': (b) => ({ title: `Find services · ${b.appName}`, description: `Hire trusted students and providers from ${b.universityName}.`, image: b.heroServices }),
  '/accommodation': (b) => ({ title: `Student accommodation · ${b.appName}`, description: `Hostels, rooms and apartments near ${b.universityShort}, listed by trusted landlords around ${b.location}.`, image: b.heroStays }),
  '/accommodation/search': (b) => ({ title: `Search stays · ${b.appName}`, description: `Find a hostel, room or apartment near ${b.universityShort}.`, image: b.heroStays }),
  '/explore': (b) => ({ title: `Search · ${b.appName}`, description: `Search items, services and accommodation across ${b.appName}.` }),
  '/help': (b) => ({ title: `Help & Support · ${b.appName}`, description: `Accounts, safe trading, accommodation and reporting problems on ${b.appName}.` }),
};

async function detailMeta(path: string, origin: string, b: Brand): Promise<PageMeta | null> {
  const m = path.match(/^\/(marketplace|services|accommodation)\/([a-z0-9-]+)$/i);
  if (!m || ['browse', 'create', 'search', 'my-listings'].includes(m[2])) return null;
  const [, kind, slug] = m;
  const image = { orderBy: { sortOrder: 'asc' as const }, take: 1, select: { url: true } };

  if (kind === 'marketplace') {
    const l = await prisma.marketplaceListing.findFirst({ where: { slug, status: 'ACTIVE', deletedAt: null }, include: { images: image, category: { select: { name: true } } } });
    if (!l) return null;
    return {
      title: `${l.title} · ${b.appName}`,
      description: clip(l.description),
      image: l.images[0]?.url,
      type: 'product',
      jsonLd: [{
        '@context': 'https://schema.org', '@type': 'Product', name: l.title, description: clip(l.description, 500),
        image: absolute(origin, l.images[0]?.url), category: l.category?.name,
        offers: { '@type': 'Offer', price: Number(l.price), priceCurrency: l.currency, availability: 'https://schema.org/InStock', url: `${origin}${path}`, itemCondition: l.condition === 'NEW' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition' },
      }],
    };
  }
  if (kind === 'services') {
    const s = await prisma.service.findFirst({ where: { slug, status: 'ACTIVE', deletedAt: null }, include: { images: image, serviceCategory: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } } });
    if (!s) return null;
    return {
      title: `${s.title} · ${b.appName}`,
      description: clip(s.description),
      image: s.images[0]?.url,
      jsonLd: [{
        '@context': 'https://schema.org', '@type': 'Service', name: s.title, description: clip(s.description, 500),
        serviceType: s.serviceCategory?.name, image: absolute(origin, s.images[0]?.url), areaServed: b.location,
        provider: { '@type': 'Person', name: `${s.user.firstName} ${s.user.lastName}`.trim() },
        ...(s.priceMin != null && { offers: { '@type': 'Offer', price: Number(s.priceMin), priceCurrency: s.currency } }),
      }],
    };
  }
  const p = await prisma.property.findFirst({ where: { slug, status: 'ACTIVE', deletedAt: null }, include: { images: image } });
  if (!p) return null;
  return {
    title: `${p.title} · ${b.appName}`,
    description: clip(`${p.location}. ${p.description}`),
    image: p.images[0]?.url,
    jsonLd: [{
      '@context': 'https://schema.org', '@type': 'Accommodation', name: p.title, description: clip(p.description, 500),
      image: absolute(origin, p.images[0]?.url), address: { '@type': 'PostalAddress', streetAddress: p.location },
      numberOfRooms: p.totalRooms,
    }],
  };
}

export async function pageMeta(req: Request): Promise<{ head: string; themeColor: string }> {
  const b = await getBrand();
  const origin = siteOrigin(req);
  const path = req.path.replace(/\/+$/, '') || '/';
  const site = { '@context': 'https://schema.org', '@type': 'WebSite', name: b.appName, url: `${origin}/`, potentialAction: { '@type': 'SearchAction', target: `${origin}/explore?q={search_term_string}`, 'query-input': 'required name=search_term_string' } };
  const org = { '@context': 'https://schema.org', '@type': 'Organization', name: b.appName, url: `${origin}/`, ...(b.logoUrl && { logo: absolute(origin, b.logoUrl) }), parentOrganization: { '@type': 'CollegeOrUniversity', name: b.universityName, address: b.location } };

  let meta: PageMeta;
  if (PRIVATE.test(path)) {
    meta = { title: b.appName, description: b.seoDescription, noindex: true };
  } else if (path === '/') {
    meta = { title: `${b.appName} · ${b.tagline}`, description: b.seoDescription, image: b.heroMarket, jsonLd: [site, org] };
  } else {
    meta = SECTIONS[path]?.(b) ?? (await detailMeta(path, origin, b).catch(() => null)) ?? { title: b.appName, description: b.seoDescription };
  }

  const url = `${origin}${path === '/' ? '/' : path}`;
  const image = absolute(origin, meta.image || b.heroMarket);
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    meta.noindex ? '<meta name="robots" content="noindex, nofollow" />' : `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${esc(b.appName)}" />`,
    `<meta property="og:type" content="${meta.type ?? 'website'}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
    `<meta name="theme-color" content="${esc(b.primaryColor)}" />`,
    ...(meta.jsonLd ?? []).map((d) => `<script type="application/ld+json">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`),
  ].filter(Boolean);
  return { head: tags.join('\n    '), themeColor: b.primaryColor };
}

/** robots.txt: public pages are open; private areas and the API are not. */
export function robotsTxt(origin: string) {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /dashboard',
    'Disallow: /messages',
    'Disallow: /profile',
    'Disallow: /favorites',
    'Disallow: /notifications',
    'Disallow: /set-password',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
}

/** sitemap.xml: section pages plus every live ad, service and property. */
export async function sitemapXml(origin: string) {
  const live = { status: 'ACTIVE' as const, deletedAt: null };
  const pick = { slug: true, updatedAt: true };
  const [listings, services, properties] = await Promise.all([
    prisma.marketplaceListing.findMany({ where: live, select: pick, orderBy: { updatedAt: 'desc' }, take: 5000 }),
    prisma.service.findMany({ where: live, select: pick, orderBy: { updatedAt: 'desc' }, take: 5000 }),
    prisma.property.findMany({ where: live, select: pick, orderBy: { updatedAt: 'desc' }, take: 5000 }),
  ]);
  const entry = (loc: string, lastmod?: Date, priority = '0.6') =>
    `  <url><loc>${esc(origin + loc)}</loc>${lastmod ? `<lastmod>${lastmod.toISOString()}</lastmod>` : ''}<priority>${priority}</priority></url>`;
  const urls = [
    entry('/', undefined, '1.0'),
    ...['/marketplace', '/services', '/accommodation'].map((p) => entry(p, undefined, '0.9')),
    ...['/marketplace/browse', '/services/browse', '/accommodation/search', '/help'].map((p) => entry(p, undefined, '0.7')),
    ...listings.map((x) => entry(`/marketplace/${x.slug}`, x.updatedAt)),
    ...services.map((x) => entry(`/services/${x.slug}`, x.updatedAt)),
    ...properties.map((x) => entry(`/accommodation/${x.slug}`, x.updatedAt)),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
