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

// ─── Search ──────────────────────────────────────────────────

export function searchWeb(query: string, maxResults: number = 5): SearchResult[] {
  try {
    const cmd = `crwl search "${query.replace(/"/g, '\\"')}" -n ${maxResults} --json`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Parse JSON output
    const results = JSON.parse(output);
    if (Array.isArray(results)) {
      return results.map((r: Record<string, unknown>) => ({
        title: String(r.title || r.name || ""),
        url: String(r.url || r.link || ""),
        snippet: String(r.snippet || r.description || r.content || "").slice(0, 300),
      }));
    }

    // If not JSON, try line-by-line parsing
    return parseSearchOutput(output);
  } catch {
    // Fallback: try without --json
    return searchWebFallback(query, maxResults);
  }
}

function searchWebFallback(query: string, maxResults: number): SearchResult[] {
  try {
    const cmd = `crwl search "${query.replace(/"/g, '\\"')}" -n ${maxResults}`;
    const output = execSync(cmd, {
      encoding: "utf-8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return parseSearchOutput(output);
  } catch {
    return [];
  }
}

function parseSearchOutput(output: string): SearchResult[] {
  const results: SearchResult[] = [];
  const lines = output.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    // Try to extract URL and title from common formats
    const urlMatch = line.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      results.push({
        title: line.replace(urlMatch[0], "").trim().slice(0, 200) || "Untitled",
        url: urlMatch[0],
        snippet: line.slice(0, 300),
      });
    }
  }

  return results.slice(0, 10);
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
