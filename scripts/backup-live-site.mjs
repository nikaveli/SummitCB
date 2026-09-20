#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const [siteArg, outputArg] = process.argv.slice(2);
if (!siteArg || !outputArg) {
  console.error("Usage: node scripts/backup-live-site.mjs <site-url> <output-directory>");
  process.exit(1);
}

const site = new URL(siteArg);
const outputDirectory = path.resolve(outputArg);
const allowedHosts = new Set([site.hostname, site.hostname.replace(/^www\./, "")]);
const queue = [];
const queued = new Set();
const manifest = [];
const maxUrls = 3000;

function enqueue(value, base = site) {
  if (!value || queue.length + manifest.length >= maxUrls) return;
  const cleaned = String(value).trim().replace(/^['"]|['"]$/g, "");
  if (/^(?:data|mailto|tel|javascript):/i.test(cleaned)) return;
  try {
    const url = new URL(cleaned.replaceAll("\\/", "/"), base);
    if (!/^https?:$/.test(url.protocol) || !allowedHosts.has(url.hostname)) return;
    url.protocol = site.protocol;
    url.hostname = site.hostname;
    url.hash = "";
    const key = url.href;
    if (!queued.has(key)) {
      queued.add(key);
      queue.push(url);
    }
  } catch {
    // Ignore malformed URLs found in legacy markup.
  }
}

function outputPathFor(url, contentType) {
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.html";
  else if (!path.extname(pathname) && contentType.includes("text/html")) pathname += "/index.html";
  else if (!path.extname(pathname) && contentType.includes("json")) pathname += ".json";
  else if (!path.extname(pathname) && contentType.includes("xml")) pathname += ".xml";

  const segments = pathname.split("/").filter(Boolean).map((part) =>
    part.replace(/[<>:"|?*\u0000-\u001F]/g, "_")
  );
  let filePath = path.join(outputDirectory, ...segments);
  if (url.search) {
    const extension = path.extname(filePath);
    const stem = extension ? filePath.slice(0, -extension.length) : filePath;
    const digest = createHash("sha256").update(url.search).digest("hex").slice(0, 10);
    filePath = `${stem}__q-${digest}${extension}`;
  }
  return filePath;
}

function discover(text, base, contentType) {
  const candidates = [];
  const patterns = [
    /(?:href|src|poster)\s*=\s*["']([^"']+)["']/gi,
    /url\(\s*["']?([^"')]+)["']?\s*\)/gi,
    /<loc>\s*([^<]+)\s*<\/loc>/gi,
    /https?:\\?\/\\?\/[^"'\s<>]+/gi,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text))) candidates.push(match[1] || match[0]);
  }
  if (contentType.includes("html")) {
    const srcsets = text.matchAll(/srcset\s*=\s*["']([^"']+)["']/gi);
    for (const match of srcsets) {
      for (const item of match[1].split(",")) candidates.push(item.trim().split(/\s+/)[0]);
    }
  }
  for (const candidate of candidates) enqueue(candidate.replaceAll("&amp;", "&"), base);
}

async function download(url) {
  const startedAt = Date.now();
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": "SummitCustomBuildersBackup/1.0" },
      signal: AbortSignal.timeout(30000),
    });
    const contentType = response.headers.get("content-type") || "application/octet-stream";
    const buffer = Buffer.from(await response.arrayBuffer());
    const destination = outputPathFor(url, contentType);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, buffer);

    manifest.push({
      url: url.href,
      finalUrl: response.url,
      status: response.status,
      contentType,
      bytes: buffer.length,
      file: path.relative(outputDirectory, destination),
      elapsedMs: Date.now() - startedAt,
    });

    if (/text|json|xml|javascript/.test(contentType) && buffer.length < 20_000_000) {
      discover(buffer.toString("utf8"), new URL(response.url), contentType);
    }

    const totalPages = Number(response.headers.get("x-wp-totalpages") || 1);
    if (totalPages > 1 && url.pathname.startsWith("/wp-json/")) {
      for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
        const pageUrl = new URL(url);
        pageUrl.searchParams.set("page", String(pageNumber));
        enqueue(pageUrl.href);
      }
    }
  } catch (error) {
    manifest.push({
      url: url.href,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
    });
  }
}

enqueue(site.href);
for (const seed of [
  "/robots.txt",
  "/sitemap.xml",
  "/wp-sitemap.xml",
  "/wp-json/",
  "/wp-json/wp/v2/pages?per_page=100&_embed=1",
  "/wp-json/wp/v2/posts?per_page=100&_embed=1",
  "/wp-json/wp/v2/media?per_page=100",
  "/wp-json/wp/v2/categories?per_page=100",
  "/wp-json/wp/v2/tags?per_page=100",
]) enqueue(seed);

await mkdir(outputDirectory, { recursive: true });
let cursor = 0;
const workerCount = 8;
await Promise.all(Array.from({ length: workerCount }, async () => {
  while (cursor < queue.length && manifest.length < maxUrls) {
    const url = queue[cursor++];
    await download(url);
    if (manifest.length % 50 === 0) console.log(`Downloaded ${manifest.length} resources...`);
  }
}));

const summary = {
  source: site.href,
  createdAt: new Date().toISOString(),
  resources: manifest.length,
  successful: manifest.filter((item) => item.status >= 200 && item.status < 400).length,
  failed: manifest.filter((item) => item.error || item.status >= 400).length,
  totalBytes: manifest.reduce((sum, item) => sum + (item.bytes || 0), 0),
  items: manifest,
};
await writeFile(path.join(outputDirectory, "backup-manifest.json"), JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, items: undefined }, null, 2));
