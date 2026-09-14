// Vercel serverless function (plain Node runtime, not Next.js — this
// is a standalone /api route on top of a Vite static site, so `req`
// arrives as the raw incoming request stream with no framework body
// parsing in front of it).
//
// Stores an uploaded memory-hook image in Vercel Blob and returns its
// public URL. Requires Blob storage enabled on the Vercel project
// (Dashboard → Storage → Create a Blob store, then link it to this
// project) — that auto-provisions the BLOB_READ_WRITE_TOKEN env var
// this function reads implicitly via @vercel/blob. Can't be exercised
// under plain `npm run dev` (Vite doesn't serve /api routes) — test
// via `vercel dev` or a real deploy.
import { put } from '@vercel/blob';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const rawName = (req.headers['x-filename'] || `hook-${Date.now()}`).toString();
    const filename = decodeURIComponent(rawName);
    const blob = await put(filename, req, {
      access: 'public',
      addRandomSuffix: true,
      contentType: req.headers['content-type'] || 'application/octet-stream'
    });
    res.status(200).json({ url: blob.url });
  } catch (err) {
    res.status(500).json({ error: err && err.message ? err.message : 'Upload failed' });
  }
}
