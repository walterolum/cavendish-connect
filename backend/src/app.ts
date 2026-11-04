import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import hpp from 'hpp';
import path from 'path';
import fs from 'fs';

import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import servicesRoutes from './routes/services.routes';
import accommodationRoutes from './routes/accommodation.routes';
import favoritesRoutes from './routes/favorites.routes';
import reviewsRoutes from './routes/reviews.routes';
import messagesRoutes from './routes/messages.routes';
import categoriesRoutes from './routes/categories.routes';
import searchRoutes from './routes/search.routes';
import notificationsRoutes from './routes/notifications.routes';
import adminRoutes from './routes/admin.routes';
import paymentRoutes from './routes/payment.routes';
import reportsRoutes from './routes/reports.routes';
import verificationsRoutes from './routes/verifications.routes';
import eventsRoutes from './routes/events.routes';
import ordersRoutes from './routes/orders.routes';
import { maintenanceGuard } from './middleware/maintenance';
import { connect } from './realtime/hub';
import { verifyAccessToken } from './utils/helpers';
import { authenticate as authenticateRequest } from './middleware/auth';
import prisma from './config/database';
import { getBrand, getPublicSettings } from './utils/settings';
import { brandCss, isHexColor } from './utils/brandTheme';
import { pageMeta, robotsTxt, sitemapXml, siteOrigin } from './utils/seo';

const app = express();

// Hosting platforms put a proxy in front of the app. Trusting it lets the
// rate limiter see each visitor's real address instead of the proxy's.
if (config.nodeEnv === 'production') app.set('trust proxy', 1);

// Security
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      objectSrc: ["'none'"],
      // Voice notes may be stored on Cloudinary.
      mediaSrc: ["'self'", 'blob:', 'https://res.cloudinary.com'],
      // Embedded maps showing where an item, service or room is.
      frameSrc: ['https://maps.google.com', 'https://www.google.com'],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));
app.use(hpp());

// Rate limiting
// Generous enough for a whole campus behind one shared Wi-Fi address
// (each page view makes several API calls), while still stopping floods.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.nodeEnv === 'production' ? 3000 : 20000,
  message: { success: false, message: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Auth rate limiting (stricter)
// Only failed sign-ins count, so password guessing is blocked but
// many students signing in from the same network are not.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  message: { success: false, message: 'Too many auth attempts, please try again later' },
});
app.use('/api/v1/auth/login', authLimiter);
app.use('/api/v1/auth/register', authLimiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression
// Compression would hold back live events, so the realtime stream is skipped.
app.use(compression({ filter: (req, res) => !req.path.startsWith('/api/v1/realtime') && compression.filter(req, res) }));

// Logging
if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}

// Static files (uploads)
app.use('/uploads', express.static(path.resolve(config.storage.path), {
  maxAge: '30d',
  immutable: true,
  setHeaders: (res, file) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // PDFs open in the browser's own (isolated) viewer, which a strict policy would block;
    // photos and voice notes get a locked-down policy.
    if (!file.endsWith('.pdf')) res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'");
  },
}));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'CAV CONNECT API is running',
    environment: config.nodeEnv,
    timestamp: new Date().toISOString(),
  });
});

