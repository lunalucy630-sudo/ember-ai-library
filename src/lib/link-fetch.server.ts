// Server-only helpers that fetch real metadata/content for saved links.
// Nothing here ever invents content: when a fetch fails we return what we have
// and let the caller mark the material as unavailable.

export interface FetchedLink {
  title: string | null;
  description: string | null;
  /** Real extracted text (article body, video description, captions). */
  content: string | null;
  transcript: string | null;
  transcriptAvailable: boolean;
  thumbnailUrl: string | null;
  author: string | null;
  /** True when we managed to retrieve real content from the source. */
  fetched: boolean;
  note: string | null;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

function empty(): FetchedLink {
  return {
    title: null,
    description: null,
    content: null,
    transcript: null,
    transcriptAvailable: false,
    thumbnailUrl: null,
    author: null,
    fetched: false,
    note: null,
  };
}

async function getText(url: string, timeoutMs = 12000): Promise<string | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function metaTag(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+property=["']${name}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+name=["']${name}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeEntities(m[1]).trim();
  }
  return null;
}

export function youtubeId(url: string): string | null {
  const m =
    url.match(/[?&]v=([A-Za-z0-9_-]{6,})/) ??
    url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ??
    url.match(/\/shorts\/([A-Za-z0-9_-]{6,})/) ??
    url.match(/\/embed\/([A-Za-z0-9_-]{6,})/) ??
    url.match(/\/live\/([A-Za-z0-9_-]{6,})/);
  return m?.[1] ?? null;
}

/* ------------------------------ YouTube ---------------------------- */
export async function fetchYouTube(url: string): Promise<FetchedLink> {
  const out = empty();
  const id = youtubeId(url);
  if (!id) {
    out.note = "Could not read a video id from this YouTube URL.";
    return out;
  }
  const canonical = `https://www.youtube.com/watch?v=${id}`;

  // 1. oEmbed — reliable title / author / thumbnail.
  const oembed = await getText(
    `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(canonical)}`,
  );
  if (oembed) {
    try {
      const j = JSON.parse(oembed) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      out.title = j.title ?? null;
      out.author = j.author_name ?? null;
      out.thumbnailUrl = j.thumbnail_url ?? null;
      out.fetched = Boolean(j.title);
    } catch {
      /* ignore */
    }
  }

  // 2. Watch page — real description + caption tracks.
  const html = await getText(canonical);
  if (html) {
    const desc =
      html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/)?.[1] ?? null;
    if (desc) {
      out.description = JSON.parse(`"${desc}"`) as string;
      out.fetched = true;
    }
    const tracksRaw = html.match(/"captionTracks":(\[[\s\S]*?\])/)?.[1];
    if (tracksRaw) {
      try {
        const tracks = JSON.parse(tracksRaw) as Array<{
          baseUrl?: string;
          languageCode?: string;
          kind?: string;
        }>;
        const preferred =
          tracks.find((t) => t.languageCode?.startsWith("en") && !t.kind) ??
          tracks.find((t) => !t.kind) ??
          tracks[0];
        if (preferred?.baseUrl) {
          const capUrl = preferred.baseUrl.replace(/\\u0026/g, "&") + "&fmt=json3";
          const cap = await getText(capUrl);
          if (cap && cap.trim().length > 0) {
            try {
              const j = JSON.parse(cap) as {
                events?: Array<{ tStartMs?: number; segs?: Array<{ utf8?: string }> }>;
              };
              const lines = (j.events ?? [])
                .map((e) => {
                  const text = (e.segs ?? []).map((s) => s.utf8 ?? "").join("").trim();
                  if (!text) return null;
                  const ms = e.tStartMs ?? 0;
                  const mm = String(Math.floor(ms / 60000)).padStart(2, "0");
                  const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, "0");
                  return `[${mm}:${ss}] ${text}`;
                })
                .filter((v): v is string => v !== null);
              if (lines.length > 0) {
                out.transcript = lines.join("\n");
                out.transcriptAvailable = true;
              }
            } catch {
              /* ignore */
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!out.transcriptAvailable) {
    out.note =
      "YouTube did not return captions for this video, so no transcript is available.";
  }
  const bits = [out.description, out.transcript].filter(Boolean);
  out.content = bits.length > 0 ? bits.join("\n\n") : null;
  return out;
}

/* ------------------------------ TikTok ----------------------------- */
export async function fetchTikTok(url: string): Promise<FetchedLink> {
  const out = empty();
  const oembed = await getText(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`);
  if (oembed) {
    try {
      const j = JSON.parse(oembed) as {
        title?: string;
        author_name?: string;
        thumbnail_url?: string;
      };
      if (j.title) {
        // TikTok's "title" is the caption text — treat it as description too.
        out.title = j.title.replace(/#\S+/g, "").trim().slice(0, 160) || j.title.slice(0, 160);
        out.description = j.title;
        out.content = j.title;
        out.fetched = true;
      }
      out.author = j.author_name ?? null;
      out.thumbnailUrl = j.thumbnail_url ?? null;
    } catch {
      /* ignore */
    }
  }
  out.note = out.fetched
    ? "TikTok exposes only the caption and thumbnail — no transcript is available."
    : "TikTok did not return data for this link (it may be private, removed, or rate-limited).";
  return out;
}

/* ---------------------------- Instagram ---------------------------- */
export async function fetchInstagram(url: string): Promise<FetchedLink> {
  const out = empty();
  // Instagram's official oEmbed requires a Facebook app token we don't have.
  // Best effort: public og: tags. Usually login-walled.
  const html = await getText(url);
  if (html) {
    const desc = metaTag(html, "og:description");
    const title = metaTag(html, "og:title");
    const img = metaTag(html, "og:image");
    if (desc && !/Log in|Sign up/i.test(desc)) {
      out.description = desc;
      out.content = desc;
      out.fetched = true;
    }
    if (title && !/Login|Instagram$/i.test(title)) out.title = title;
    out.thumbnailUrl = img;
  }
  if (!out.fetched) {
    out.note =
      "Instagram blocks automated access to Reels, so nothing could be imported. Add a title and description manually and Ember will analyse those.";
  } else {
    out.note = "Only the Instagram caption could be imported — no transcript is available.";
  }
  return out;
}

/* --------------------------- Generic page -------------------------- */
export async function fetchArticle(url: string): Promise<FetchedLink> {
  const out = empty();
  const html = await getText(url);
  if (!html) {
    out.note = "The page could not be fetched (blocked, offline, or not public).";
    return out;
  }
  out.title =
    metaTag(html, "og:title") ??
    decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "") ||
    null;
  out.description = metaTag(html, "og:description") ?? metaTag(html, "description");
  out.thumbnailUrl = metaTag(html, "og:image");
  out.author = metaTag(html, "author");

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const text = decodeEntities(body).replace(/\s+/g, " ").trim();
  if (text.length > 400) {
    out.content = text.slice(0, 60000);
    out.fetched = true;
  } else {
    out.content = out.description;
    out.fetched = Boolean(out.description);
    out.note = "Only limited page metadata could be read from this link.";
  }
  return out;
}

export async function fetchLinkContent(
  url: string,
  source: string,
): Promise<FetchedLink> {
  if (source === "youtube") return fetchYouTube(url);
  if (source === "tiktok") return fetchTikTok(url);
  if (source === "instagram") return fetchInstagram(url);
  return fetchArticle(url);
}
