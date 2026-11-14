import express, { Request, Response } from "express";
import fs from "fs";
import path from "path";
import { chromium, Browser } from "playwright-core";
import { createServer as createViteServer } from "vite";

const CHROMIUM_CANDIDATE_PATHS = [
  process.env.CHROMIUM_PATH,
  "/ms-playwright/chrome-headless-shell-linux64/chrome-headless-shell",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome"
].filter(Boolean) as string[];

function resolveChromiumExecutable(): string | undefined {
  for (const candidate of CHROMIUM_CANDIDATE_PATHS) {
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignore inaccessible path
    }
  }
  return undefined;
}

let sharedBrowserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowserPromise) {
    try {
      const existing = await sharedBrowserPromise;
      if (existing.isConnected()) {
        return existing;
      }
    } catch {
      sharedBrowserPromise = null;
    }
  }

  const executablePath = resolveChromiumExecutable();
  sharedBrowserPromise = chromium.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none"
    ]
  });

  const browser = await sharedBrowserPromise;
  browser.on("disconnected", () => {
    sharedBrowserPromise = null;
  });
  return browser;
}

/**
 * Checks whether a URL targets a private/internal network host or forbidden scheme.
 */
function isUnsafeUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    const protocol = parsed.protocol.toLowerCase();

    if (protocol === "data:" || protocol === "about:" || protocol === "blob:") {
      return false;
    }

    if (protocol !== "https:" && protocol !== "http:") {
      return true;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "[::1]" ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal")
    ) {
      return true;
    }

    const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);
      if (
        a === 10 ||
        a === 127 ||
        (a === 169 && b === 254) ||
        (a === 192 && b === 168) ||
        (a === 172 && b >= 16 && b <= 31)
      ) {
        return true;
      }
    }

    return false;
  } catch {
    return true;
  }
}

export interface PageSettingsPayload {
  pageSize?: "A4" | "A3" | "A5" | "Letter" | "Legal" | "Tabloid" | "Custom";
  orientation?: "portrait" | "landscape";
  customWidth?: number;
  customHeight?: number;
  customUnit?: "mm" | "cm" | "in";
  margins?: {
    top: string;
    right: string;
    bottom: string;
    left: string;
  };
}

const VALID_STANDARD_FORMATS = new Set(["A4", "A3", "A5", "Letter", "Legal", "Tabloid"]);
const VALID_UNITS = new Set(["mm", "cm", "in"]);

function sanitizeMarginValue(val: unknown, fallback = "15mm"): string {
  if (typeof val !== "string") return fallback;
  const trimmed = val.trim();
  if (/^\d+(\.\d+)?(mm|cm|in|px)$/.test(trimmed)) {
    return trimmed;
  }
  return fallback;
}

/**
 * Extracts exact page count from a generated PDF buffer.
 */
function extractPdfPageCount(pdfBuffer: Uint8Array): number {
  try {
    const text = Buffer.from(pdfBuffer).toString("latin1");
    const pagesCountMatch = text.match(/\/Type\s*\/Pages\b[\s\S]{0,160}?\/Count\s+(\d+)/);
    if (pagesCountMatch && pagesCountMatch[1]) {
      const parsed = parseInt(pagesCountMatch[1], 10);
      if (parsed > 0) return parsed;
    }
    const pageMatches = text.match(/\/Type\s*\/Page\b(?!s)/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }
  } catch {
    // Fallback to 1 page if parsing fails
  }
  return 1;
}

/**
 * Combines user HTML and CSS into a complete, print-ready HTML document while stripping script tags.
 */
