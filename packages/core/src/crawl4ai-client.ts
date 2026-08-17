import { execSync } from "child_process";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  links: string[];
}

// ─── Search (via Bing HTML, parseable without JS) ───────────

export function searchWeb(query: string, maxResults: number = 5): SearchResult[] {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&count=${Math.max(10, maxResults * 2)}`;
  try {
    const output = execSync(
      `curl -sL --max-time 20 -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36" "${url}"`,
      {
        encoding: "utf-8",
        timeout: 25000,
        maxBuffer: 10 * 1024 * 1024,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    return parseBingHtml(output, maxResults);
  } catch {
    return [];
  }
}

function parseBingHtml(html: string, maxResults: number): SearchResult[] {
  const results: SearchResult[] = [];

  // Bing organic results: <li class="b_algo">... <h2><a href="URL">Title</a></h2> ...
  const algoPattern = /\<li class="b_algo"[^>]*>([\s\S]*?)<\/li>/g;
  const resultBlocks = [...html.matchAll(algoPattern)];

  for (const block of resultBlocks) {
    if (results.length >= maxResults) break;

    const content = block[1];
    const linkMatch = content.match(/\<h2[^>]*>\s*\<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/i);
    if (!linkMatch) continue;

    const url = linkMatch[1];
    const title = stripHtml(linkMatch[2]).trim();

    // Extract snippet: <p>...</p> after the title
    const snippetMatch = content.match(/\<p[^>]*>([\s\S]*?)<\/p>/);
    const snippet = snippetMatch ? stripHtml(snippetMatch[1]).trim() : "";

    // Decode Bing redirect URLs (bing.com/ck/a?...u=a1aHR...)
    const decodedUrl = decodeBingUrl(url);
    if (decodedUrl.startsWith("http")) {
      results.push({ title, url: decodedUrl, snippet });
    }
  }

  // Fallback: if no b_algo blocks, try Google-style <a href> extraction
  if (results.length === 0) {
    const fallbackLinks = [...html.matchAll(/href="(https?:\/\/[^"]+)"/g)];
    for (const m of fallbackLinks) {
      const url = m[1];
      if (/bing\.com|microsoft\.com|bing\.net/.test(url)) continue;
      if (results.length >= maxResults) break;
      results.push({ title: "", url: decodeBingUrl(url), snippet: "" });
    }
  }

  return results;
}

function decodeBingUrl(url: string): string {
  // Bing gives redirect URLs like:
  //   https://www.bing.com/ck/a?...&amp;u=a1aHR0cHM6Ly9lbi53aWtpcGVkaWEub3Jn...
  // The u= param is URL-safe base64 (a1 prefix) of the real URL.
  // The query string may have HTML-escaped &amp; (unlikely in a raw href, but handled).
  // Decode &amp; first, then operate on the plain query string.
  const plain = url.replace(/&amp;/g, "&");

  const uMatch = plain.match(/[?&]u=a1([A-Za-z0-9+/=_-]+)/);
  if (uMatch) {
    try {
      const b64 = uMatch[1].replace(/-/g, "+").replace(/_/g, "/");
      // Pad to multiple of 4
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      const decoded = Buffer.from(padded, "base64").toString("utf-8");
      if (decoded.startsWith("http")) return decoded;
    } catch {
      // fall through
    }
  }
  const directMatch = plain.match(/[?&]url=([^&]+)/);
  if (directMatch) {
    try {
      const decoded = decodeURIComponent(directMatch[1]);
      if (decoded.startsWith("http")) return decoded;
    } catch {
      // fall through
    }
  }
  return url;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

// ─── Crawl ───────────────────────────────────────────────────

export function crawlPage(url: string, maxLength: number = 5000): CrawlResult | null {
  try {
    const cmd = `crwl crawl "${url}" -o markdown-fit`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 45000,
      maxBuffer: 1024 * 1024, // 1MB buffer
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Extract title from first line or markdown heading
    const titleMatch = output.match(/^#\s+(.+)/m) || output.match(/^(.+)\n/);
    const title = titleMatch ? titleMatch[1].trim() : "Untitled";

    // Extract links
    const links: string[] = [];
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
    let match;
    while ((match = linkRegex.exec(output)) !== null) {
      links.push(match[2]);
    }

    return {
      url,
      title,
      content: output.slice(0, maxLength),
      links,
    };
  } catch {
    return null;
  }
}

// ─── Multi-Source Crawl ──────────────────────────────────────

export function crawlMultiple(
  urls: string[],
  maxLengthPer: number = 3000
): CrawlResult[] {
  const results: CrawlResult[] = [];
  for (const url of urls) {
    const result = crawlPage(url, maxLengthPer);
    if (result) {
      results.push(result);
    }
  }
  return results;
}

// ─── Search and Crawl (combined) ─────────────────────────────

export function searchAndCrawl(
  query: string,
  maxResults: number = 3
): { searchResults: SearchResult[]; crawledPages: CrawlResult[] } {
  const searchResults = searchWeb(query, maxResults);
  const urls = searchResults.map((r) => r.url).filter(Boolean);
  const crawledPages = crawlMultiple(urls, 3000);
  return { searchResults, crawledPages };
}
