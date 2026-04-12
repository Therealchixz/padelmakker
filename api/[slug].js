/**
 * Én serverless-funktion for alle /api/<slug>-kald (Vercel Hobby-grænse).
 * Hjælpekode ligger i ../padelmakker-server/ — ikke under api/, ellers tæller Vercel hver .js som egen funktion.
 */

import { handleHalbookingSlots } from '../padelmakker-server/routes/halbookingSlots.js';
import { handleHalbookingSkansenLegacy } from '../padelmakker-server/routes/halbookingSkansenLegacy.js';
import { handleHalbookingOpenPadel } from '../padelmakker-server/routes/halbookingOpenPadel.js';
import { handleBookliSlots } from '../padelmakker-server/routes/bookliSlots.js';
import { handleMatchiSlots } from '../padelmakker-server/routes/matchiSlots.js';

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