function buildPrintableHtmlDocument(rawHtml: string, rawCss: string): string {
  const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  const basePrintCss = `
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
    }
    thead {
      display: table-header-group;
    }
    tfoot {
      display: table-footer-group;
    }
    tr, img, pre, blockquote {
      break-inside: avoid;
      page-break-inside: avoid;
    }
    img {
      max-width: 100%;
      height: auto;
    }
  `;

  const combinedStyleBlock = `<style id="pageforge-base-print">${basePrintCss}</style>\n<style id="pageforge-user-css">\n${rawCss || ""}\n</style>`;

  if (/<html[\s>]/i.test(sanitizedHtml)) {
    if (/<\/head>/i.test(sanitizedHtml)) {
      return sanitizedHtml.replace(/<\/head>/i, `${combinedStyleBlock}\n</head>`);
    }
    return sanitizedHtml.replace(
      /<html([^>]*)>/i,
      `<html$1><head><meta charset="UTF-8" />${combinedStyleBlock}</head>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${combinedStyleBlock}
</head>
<body>
${sanitizedHtml}
</body>
</html>`;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "4mb" }));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
      status: "healthy",
      service: "PageForge PDF Rendering Engine",
      timestamp: new Date().toISOString()
    });
  });

  app.post("/api/convert-pdf", async (req: Request, res: Response) => {
    const { html, css, settings } = (req.body ?? {}) as {
      html?: unknown;
      css?: unknown;
      settings?: PageSettingsPayload;
    };

    if (typeof html !== "string" || !html.trim()) {
      res.status(400).json({
        error: "HTML content is required. Please enter valid HTML before converting."
      });
      return;
    }

    const safeCss = typeof css === "string" ? css : "";

    if (html.length > 2_000_000 || safeCss.length > 1_000_000) {
      res.status(413).json({
        error: "Document exceeds maximum supported size (2 MB HTML / 1 MB CSS)."
      });
      return;
    }

    const pageSize = settings?.pageSize || "A4";
    const isLandscape = settings?.orientation === "landscape";
    const customUnit =
      settings?.customUnit && VALID_UNITS.has(settings.customUnit) ? settings.customUnit : "mm";

    let customWidthStr: string | undefined;
    let customHeightStr: string | undefined;

    if (pageSize === "Custom") {
      const w = Number(settings?.customWidth);
      const h = Number(settings?.customHeight);

      const minVal = customUnit === "mm" ? 30 : customUnit === "cm" ? 3 : 1.2;
      const maxVal = customUnit === "mm" ? 1500 : customUnit === "cm" ? 150 : 60;

      if (!Number.isFinite(w) || !Number.isFinite(h) || w < minVal || h < minVal || w > maxVal || h > maxVal) {
        res.status(400).json({
          error: `Invalid custom page dimensions. Please enter values between ${minVal}${customUnit} and ${maxVal}${customUnit}.`
        });
        return;
      }

      customWidthStr = `${w}${customUnit}`;
      customHeightStr = `${h}${customUnit}`;
    } else if (!VALID_STANDARD_FORMATS.has(pageSize)) {
      res.status(400).json({
        error: "Unsupported page size format selected."
      });
      return;
    }

    const marginConfig = {
      top: sanitizeMarginValue(settings?.margins?.top, "15mm"),
      right: sanitizeMarginValue(settings?.margins?.right, "15mm"),
      bottom: sanitizeMarginValue(settings?.margins?.bottom, "15mm"),
      left: sanitizeMarginValue(settings?.margins?.left, "15mm")
    };

    const fullDocument = buildPrintableHtmlDocument(html, safeCss);
    let context = null;

    try {
      const browser = await getBrowser();

      context = await browser.newContext({
        javaScriptEnabled: false,
        viewport: { width: isLandscape ? 1123 : 794, height: isLandscape ? 794 : 1123 },
        deviceScaleFactor: 2
      });

      const page = await context.newPage();

      await page.route("**/*", (route) => {
        const reqUrl = route.request().url();
        if (isUnsafeUrl(reqUrl)) {
          return route.abort("accessdenied");
        }
        return route.continue();
      });

      try {
        await page.setContent(fullDocument, {
          waitUntil: "networkidle",
          timeout: 15000
        });
      } catch {
        await page.setContent(fullDocument, {
          waitUntil: "load",
          timeout: 8000
        });
      }

      await page.emulateMedia({ media: "print" });

      const pdfBuffer = await page.pdf({
        ...(pageSize === "Custom"
          ? { width: customWidthStr, height: customHeightStr }
          : { format: pageSize }),
        landscape: isLandscape,
        printBackground: true,
        preferCSSPageSize: false,
        margin: marginConfig
      });

      if (!pdfBuffer || pdfBuffer.byteLength < 100) {
        throw new Error("Generated PDF buffer was empty.");
      }

      const pageCount = extractPdfPageCount(pdfBuffer);

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
      res.setHeader("Content-Length", String(pdfBuffer.byteLength));
      res.setHeader("X-PDF-Page-Count", String(pageCount));
      res.setHeader("Access-Control-Expose-Headers", "X-PDF-Page-Count");
      res.setHeader("Cache-Control", "no-store");
      res.status(200).end(Buffer.from(pdfBuffer));
    } catch (err) {
      console.error("PDF generation error:", err);
      res.status(500).json({
        error: "Unable to render PDF from the provided HTML and CSS. Please verify external asset URLs and syntax."
      });
    } finally {
      if (context) {
        await context.close().catch(() => {});
      }
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`PageForge PDF server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