// API Routes
const apiRouter = express.Router();
apiRouter.use(maintenanceGuard);
apiRouter.post('/newsletter', async (req, res, next) => {
  try {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 191) {
      res.status(422).json({ success: false, message: 'Please enter a valid email address' });
      return;
    }
    // Upsert, so signing up twice is harmless and does not reveal who is subscribed.
    await prisma.newsletterSubscriber.upsert({ where: { email }, update: {}, create: { email } });
    res.status(201).json({ success: true, message: "You're subscribed. We'll email you new rooms and offers." });
  } catch (error) {
    next(error);
  }
});
// Real, live numbers for the "community in numbers" strips (never hard-coded).
let statsCache: { at: number; data: unknown } | null = null;
apiRouter.get('/stats/public', async (_req, res, next) => {
  try {
    if (!statsCache || Date.now() - statsCache.at > 60_000) {
      const [members, providers, listings, services, properties, rating] = await Promise.all([
        prisma.user.count({ where: { deletedAt: null, isActive: true, isSuspended: false } }),
        prisma.service.groupBy({ by: ['userId'], where: { status: 'ACTIVE', deletedAt: null } }),
        prisma.marketplaceListing.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        prisma.service.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        prisma.property.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        prisma.review.aggregate({ where: { status: 'ACTIVE' }, _avg: { rating: true }, _count: true }),
      ]);
      statsCache = {
        at: Date.now(),
        data: {
          activeMembers: members,
          serviceProviders: providers.length,
          liveListings: listings,
          liveServices: services,
          liveProperties: properties,
          averageRating: rating._avg.rating ? Math.round(rating._avg.rating * 10) / 10 : null,
          reviewCount: rating._count,
        },
      };
    }
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, message: 'Platform stats', data: statsCache.data });
  } catch (error) {
    next(error);
  }
});
// Live updates (new messages, typing, read receipts, presence, call signals).
// EventSource can't send headers, so the short-lived access token comes in the URL.
apiRouter.get('/realtime', (req, res) => {
  try {
    const decoded = verifyAccessToken(String(req.query.token ?? ''));
    connect(decoded.userId, res);
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
});
apiRouter.get('/realtime/ice', authenticateRequest, (_req, res) => {
  // STUN finds a direct path between browsers; TURN relays when networks block that.
  const servers: { urls: string | string[]; username?: string; credential?: string }[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
  if (process.env.TURN_URL) servers.push({ urls: process.env.TURN_URL.split(','), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
  res.json({ success: true, message: 'ICE servers', data: servers });
});
apiRouter.get('/settings/public', async (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=30');
    res.json({ success: true, message: 'Public settings', data: await getPublicSettings() });
  } catch (error) {
    next(error);
  }
});
apiRouter.use('/auth', authRoutes);
apiRouter.use('/marketplace', marketplaceRoutes);
apiRouter.use('/services', servicesRoutes);
apiRouter.use('/accommodation', accommodationRoutes);
apiRouter.use('/favorites', favoritesRoutes);
apiRouter.use('/reviews', reviewsRoutes);
apiRouter.use('/messages', messagesRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/search', searchRoutes);
apiRouter.use('/notifications', notificationsRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/reports', reportsRoutes);
apiRouter.use('/verifications', verificationsRoutes);
apiRouter.use('/events', eventsRoutes);
apiRouter.use('/orders', ordersRoutes);
apiRouter.use(paymentRoutes);

app.use('/api/v1', apiRouter);

// Colours chosen in Admin > Appearance, as CSS variables every page loads
// before it paints. ?primary=&accent= previews unsaved colours (admin only UI).
app.get('/brand.css', async (req, res, next) => {
  try {
    const b = await getBrand();
    const pick = (q: unknown, fallback: string) => (typeof q === 'string' && isHexColor(q) ? q : fallback);
    const preview = 'primary' in req.query || 'accent' in req.query;
    res.type('text/css');
    res.setHeader('Cache-Control', preview ? 'no-store' : 'no-cache');
    res.send(brandCss(pick(req.query.primary, b.primaryColor), pick(req.query.accent, b.accentColor)));
  } catch (error) {
    next(error);
  }
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(robotsTxt(siteOrigin(req)));
});
app.get('/sitemap.xml', async (req, res, next) => {
  try {
    res.type('application/xml').setHeader('Cache-Control', 'public, max-age=3600');
    res.send(await sitemapXml(siteOrigin(req)));
  } catch (error) {
    next(error);
  }
});

// In production the same server also serves the built website, so the site,
// its API and uploaded photos all share one address.
if (config.nodeEnv === 'production') {
  const web = path.resolve(__dirname, '../../frontend/dist');
  const template = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
  const builtManifest = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(web, 'manifest.webmanifest'), 'utf8'));
    } catch {
      return {};
    }
  })();

  // The installable-app manifest uses the platform's own name and colours.
  app.get('/manifest.webmanifest', async (_req, res, next) => {
    try {
      const b = await getBrand();
      res.type('application/manifest+json').setHeader('Cache-Control', 'no-cache');
      res.send(JSON.stringify({ ...builtManifest, name: b.appName, short_name: b.universityShort || b.appName, description: b.seoDescription, theme_color: b.primaryColor }));
    } catch (error) {
      next(error);
    }
  });

  app.use(express.static(web, { index: false, setHeaders: (res, file) => {
    // Build files carry a version hash in their name, so they can be cached
    // for a year. Everything else (page, photos, service worker) is checked
    // for updates on each visit, so replacing a photo shows up immediately.
    res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(file) ? 'public, max-age=31536000, immutable' : 'no-cache');
  } }));

  // Every page gets its own title, description, preview image and structured
  // data, so search engines and shared links show the right thing.
  app.use(async (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    // A missing file (e.g. /images/x.png) is a real 404, not the app page.
    if (/\.[a-z0-9]{2,5}$/i.test(req.path)) return next();
    res.setHeader('Cache-Control', 'no-cache');
    try {
      const { head } = await pageMeta(req);
      res.type('html').send(template.replace(/<!--seo-->[\s\S]*?<!--\/seo-->/, head));
    } catch {
      res.type('html').send(template);
    }
  });
}

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║          CAV CONNECT API Server          ║
  ║──────────────────────────────────────────║
  ║  Port: ${PORT}                              ║
  ║  Env:  ${config.nodeEnv.padEnd(33)}║
  ║  URL:  http://localhost:${PORT}             ║
  ╚══════════════════════════════════════════╝
  `);
});

export default app;
