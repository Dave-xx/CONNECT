import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth, DecodedIdToken } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const adminAuth = getAuth();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

// Sliding-window rate limiter per IP for /api/*
const rateWindowMs = 60_000;
const maxRequestsPerWindow = 60;
const rateBuckets = new Map<string, number[]>();

const apiRateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const timestamps = (rateBuckets.get(ip) || []).filter((t) => now - t < rateWindowMs);
  if (timestamps.length >= maxRequestsPerWindow) {
    res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
    return;
  }
  timestamps.push(now);
  rateBuckets.set(ip, timestamps);
  next();
};

const KENYA_CATEGORY_KEYWORDS: Array<{ slug: string; terms: string[] }> = [
  { slug: 'plumbing', terms: ['plumber', 'plumbing', 'leak', 'leaking', 'sink', 'pipe', 'tap', 'toilet', 'drain', 'blocked', 'borehole', 'water tank', 'geyser'] },
  { slug: 'electrical-services', terms: ['electrician', 'electrical', 'wiring', 'socket', 'breaker', 'inverter', 'solar', 'security light', 'lights', 'power', 'token meter'] },
  { slug: 'cleaning-services', terms: ['clean', 'cleaner', 'cleaning', 'housekeeping', 'sofa', 'carpet', 'fumigation', 'deep clean', 'maid', 'mama fua'] },
  { slug: 'home-repairs', terms: ['handyman', 'repair', 'fix', 'hinge', 'door', 'lock', 'mount', 'tv mount', 'shelf', 'curtain'] },
  { slug: 'painting', terms: ['paint', 'painter', 'painting', 'wall', 'interior', 'exterior', 'varnish', 'gypsum'] },
  { slug: 'carpentry', terms: ['carpenter', 'carpentry', 'wood', 'cabinet', 'wardrobe', 'furniture', 'table', 'bed', 'shelf'] },
  { slug: 'appliance-repair', terms: ['fridge', 'refrigerator', 'washing machine', 'cooker', 'oven', 'microwave', 'tv', 'ac', 'aircon', 'appliance', 'cooling'] },
  { slug: 'moving-and-relocation', terms: ['move', 'moving', 'movers', 'relocate', 'relocation', 'packing', 'truck', 'lorry', 'canter'] },
  { slug: 'gardening-and-landscaping', terms: ['garden', 'gardener', 'lawn', 'grass', 'tree', 'hedge', 'landscaping', 'compound'] },
  { slug: 'pest-control', terms: ['pest', 'cockroach', 'bedbug', 'termite', 'rat', 'rodent', 'mosquito', 'fumigate'] },
  { slug: 'automotive-services', terms: ['car', 'mechanic', 'auto', 'automotive', 'engine', 'brake', 'service', 'tyre', 'battery', 'diagnostics'] },
  { slug: 'beauty-and-personal-care', terms: ['hair', 'salon', 'barber', 'makeup', 'nails', 'massage', 'braids', 'beauty'] },
  { slug: 'computer-and-it-support', terms: ['laptop', 'computer', 'pc', 'macbook', 'printer', 'wifi', 'network', 'cctv', 'software', 'it support'] },
  { slug: 'photography-and-events', terms: ['photo', 'photographer', 'video', 'videographer', 'wedding', 'event', 'dj', 'catering', 'tent'] },
  { slug: 'construction-and-renovation', terms: ['mason', 'builder', 'construction', 'renovation', 'tiling', 'tile', 'roof', 'cabro', 'welding', 'steel'] },
  { slug: 'laundry-services', terms: ['laundry', 'dry clean', 'ironing', 'duvet', 'wash and fold'] },
];

const KENYA_LOCATIONS = [
  'Nairobi', 'Westlands', 'Kilimani', 'Kileleshwa', 'Karen', 'Lavington', 'South B', 'South C',
  'Langata', 'Kasarani', 'Ruaka', 'Runda', 'CBD', 'Mombasa', 'Nyali', 'Bamburi', 'Kisumu',
  'Milimani', 'Nakuru', 'Eldoret', 'Thika', 'Kiambu', 'Kikuyu', 'Syokimau', 'Kitengela',
];

