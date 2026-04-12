/**
 * Én serverless-funktion for alle /api/<slug>-kald (Vercel Hobby-grænse).
 */

import { handleHalbookingSlots } from './lib/routes/halbookingSlots.js';
import { handleHalbookingSkansenLegacy } from './lib/routes/halbookingSkansenLegacy.js';
import { handleHalbookingOpenPadel } from './lib/routes/halbookingOpenPadel.js';
import { handleBookliSlots } from './lib/routes/bookliSlots.js';
import { handleMatchiSlots } from './lib/routes/matchiSlots.js';

export default async function handler(req, res) {
  const slug = typeof req.query?.slug === 'string' ? req.query.slug : '';

  switch (slug) {
    case 'halbooking-slots':
      return handleHalbookingSlots(req, res);
    case 'halbooking-skansen-padel':
      return handleHalbookingSkansenLegacy(req, res);
    case 'halbooking-open-padel':
      return handleHalbookingOpenPadel(req, res);
    case 'bookli-slots':
      return handleBookliSlots(req, res);
    case 'matchi-slots':
      return handleMatchiSlots(req, res);
    default:
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ error: 'Ukendt API-endpoint' }));
  }
}