function fallbackIntentParse(query: string) {
  const lower = query.toLowerCase();
  let matchedCategory = '';
  for (const item of KENYA_CATEGORY_KEYWORDS) {
    if (item.terms.some((t) => lower.includes(t))) {
      matchedCategory = item.slug;
      break;
    }
  }
  const matchedLocation = KENYA_LOCATIONS.find((loc) => lower.includes(loc.toLowerCase())) || '';
  const urgent = /today|now|urgent|emergency|asap|immediately|burst/i.test(lower);
  return {
    categorySlug: matchedCategory,
    keywords: query.trim().split(/\s+/).filter((w) => w.length > 2).slice(0, 5),
    location: matchedLocation,
    availableTodayOnly: urgent,
    emergencyOnly: /emergency|burst|sparking|flood/i.test(lower),
    clarifyingQuestion: matchedCategory
      ? (matchedLocation ? '' : 'Which neighborhood or city in Kenya do you need the professional in?')
      : 'Could you share a bit more detail on the type of service or repair you need?',
    summary: matchedCategory
      ? `Matched your request to ${matchedCategory.replace(/-/g, ' ')}${matchedLocation ? ` in ${matchedLocation}` : ''}.`
      : 'Showing marketplace results matching your description.',
    usedFallback: true,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api', apiRateLimiter);

  app.get('/api/health', (_req, res) => {
    const mpesaConfigured = Boolean(
      process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY
    );
    res.json({
      ok: true,
      service: 'ServiceConnect API',
      geminiConfigured: Boolean(getGeminiClient()),
      mpesaConfigured,
      mpesaMode: mpesaConfigured ? 'configured' : 'not_configured',
    });
  });

  // Public Smart Search Intent Parser (never fabricates providers or prices)
  app.post('/api/ai/smart-search', async (req, res) => {
    const query = typeof req.body?.query === 'string' ? req.body.query.trim().slice(0, 400) : '';
    const categories = Array.isArray(req.body?.categories) ? req.body.categories.slice(0, 30) : [];

    if (!query || query.length < 3) {
      res.status(400).json({ error: 'Please enter a short description of what you need.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.json(fallbackIntentParse(query));
      return;
    }

    try {
      const categoryList = categories
        .map((c: { slug?: string; name?: string }) => `${c.slug}: ${c.name}`)
        .join(', ');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Customer request: "${query}"\nAvailable ServiceConnect categories: ${categoryList || KENYA_CATEGORY_KEYWORDS.map((c) => c.slug).join(', ')}\nSupported Kenyan cities/areas include: ${KENYA_LOCATIONS.join(', ')}.`,
        config: {
          systemInstruction:
            'You are ServiceConnect Smart Search intent parser for a Kenyan local services marketplace. Extract the best matching categorySlug from the provided list (or empty string if unclear), concise search keywords, city/neighborhood location if mentioned, whether the user needs someone today or urgently, a single helpful clarifying question if category or location is missing, and a 1-sentence neutral summary. NEVER invent provider names, prices, or ratings.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              categorySlug: { type: Type.STRING },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              location: { type: Type.STRING },
              availableTodayOnly: { type: Type.BOOLEAN },
              emergencyOnly: { type: Type.BOOLEAN },
              clarifyingQuestion: { type: Type.STRING },
              summary: { type: Type.STRING },
            },
            required: ['categorySlug', 'keywords', 'location', 'availableTodayOnly', 'emergencyOnly', 'clarifyingQuestion', 'summary'],
          },
        },
      });

      const parsed = JSON.parse(response.text || '{}');
      res.json({
        categorySlug: typeof parsed.categorySlug === 'string' ? parsed.categorySlug : '',
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 6) : [],
        location: typeof parsed.location === 'string' ? parsed.location : '',
        availableTodayOnly: Boolean(parsed.availableTodayOnly),
        emergencyOnly: Boolean(parsed.emergencyOnly),
        clarifyingQuestion: typeof parsed.clarifyingQuestion === 'string' ? parsed.clarifyingQuestion : '',
        summary: typeof parsed.summary === 'string' ? parsed.summary : 'Matched your request to marketplace filters.',
        usedFallback: false,
      });
    } catch (error) {
      console.error('AI smart search error, using deterministic fallback:', error);
      res.json(fallbackIntentParse(query));
    }
  });

  // Authenticated Provider AI Assistant (Bio, Service Copy, Quote Structuring, Reply Draft)
  app.post('/api/ai/provider-assist', requireAuth, async (req: AuthRequest, res) => {
    const mode = typeof req.body?.mode === 'string' ? req.body.mode : '';
    const input = typeof req.body?.input === 'string' ? req.body.input.trim().slice(0, 1500) : '';
    const context = typeof req.body?.context === 'string' ? req.body.context.trim().slice(0, 600) : '';

    if (!['bio', 'service_description', 'quote_draft', 'reply_suggestion'].includes(mode)) {
      res.status(400).json({ error: 'Unsupported assistant mode.' });
      return;
    }
    if (!input) {
      res.status(400).json({ error: 'Please provide input details to assist with.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI Assistant requires GEMINI_API_KEY configured in server Secrets. You can write and edit your text manually.',
      });
      return;
    }

    try {
      if (mode === 'quote_draft') {
        const response = await ai.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: `Job request from customer:\n${input}\n\nProvider context:\n${context}`,
          config: {
            systemInstruction:
              'Organize the customer job requirements into clear scope items and an estimated duration for a Kenyan service provider quotation. Leave prices at 0 so the provider explicitly enters and approves final KSh pricing.',
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                quotationNotes: { type: Type.STRING },
                estimatedDuration: { type: Type.STRING },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      detail: { type: Type.STRING },
                    },
                    required: ['label', 'detail'],
                  },
                },
              },
              required: ['quotationNotes', 'estimatedDuration', 'items'],
            },
          },
        });
        res.json({ result: JSON.parse(response.text || '{}') });
        return;
      }

      const instructionMap: Record<string, string> = {
        bio: 'Write a clear, trustworthy, concise professional biography (max 110 words) for a Kenyan local services provider profile on ServiceConnect. Focus on practical experience, reliability, and neighborhoods served. Do not invent credentials or licenses.',
        service_description: 'Rewrite this service listing description clearly in 2-4 crisp sentences for Kenyan customers, stating what is included, typical timeline, and preparation needed. No hype or clichés.',
        reply_suggestion: 'Draft a polite, professional, concise message (max 60 words) from the service provider to the customer about their booking or quote inquiry.',
      };

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Input:\n${input}\n\nAdditional context:\n${context}`,
        config: {
          systemInstruction: instructionMap[mode],
        },
      });
      res.json({ text: (response.text || '').trim() });
    } catch (error) {
      console.error('Provider AI assist failed:', error);
      res.status(500).json({ error: 'Unable to generate AI suggestion right now. Please try again.' });
    }
  });

  // M-Pesa Daraja Readiness Endpoint (honest credential gate)
  app.post('/api/payments/mpesa/stk-push', requireAuth, async (req: AuthRequest, res) => {
    const mpesaReady = Boolean(
      process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY &&
      process.env.MPESA_CALLBACK_URL
    );

    if (!mpesaReady) {
      res.status(503).json({
        configured: false,
        error:
          'M-Pesa Daraja API credentials are not configured yet (MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL). Bookings currently support direct outside-platform settlement.',
      });
      return;
    }

    // Placeholder for live Daraja OAuth + STK Push when credentials are supplied
    res.status(501).json({
      configured: true,
      error: 'Daraja live callback handler requires webhook verification setup.',
    });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`ServiceConnect server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start ServiceConnect server:', err);
  process.exit(1);
});
