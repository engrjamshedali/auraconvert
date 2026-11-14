import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Editor from "@monaco-editor/react";
import {
  FileCode,
  FileText,
  Download,
  Trash2,
  RotateCcw,
  Sun,
  Moon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Paintbrush,
  Settings2,
  ChevronDown,
  X,
  Check,
  Columns,
  Rows,
  Copy,
  Scissors,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize2,
  MoreVertical,
  SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "./lib/utils";
import {
  getDefaultPdfFilename,
  formatFinalPdfFilename,
  validatePdfFilename,
  sanitizePdfStem
} from "./lib/filename";
import { PdfFilenameSection } from "./components/PdfFilenameSection";

type EditorLayoutMode = "split-vertical" | "split-horizontal" | "html-only" | "css-only";
type MobileWorkspaceTab = "html" | "css" | "preview";
type ZoomMode = "fit" | number;

// --- Types ---
type PageSizeOption = "A4" | "A3" | "A5" | "Letter" | "Legal" | "Tabloid" | "Custom";
type OrientationOption = "portrait" | "landscape";
type DimensionUnit = "mm" | "cm" | "in";
type MarginPreset = "default" | "narrow" | "normal" | "wide" | "custom";

interface CustomMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface PageSettings {
  pageSize: PageSizeOption;
  orientation: OrientationOption;
  customWidth: number;
  customHeight: number;
  customUnit: DimensionUnit;
  marginPreset: MarginPreset;
  customMargins: CustomMargins; // in mm
}

interface GeneratedPdfMetadata {
  blobUrl: string;
  filename: string;
  pageSizeLabel: string;
  orientationLabel: string;
  pageCount: number;
  byteSize: number;
}

// Standard dimensions in millimeters (Portrait baseline)
const STANDARD_PAGE_SIZES_MM: Record<
  Exclude<PageSizeOption, "Custom">,
  { widthMm: number; heightMm: number; label: string; dimensionsText: string }
> = {
  A4: { widthMm: 210, heightMm: 297, label: "A4 (Default)", dimensionsText: "210 × 297 mm" },
  A3: { widthMm: 297, heightMm: 420, label: "A3", dimensionsText: "297 × 420 mm" },
  A5: { widthMm: 148, heightMm: 210, label: "A5", dimensionsText: "148 × 210 mm" },
  Letter: { widthMm: 215.9, heightMm: 279.4, label: "Letter", dimensionsText: "8.5 × 11 in" },
  Legal: { widthMm: 215.9, heightMm: 355.6, label: "Legal", dimensionsText: "8.5 × 14 in" },
  Tabloid: { widthMm: 279.4, heightMm: 431.8, label: "Tabloid", dimensionsText: "11 × 17 in" }
};

const MARGIN_PRESETS_MM: Record<Exclude<MarginPreset, "custom">, { mm: number; label: string }> = {
  default: { mm: 15, label: "Default (15 mm)" },
  narrow: { mm: 8, label: "Narrow (8 mm)" },
  normal: { mm: 20, label: "Normal (20 mm)" },
  wide: { mm: 30, label: "Wide (30 mm)" }
};

const MM_PER_PX_AT_96DPI = 25.4 / 96; // 1px = 0.264583mm

function convertToMm(value: number, unit: DimensionUnit): number {
  if (unit === "cm") return value * 10;
  if (unit === "in") return value * 25.4;
  return value;
}

// Re-export for compatibility
const getDynamicDefaultFilename = getDefaultPdfFilename;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

const DEFAULT_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Quarterly Architecture Report</title>
</head>
<body>
  <div class="document">
    <header class="doc-header">
      <div>
        <div class="eyebrow">AuraConvert · Technical Specification</div>
        <h1>Cloud Infrastructure &amp; Print Rendering</h1>
      </div>
      <div class="meta">
        <div>Ref: AC-2026-04</div>
        <div>Date: November 14, 2026</div>
      </div>
    </header>

    <section class="summary">
      <p>
        This document demonstrates vector-accurate PDF generation from standard HTML and CSS.
        All typography remains selectable, print media rules are respected, and tables align
        with tabular precision across pages.
      </p>
    </section>

    <section class="metrics">
      <div class="metric-box">
        <span class="metric-label">Output Engine</span>
        <strong class="metric-value">Vector PDF</strong>
      </div>
      <div class="metric-box">
        <span class="metric-label">Page Geometry</span>
        <strong class="metric-value">Dynamic Size</strong>
      </div>
      <div class="metric-box">
        <span class="metric-label">Print CSS</span>
        <strong class="metric-value">@page / @media</strong>
      </div>
    </section>

    <h2>System Component Breakdown</h2>
    <table>
      <thead>
        <tr>
          <th>Subsystem</th>
          <th>Specification</th>
          <th>Status</th>
          <th class="num">Latency</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>HTML5 Parser &amp; Sanitizer</td>
          <td>Isolated Context (No Untrusted JS)</td>
          <td>Verified</td>
          <td class="num">1.8 ms</td>
        </tr>
        <tr>
          <td>CSS Cascade &amp; Print Media</td>
          <td>Full @page &amp; break-inside Support</td>
          <td>Verified</td>
          <td class="num">4.2 ms</td>
        </tr>
        <tr>
          <td>Font &amp; Asset Rasterizer</td>
          <td>300 DPI Vector + Embedded Subsets</td>
          <td>Verified</td>
          <td class="num">18.5 ms</td>
        </tr>
        <tr>
          <td>Multi-Page Pagination</td>
          <td>Automatic Table Header Repetition</td>
          <td>Verified</td>
          <td class="num">6.1 ms</td>
        </tr>
      </tbody>
    </table>

    <footer class="doc-footer">
      <span>Generated with AuraConvert</span>
      <span>Vector Print Engine</span>
    </footer>
  </div>
</body>
</html>`;

const DEFAULT_CSS = `@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --ink: #111827;
  --muted: #4b5563;
  --border: #e5e7eb;
  --surface: #f9fafb;
  --accent: #0066cc;
}

body {
  font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  color: var(--ink);
  background: #ffffff;
  line-height: 1.6;
  font-size: 14px;
}

.document {
  width: 100%;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  border-bottom: 2px solid var(--ink);
  padding-bottom: 16px;
  margin-bottom: 24px;
}

.eyebrow {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--accent);
  margin-bottom: 4px;
}

h1 {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0;
  color: var(--ink);
}

.meta {
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--muted);
}

.summary p {
  font-size: 14px;
  color: var(--muted);
  margin: 0 0 24px 0;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 28px;
}

.metric-box {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 14px 16px;
}

.metric-label {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 4px;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}

h2 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--ink);
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 32px;
  font-size: 13px;
}

th, td {
  text-align: left;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

th {
  background: var(--surface);
  font-weight: 600;
  color: var(--ink);
  border-top: 1px solid var(--border);
}

.num {
  text-align: right;
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
}

.doc-footer {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 40px;
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--muted);
}`;

const DEFAULT_PAGE_SETTINGS: PageSettings = {
  pageSize: "A4",
  orientation: "portrait",
  customWidth: 210,
  customHeight: 297,
  customUnit: "mm",
  marginPreset: "default",
  customMargins: { top: 15, bottom: 15, left: 15, right: 15 }
};

/**
 * Builds the HTML document for the sandboxed live preview iframe using the exact margins.
 */
function buildPreviewDocument(
  rawHtml: string,
  rawCss: string,
  marginsMm: { top: number; right: number; bottom: number; left: number }
): string {
  const sanitizedHtml = rawHtml.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  const basePreviewCss = `
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    body {
      padding: ${marginsMm.top}mm ${marginsMm.right}mm ${marginsMm.bottom}mm ${marginsMm.left}mm !important;
    }
    thead {
      display: table-header-group;
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

  const combinedStyles = `<style id="auraconvert-preview-base">${basePreviewCss}</style>\n<style id="auraconvert-preview-user-css">\n${rawCss || ""}\n</style>`;

  if (/<html[\s>]/i.test(sanitizedHtml)) {
    if (/<\/head>/i.test(sanitizedHtml)) {
      return sanitizedHtml.replace(/<\/head>/i, `${combinedStyles}\n</head>`);
    }
    return sanitizedHtml.replace(
      /<html([^>]*)>/i,
      `<html$1><head><meta charset="UTF-8" />${combinedStyles}</head>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  ${combinedStyles}
</head>
<body>
${sanitizedHtml}
</body>
</html>`;
}

/**
 * Validates that the generated PDF blob and binary is non-empty, contains valid
 * PDF document structure, and contains visible graphical or textual content.
 */
function validatePdfOutput(blob: Blob, buffer: ArrayBuffer): { valid: boolean; reason?: string } {
  if (!blob || blob.size < 1000) {
    return {
      valid: false,
      reason: "Generated PDF is empty or suspiciously small. Please verify HTML and CSS content."
    };
  }
  if (blob.type !== "application/pdf") {
    return {
      valid: false,
      reason: "Generated file has an invalid MIME type."
    };
  }
  const text = new TextDecoder("latin1").decode(buffer.slice(0, Math.min(buffer.byteLength, 15000)));
  if (!text.startsWith("%PDF-")) {
    return {
      valid: false,
      reason: "Generated file does not match the PDF document specification."
    };
  }
  // Verify that the PDF actually has content (XObject/Image or substantial text/drawing stream)
  const fullText = new TextDecoder("latin1").decode(buffer);
  const hasImages = fullText.includes("/Image") || fullText.includes("/XObject");
  const hasTextStream = fullText.includes("BT\n") || fullText.includes("BT\r") || fullText.includes("/Font");
  const hasContentStream = /\/Length\s+([1-9]\d{2,})/.test(fullText);

  if (!hasImages && !hasTextStream && !hasContentStream) {
    return {
      valid: false,
      reason: "Unable to generate PDF because the document content has not finished rendering. Please try again."
    };
  }
  return { valid: true };
}

/**
 * Renders HTML & CSS to PDF directly inside the browser using html2pdf.js.
 * Provides high-reliability fallback if server endpoint is unreachable or lacks Chromium.
 */
async function generateClientPdf(
  rawHtml: string,
  rawCss: string,
  settings: PageSettings,
  marginsMm: { top: number; right: number; bottom: number; left: number },
  geometry: { widthMm: number; heightMm: number },
  filename?: string
): Promise<{ blob: Blob; pageCount: number; buffer: ArrayBuffer }> {
  // @ts-ignore
  const rawMod = (await import("html2pdf.js")) as any;
  const html2pdf =
    (typeof rawMod === "function" ? rawMod : null) ||
    (typeof rawMod.default === "function" ? rawMod.default : null) ||
    (typeof rawMod.default?.default === "function" ? rawMod.default.default : null) ||
    (typeof rawMod.h?.default === "function" ? rawMod.h.default : null) ||
    (typeof rawMod.h === "function" ? rawMod.h : null) ||
    rawMod;

  if (typeof html2pdf !== "function") {
    throw new Error("PDF generation engine could not be initialized in this browser.");
  }

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
      background: #ffffff;
      color: #111827;
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

  // Calculate printable width: page width minus margins
  const printableWidthMm = Math.max(30, geometry.widthMm - marginsMm.left - marginsMm.right);

  // Hidden wrapper prevents visual clipping and flashing while maintaining positive layout flow dimensions
  const wrapper = document.createElement("div");
  wrapper.id = "auraconvert-hidden-wrapper";
  wrapper.style.position = "fixed";
  wrapper.style.top = "0";
  wrapper.style.left = "0";
  wrapper.style.width = "0";
  wrapper.style.height = "0";
  wrapper.style.overflow = "hidden";
  wrapper.style.zIndex = "-999999";
  wrapper.style.pointerEvents = "none";

  const container = document.createElement("div");
  container.id = "auraconvert-client-render-stage";
  container.style.width = `${printableWidthMm}mm`;
  container.style.background = "#ffffff";
  container.style.color = "#111827";
  container.style.padding = "0";
  container.style.margin = "0";

  const styleTag = `<style id="auraconvert-client-base" data-auraconvert="true">${basePrintCss}</style>\n<style id="auraconvert-client-user" data-auraconvert="true">${rawCss || ""}</style>`;
  container.innerHTML = `${styleTag}\n<div class="auraconvert-content-wrapper">${sanitizedHtml}</div>`;
  wrapper.appendChild(container);
  document.body.appendChild(wrapper);

  try {
    // 1. Wait for document fonts to finish loading
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        // Continue even if an external font failed
      }
    }

    // 2. Wait for all images in the document to load
    const images = Array.from(container.querySelectorAll("img"));
    if (images.length > 0) {
      await Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
                setTimeout(resolve, 4000);
              }
            })
        )
      );
    }

    // 3. Ensure rendering container has non-zero dimensions
    await new Promise((r) => requestAnimationFrame(() => setTimeout(r, 60)));

    if (container.offsetWidth <= 0 || container.scrollHeight <= 0) {
      throw new Error("Unable to generate PDF because the document content has not finished rendering. Please try again.");
    }

    const isCustom = settings.pageSize === "Custom";
    const jsPdfFormat = isCustom
      ? [geometry.widthMm, geometry.heightMm]
      : settings.pageSize.toLowerCase();

    // Standard CSS margin order: [top, right, bottom, left]
    const opt = {
      margin: [
        marginsMm.top,
        marginsMm.right,
        marginsMm.bottom,
        marginsMm.left
      ],
      filename: formatFinalPdfFilename(filename),
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        letterRendering: true,
        onclone: (clonedDoc: Document) => {
          // Remove application stylesheets that might contain Tailwind v4 modern oklab/oklch rules
          // while preserving all user and document styles
          const stylesheets = clonedDoc.querySelectorAll("link[rel='stylesheet'], style");
          stylesheets.forEach((el) => {
            if (
              el.id !== "auraconvert-client-base" &&
              el.id !== "auraconvert-client-user" &&
              !el.getAttribute("data-auraconvert") &&
              !container.contains(el)
            ) {
              el.remove();
            }
          });
        }
      },
      jsPDF: {
        unit: "mm",
        format: jsPdfFormat,
        orientation: settings.orientation
      },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] }
    };

    const worker = (html2pdf as any)().set(opt).from(container);
    const pdfDoc = await worker.toPdf().get("pdf");
    const count = pdfDoc?.internal?.getNumberOfPages ? pdfDoc.internal.getNumberOfPages() : 1;
    const arrayBuffer: ArrayBuffer = await worker.output("arraybuffer");
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });

    return { blob, pageCount: count || 1, buffer: arrayBuffer };
  } finally {
    if (document.body.contains(wrapper)) {
      document.body.removeChild(wrapper);
    }
  }
}

export default function App() {
  const [html, setHtml] = useState<string>(DEFAULT_HTML);
  const [css, setCss] = useState<string>(DEFAULT_CSS);
  const [pageSettings, setPageSettings] = useState<PageSettings>(DEFAULT_PAGE_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Mobile navigation drawer / menu state
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Mobile Workspace Active Tab: HTML, CSS, or Live Preview
  const [mobileTab, setMobileTab] = useState<MobileWorkspaceTab>("html");

  // Live Preview Custom Zoom Mode ("fit" or explicit numeric multiplier: 0.5, 0.75, 1, 1.25)
  const [previewZoom, setPreviewZoom] = useState<ZoomMode>("fit");

  // Conversion & Ready Modal State
  const [isConverting, setIsConverting] = useState<boolean>(false);
  const [conversionPhase, setConversionPhase] = useState<"idle" | "preparing" | "rendering" | "validating">("idle");
  const [readyPdf, setReadyPdf] = useState<GeneratedPdfMetadata | null>(null);
  const [isReadyModalOpen, setIsReadyModalOpen] = useState<boolean>(false);
  const [filenameInput, setFilenameInput] = useState<string>(() => getDefaultPdfFilename());
  const [isDownloadingLock, setIsDownloadingLock] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [serverEngineAvailable, setServerEngineAvailable] = useState<boolean>(false);

  // Real-time smart filename validation and sanitized final name
  const filenameValidation = useMemo(() => {
    return validatePdfFilename(filenameInput);
  }, [filenameInput]);

  const handleFilenameChange = useCallback((val: string) => {
    setFilenameInput(val);
  }, []);

  const handleFilenameBlur = useCallback(() => {
    const trimmed = filenameInput.trim();
    if (!trimmed || !sanitizePdfStem(trimmed)) {
      setFilenameInput(getDefaultPdfFilename());
    }
  }, [filenameInput]);

  const handleResetFilename = useCallback(() => {
    setFilenameInput(getDefaultPdfFilename());
  }, []);

  // Probe backend capabilities once on mount
  useEffect(() => {
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.renderer === "server-playwright") {
          setServerEngineAvailable(true);
        } else {
          setServerEngineAvailable(false);
        }
      })
      .catch(() => {
        setServerEngineAvailable(false);
      });
  }, []);

  // Live Preview Sizing & Multi-page Measurement
  const [previewStageWidthPx, setPreviewStageWidthPx] = useState<number>(800);
  const [iframeContentHeightPx, setIframeContentHeightPx] = useState<number>(0);

  // Desktop Split Layout & Resizer State
  const [editorLayoutMode, setEditorLayoutMode] = useState<EditorLayoutMode>("split-horizontal");
  const [workspaceSplitPct, setWorkspaceSplitPct] = useState<number>(50);
  const [editorSplitPct, setEditorSplitPct] = useState<number>(50);
  const [copiedHtml, setCopiedHtml] = useState<boolean>(false);
  const [copiedCss, setCopiedCss] = useState<boolean>(false);

  const workspaceContainerRef = useRef<HTMLElement>(null);
  const editorsContainerRef = useRef<HTMLElement>(null);
  const settingsPopoverRef = useRef<HTMLDivElement>(null);
  const previewStageRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync canonical URL dynamically for SEO
  useEffect(() => {
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical && typeof window !== "undefined") {
      canonical.href = window.location.origin + window.location.pathname;
    }
  }, []);

  // Sync Dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [theme]);

  // Close Page Settings popover & mobile menu on outside click or Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isReadyModalOpen) {
          setIsReadyModalOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (isMobileMenuOpen) {
          setIsMobileMenuOpen(false);
        }
      }
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (
        isSettingsOpen &&
        settingsPopoverRef.current &&
        !settingsPopoverRef.current.contains(e.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isSettingsOpen, isReadyModalOpen, isMobileMenuOpen]);

  // Observe preview stage width for responsive page scaling
  useEffect(() => {
    const el = previewStageRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setPreviewStageWidthPx(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [mobileTab]);

  // Resolve effective margins in mm
  const effectiveMarginsMm = useMemo(() => {
    if (pageSettings.marginPreset === "custom") {
      return {
        top: Math.max(0, Number(pageSettings.customMargins.top) || 0),
        bottom: Math.max(0, Number(pageSettings.customMargins.bottom) || 0),
        left: Math.max(0, Number(pageSettings.customMargins.left) || 0),
        right: Math.max(0, Number(pageSettings.customMargins.right) || 0)
      };
    }
    const presetMm = MARGIN_PRESETS_MM[pageSettings.marginPreset].mm;
    return { top: presetMm, bottom: presetMm, left: presetMm, right: presetMm };
  }, [pageSettings.marginPreset, pageSettings.customMargins]);

  // Validate Custom Dimensions & Margins
  const settingsValidationError = useMemo(() => {
    if (pageSettings.pageSize === "Custom") {
      const w = Number(pageSettings.customWidth);
      const h = Number(pageSettings.customHeight);
      const u = pageSettings.customUnit;
      const min = u === "mm" ? 30 : u === "cm" ? 3 : 1.2;
      const max = u === "mm" ? 1500 : u === "cm" ? 150 : 60;
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < min || h < min || w > max || h > max) {
        return `Custom dimensions must be between ${min} ${u} and ${max} ${u}.`;
      }
    }
    if (pageSettings.marginPreset === "custom") {
      const { top, bottom, left, right } = pageSettings.customMargins;
      if (
        top < 0 ||
        bottom < 0 ||
        left < 0 ||
        right < 0 ||
        top > 80 ||
        bottom > 80 ||
        left > 80 ||
        right > 80
      ) {
        return "Custom margins must be between 0 mm and 80 mm.";
      }
    }
    return null;
  }, [pageSettings]);

  // Compute physical page width & height in mm (accounting for Portrait vs Landscape)
  const pageGeometry = useMemo(() => {
    let baseWidthMm = 210;
    let baseHeightMm = 297;
    let sizeSummaryLabel = "A4 (210 × 297 mm)";

    if (pageSettings.pageSize === "Custom") {
      const w = Math.max(30, convertToMm(Number(pageSettings.customWidth) || 210, pageSettings.customUnit));
      const h = Math.max(30, convertToMm(Number(pageSettings.customHeight) || 297, pageSettings.customUnit));
      baseWidthMm = w;
      baseHeightMm = h;
      sizeSummaryLabel = `Custom (${pageSettings.customWidth} × ${pageSettings.customHeight} ${pageSettings.customUnit})`;
    } else {
      const std = STANDARD_PAGE_SIZES_MM[pageSettings.pageSize];
      baseWidthMm = std.widthMm;
      baseHeightMm = std.heightMm;
      sizeSummaryLabel = `${pageSettings.pageSize} (${std.dimensionsText})`;
    }

    const isLandscape = pageSettings.orientation === "landscape";
    const widthMm = isLandscape ? baseHeightMm : baseWidthMm;
    const heightMm = isLandscape ? baseWidthMm : baseHeightMm;

    const widthPx = Math.round(widthMm / MM_PER_PX_AT_96DPI);
    const heightPx = Math.round(heightMm / MM_PER_PX_AT_96DPI);

    return {
      widthMm: Number(widthMm.toFixed(1)),
      heightMm: Number(heightMm.toFixed(1)),
      widthPx,
      heightPx,
      sizeSummaryLabel,
      shortBadge: `${pageSettings.pageSize} · ${isLandscape ? "Landscape" : "Portrait"}`
    };
  }, [pageSettings]);

  // Helper to revoke existing Blob URL
  const revokeCurrentBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setReadyPdf(null);
    setIsReadyModalOpen(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Debounced preview document string
  const [debouncedDoc, setDebouncedDoc] = useState<string>(() =>
    buildPreviewDocument(DEFAULT_HTML, DEFAULT_CSS, { top: 15, right: 15, bottom: 15, left: 15 })
  );

  useEffect(() => {
    setErrorMsg(null);
    revokeCurrentBlobUrl();

    const timer = setTimeout(() => {
      if (!html.trim()) {
        setDebouncedDoc("");
        setIframeContentHeightPx(0);
      } else {
        setDebouncedDoc(buildPreviewDocument(html, css, effectiveMarginsMm));
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [html, css, effectiveMarginsMm, revokeCurrentBlobUrl]);

  // Measure iframe content height after load to support multi-page preview
  const measureIframeHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!doc || !doc.body) return;
      const scrollH = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight);
      setIframeContentHeightPx(scrollH);
    } catch {
      // Ignore cross-origin if any
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(measureIframeHeight, 260);
    return () => clearTimeout(timer);
  }, [debouncedDoc, pageGeometry.widthPx, pageGeometry.heightPx, measureIframeHeight]);

  // Compute number of preview pages & responsive scale factor
  const previewPagination = useMemo(() => {
    const singlePagePx = Math.max(200, pageGeometry.heightPx);
    const pagesCount =
      iframeContentHeightPx > singlePagePx + 12
        ? Math.ceil(iframeContentHeightPx / singlePagePx)
        : 1;
    const totalSheetHeightPx = pagesCount * singlePagePx;

    // Responsive available width with fluid padding (16px on small mobile, 24px on tablet, 48px on desktop)
    const stagePaddingPx = previewStageWidthPx < 440 ? 16 : previewStageWidthPx < 768 ? 28 : 48;
    const availableWidth = Math.max(120, previewStageWidthPx - stagePaddingPx);
    const fitScale = Math.min(1.2, availableWidth / pageGeometry.widthPx);

    const effectiveScale = previewZoom === "fit" ? fitScale : previewZoom;

    return {
      pagesCount,
      singlePagePx,
      totalSheetHeightPx,
      fitScale,
      scale: effectiveScale
    };
  }, [iframeContentHeightPx, pageGeometry.heightPx, pageGeometry.widthPx, previewStageWidthPx, previewZoom]);

  // Lightweight syntax & security notice
  const validationNotice = useMemo(() => {
    if (settingsValidationError) return settingsValidationError;
    if (!html.trim()) return null;
    if (/<script[\s>]/i.test(html)) {
      return "Security note: <script> tags are disabled in preview and PDF rendering.";
    }
    const openBraces = (css.match(/\{/g) || []).length;
    const closeBraces = (css.match(/\}/g) || []).length;
    if (openBraces !== closeBraces) {
      return `CSS syntax warning: Unbalanced curly braces (${openBraces} opening vs ${closeBraces} closing).`;
    }
    return null;
  }, [html, css, settingsValidationError]);

  // Convert HTML + CSS to PDF: Dual-Engine Strategy (Server-side Vector PDF + High-reliability Client-side Fallback)
  const handleConvertToPdf = useCallback(async () => {
    if (isConverting) return;

    // 1. Pre-Generation Validation
    if (!html.trim()) {
      setErrorMsg("Please enter HTML content before converting to PDF.");
      return;
    }

    if (settingsValidationError) {
      setErrorMsg(settingsValidationError);
      setIsSettingsOpen(true);
      return;
    }

    // Verify preview status & target content
    const iframe = iframeRef.current;
    if (iframe) {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc && doc.body) {
          const text = (doc.body.innerText || "").trim();
          const hasChildren = doc.body.children.length > 0;
          if (!hasChildren && !text) {
            setErrorMsg("Unable to generate PDF because the document content has not finished rendering. Please try again.");
            return;
          }
        }
      } catch {
        // Ignore cross-origin checks
      }
    }

    setErrorMsg(null);
    setIsConverting(true);
    setConversionPhase("preparing");
    setIsSettingsOpen(false);
    setIsMobileMenuOpen(false);
    revokeCurrentBlobUrl();

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    let generatedBlob: Blob | null = null;
    let generatedBuffer: ArrayBuffer | null = null;
    let finalPageCount = previewPagination.pagesCount;

    setConversionPhase("rendering");

    // 2. Attempt High-Fidelity Server-Side Vector PDF Engine if available
    if (serverEngineAvailable) {
      try {
        const response = await fetch("/api/convert-pdf", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            html,
            css,
            filename: filenameValidation.finalFilename,
            settings: {
              pageSize: pageSettings.pageSize,
              orientation: pageSettings.orientation,
              customWidth: Number(pageSettings.customWidth),
              customHeight: Number(pageSettings.customHeight),
              customUnit: pageSettings.customUnit,
              margins: {
                top: `${effectiveMarginsMm.top}mm`,
                right: `${effectiveMarginsMm.right}mm`,
                bottom: `${effectiveMarginsMm.bottom}mm`,
                left: `${effectiveMarginsMm.left}mm`
              }
            }
          }),
          signal: controller.signal
        });

        if (response.ok) {
          const headerPageCount = parseInt(response.headers.get("X-PDF-Page-Count") || "", 10);
          const arrayBuffer = await response.arrayBuffer();
          if (arrayBuffer && arrayBuffer.byteLength >= 1000) {
            const tempBlob = new Blob([arrayBuffer], { type: "application/pdf" });
            const validation = validatePdfOutput(tempBlob, arrayBuffer);
            if (validation.valid) {
              generatedBlob = tempBlob;
              generatedBuffer = arrayBuffer;
              if (Number.isFinite(headerPageCount) && headerPageCount > 0) {
                finalPageCount = headerPageCount;
              }
            }
          }
        }
      } catch (serverErr: unknown) {
        if (serverErr instanceof DOMException && serverErr.name === "AbortError") {
          setIsConverting(false);
          setConversionPhase("idle");
          return;
        }
      }
    }

    // 3. High-Reliability Client-Side Fallback Engine (runs if server is unavailable or returns invalid)
    if (!generatedBlob || !generatedBuffer) {
      try {
        const clientResult = await generateClientPdf(
          html,
          css,
          pageSettings,
          effectiveMarginsMm,
          pageGeometry,
          filenameValidation.finalFilename
        );
        generatedBlob = clientResult.blob;
        generatedBuffer = clientResult.buffer;
        finalPageCount = clientResult.pageCount;
      } catch (clientErr: unknown) {
        if (clientErr instanceof DOMException && clientErr.name === "AbortError") {
          setIsConverting(false);
          setConversionPhase("idle");
          return;
        }
        const message =
          clientErr instanceof Error
            ? clientErr.message
            : "Unable to render PDF from the provided HTML and CSS. Please verify syntax and external assets.";
        setErrorMsg(message);
        setIsConverting(false);
        setConversionPhase("idle");
        return;
      }
    }

    // 4. Output PDF Validation
    setConversionPhase("validating");
    if (!generatedBlob || !generatedBuffer) {
      setErrorMsg("Unable to generate PDF because the document content has not finished rendering. Please try again.");
      setIsConverting(false);
      setConversionPhase("idle");
      return;
    }

    const outputCheck = validatePdfOutput(generatedBlob, generatedBuffer);
    if (!outputCheck.valid) {
      setErrorMsg(outputCheck.reason || "Unable to generate PDF because the document content has not finished rendering. Please try again.");
      setIsConverting(false);
      setConversionPhase("idle");
      return;
    }

    const newBlobUrl = URL.createObjectURL(generatedBlob);
    blobUrlRef.current = newBlobUrl;

    const currentConversionFilename = filenameValidation.isDefault
      ? getDefaultPdfFilename()
      : filenameValidation.finalFilename;

    if (filenameValidation.isDefault) {
      setFilenameInput(currentConversionFilename);
    }

    setReadyPdf({
      blobUrl: newBlobUrl,
      filename: currentConversionFilename,
      pageSizeLabel: pageGeometry.sizeSummaryLabel,
      orientationLabel: pageSettings.orientation === "landscape" ? "Landscape" : "Portrait",
      pageCount: finalPageCount,
      byteSize: generatedBlob.size
    });
    setIsReadyModalOpen(true);
    setIsConverting(false);
    setConversionPhase("idle");
  }, [
    html,
    css,
    isConverting,
    settingsValidationError,
    pageSettings,
    effectiveMarginsMm,
    pageGeometry,
    previewPagination.pagesCount,
    serverEngineAvailable,
    revokeCurrentBlobUrl,
    filenameValidation
  ]);

  // Download the generated PDF without regenerating
  const handleDownloadReadyPdf = useCallback(() => {
    if (!readyPdf || isDownloadingLock) return;
    setIsDownloadingLock(true);

    try {
      const finalFilename =
        formatFinalPdfFilename(filenameInput) ||
        readyPdf.filename ||
        getDefaultPdfFilename();

      const link = document.createElement("a");
      link.href = readyPdf.blobUrl;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setErrorMsg("Unable to start file download. Please check your browser download permissions.");
    } finally {
      setTimeout(() => setIsDownloadingLock(false), 700);
    }
  }, [readyPdf, filenameInput, isDownloadingLock]);

  const handleClear = () => {
    setHtml("");
    setCss("");
    setErrorMsg(null);
    setIsMobileMenuOpen(false);
    revokeCurrentBlobUrl();
  };

  const handleReset = () => {
    setHtml(DEFAULT_HTML);
    setCss(DEFAULT_CSS);
    setPageSettings(DEFAULT_PAGE_SETTINGS);
    setFilenameInput(getDefaultPdfFilename());
    setErrorMsg(null);
    setIsMobileMenuOpen(false);
    revokeCurrentBlobUrl();
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__AURACONVERT__ = {
        setHtml,
        setCss,
        setPageSettings,
        handleConvertToPdf
      };
    }
  }, [handleConvertToPdf]);

  // Detect embedded <style> tags inside HTML so users can split inline HTML+CSS into separate HTML & CSS with 1 click
  const hasEmbeddedStyleTag = useMemo(() => /<style\b[^>]*>[\s\S]*?<\/style>/i.test(html), [html]);

  const handleSplitEmbeddedStyleToCss = useCallback(() => {
    const styleRegex = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
    const extractedRules: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = styleRegex.exec(html)) !== null) {
      if (match[1] && match[1].trim()) {
        extractedRules.push(match[1].trim());
      }
    }
    if (extractedRules.length === 0) return;

    const cleanedHtml = html
      .replace(styleRegex, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    setHtml(cleanedHtml);
    setCss((prevCss) => {
      const joined = extractedRules.join("\n\n");
      return prevCss.trim() ? `${prevCss.trim()}\n\n/* Extracted from HTML */\n${joined}` : joined;
    });
  }, [html]);

  const handleCopyPane = async (type: "html" | "css") => {
    const content = type === "html" ? html : css;
    if (!content) return;
    await navigator.clipboard.writeText(content);
    if (type === "html") {
      setCopiedHtml(true);
      setTimeout(() => setCopiedHtml(false), 1500);
    } else {
      setCopiedCss(true);
      setTimeout(() => setCopiedCss(false), 1500);
    }
  };

  // Drag resizer between Editors and Live Preview (Desktop)
  const startWorkspaceDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const container = workspaceContainerRef.current;
    if (!container) return;

    const onMove = (moveEvent: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const pct = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setWorkspaceSplitPct(Math.min(72, Math.max(28, pct)));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Drag resizer between HTML Editor and CSS Editor
  const startEditorSplitDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const container = editorsContainerRef.current;
    if (!container) return;

    const onMove = (moveEvent: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const pct =
        editorLayoutMode === "split-vertical"
          ? ((moveEvent.clientX - rect.left) / rect.width) * 100
          : ((moveEvent.clientY - rect.top) / rect.height) * 100;
      setEditorSplitPct(Math.min(80, Math.max(20, pct)));
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  // Switch Custom Unit with proportional conversion
  const handleCustomUnitChange = (nextUnit: DimensionUnit) => {
    const prevUnit = pageSettings.customUnit;
    if (prevUnit === nextUnit) return;
    const widthInMm = convertToMm(Number(pageSettings.customWidth) || 210, prevUnit);
    const heightInMm = convertToMm(Number(pageSettings.customHeight) || 297, prevUnit);

    const fromMm = (mmVal: number, target: DimensionUnit) => {
      if (target === "cm") return Number((mmVal / 10).toFixed(1));
      if (target === "in") return Number((mmVal / 25.4).toFixed(2));
      return Math.round(mmVal);
    };

    setPageSettings((prev) => ({
      ...prev,
      customUnit: nextUnit,
      customWidth: fromMm(widthInMm, nextUnit),
      customHeight: fromMm(heightInMm, nextUnit)
    }));
  };

  const htmlLineCount = useMemo(() => (html ? html.split("\n").length : 0), [html]);
  const cssLineCount = useMemo(() => (css ? css.split("\n").length : 0), [css]);

  // Adjust zoom controls
  const handleZoomIn = () => {
    const current = previewPagination.scale;
    const next = Math.min(2.0, Math.round((current + 0.15) * 100) / 100);
    setPreviewZoom(next);
  };

  const handleZoomOut = () => {
    const current = previewPagination.scale;
    const next = Math.max(0.3, Math.round((current - 0.15) * 100) / 100);
    setPreviewZoom(next);
  };

  const handleZoomReset = () => {
    setPreviewZoom("fit");
  };

  return (
    <div className="min-h-screen lg:h-screen lg:overflow-hidden flex flex-col bg-[#F5F5F7] dark:bg-[#0D0D0F] text-[#1D1D1F] dark:text-[#F5F5F7] max-w-[100vw] overflow-x-hidden">
      {/* =========================================================================
          APPLICATION HEADER (Optimized for all viewports from 320px to 1920px+)
          ========================================================================= */}
      <header className="h-14 px-3 sm:px-6 bg-white/95 dark:bg-[#141416]/95 backdrop-blur-md border-b border-neutral-200/80 dark:border-white/10 sticky top-0 z-40 flex items-center justify-between gap-2 safe-area-top">
        {/* Brand Wordmark & Logo */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0066CC] text-white flex items-center justify-center shadow-xs shrink-0">
            <FileText size={17} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm sm:text-base tracking-tight text-[#1D1D1F] dark:text-white whitespace-nowrap truncate">
              AuraConvert
            </span>
          </div>
        </div>

        {/* Center / Right Action Zone */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0" ref={settingsPopoverRef}>
          {/* Page Settings Trigger Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((v) => !v)}
              aria-expanded={isSettingsOpen}
              aria-haspopup="dialog"
              className={cn(
                "apple-press min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 sm:gap-2 whitespace-nowrap cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[#0066CC] outline-none",
                isSettingsOpen
                  ? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
                  : "bg-neutral-100/90 dark:bg-white/[0.06] border-neutral-200/80 dark:border-white/10 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-200/80 dark:hover:bg-white/10"
              )}
              title="Configure PDF Page Size, Orientation and Margins"
            >
              <Settings2 size={14} className="shrink-0" />
              <span className="hidden sm:inline">Page Settings</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-neutral-200/70 dark:bg-white/10 text-neutral-700 dark:text-neutral-300">
                {pageSettings.pageSize}
              </span>
              <ChevronDown
                size={13}
                className={cn("transition-transform duration-150 shrink-0", isSettingsOpen && "rotate-180")}
              />
            </button>

            {/* Responsive Page Settings Sheet / Popover */}
            <AnimatePresence>
              {isSettingsOpen && (
                <>
                  {/* Scrim for Mobile (< 640px) */}
                  <div
                    className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-50"
                    onClick={() => setIsSettingsOpen(false)}
                    aria-hidden="true"
                  />

                  {/* Settings Surface */}
                  <motion.div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Page Settings"
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                    transition={{ duration: 0.16 }}
                    className="fixed sm:absolute inset-x-3 bottom-4 top-auto sm:top-full sm:bottom-auto sm:left-0 sm:right-auto sm:mt-2 max-w-sm sm:w-88 bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-white/15 rounded-2xl sm:rounded-xl shadow-2xl p-4 sm:p-5 z-50 space-y-4 max-h-[82vh] overflow-y-auto"
                  >
                    {/* Header with Title and Close on Mobile */}
                    <div className="flex items-center justify-between pb-2 border-b border-neutral-200/80 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal size={15} className="text-[#0066CC] dark:text-[#2997FF]" />
                        <span className="text-xs font-bold tracking-tight text-neutral-900 dark:text-white">
                          PDF Page Geometry
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSettingsOpen(false)}
                        className="apple-press p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 cursor-pointer"
                        aria-label="Close page settings"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* PDF File Name Section */}
                    <PdfFilenameSection
                      value={filenameInput}
                      onChange={handleFilenameChange}
                      onBlur={handleFilenameBlur}
                      onReset={handleResetFilename}
                      isDefault={filenameValidation.isDefault}
                      finalFilename={filenameValidation.finalFilename}
                      hasInvalidChars={filenameValidation.hasInvalidChars}
                      hasDuplicateExt={filenameValidation.hasDuplicateExt}
                      variant="settings"
                      idPrefix="settings-pdf-filename"
                    />

                    <div className="h-px bg-neutral-200/70 dark:bg-white/10" />

                    {/* Page Size Selector */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="page-size-select"
                        className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                      >
                        Page Format
                      </label>
                      <select
                        id="page-size-select"
                        value={pageSettings.pageSize}
                        onChange={(e) =>
                          setPageSettings((prev) => ({
                            ...prev,
                            pageSize: e.target.value as PageSizeOption
                          }))
                        }
                        className="w-full min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-[#26262B] border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white focus:outline-2 focus:outline-[#0066CC] cursor-pointer"
                      >
                        <option value="A4">A4 (Standard · 210 × 297 mm)</option>
                        <option value="A3">A3 (Large · 297 × 420 mm)</option>
                        <option value="A5">A5 (Compact · 148 × 210 mm)</option>
                        <option value="Letter">Letter (US · 8.5 × 11 in)</option>
                        <option value="Legal">Legal (US · 8.5 × 14 in)</option>
                        <option value="Tabloid">Tabloid (US · 11 × 17 in)</option>
                        <option value="Custom">Custom Dimensions</option>
                      </select>
                    </div>

                    {/* Custom Dimensions (Shown when Custom is selected) */}
                    {pageSettings.pageSize === "Custom" && (
                      <div className="p-3 rounded-lg bg-neutral-50 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/10 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                            Custom Dimensions
                          </span>
                          <select
                            aria-label="Measurement Unit"
                            value={pageSettings.customUnit}
                            onChange={(e) => handleCustomUnitChange(e.target.value as DimensionUnit)}
                            className="px-2.5 py-1 rounded text-xs font-mono font-semibold bg-white dark:bg-[#26262B] border border-neutral-200 dark:border-white/10 text-neutral-800 dark:text-white cursor-pointer min-h-[36px]"
                          >
                            <option value="mm">mm</option>
                            <option value="cm">cm</option>
                            <option value="in">inches</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label
                              htmlFor="custom-width-input"
                              className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1"
                            >
                              Width ({pageSettings.customUnit})
                            </label>
                            <input
                              id="custom-width-input"
                              type="number"
                              step="any"
                              value={pageSettings.customWidth}
                              onChange={(e) =>
                                setPageSettings((prev) => ({
                                  ...prev,
                                  customWidth: parseFloat(e.target.value) || 0
                                }))
                              }
                              className="w-full min-h-[44px] px-2.5 py-2 rounded-md text-xs font-mono tabular-nums bg-white dark:bg-[#26262B] border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="custom-height-input"
                              className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1"
                            >
                              Height ({pageSettings.customUnit})
                            </label>
                            <input
                              id="custom-height-input"
                              type="number"
                              step="any"
                              value={pageSettings.customHeight}
                              onChange={(e) =>
                                setPageSettings((prev) => ({
                                  ...prev,
                                  customHeight: parseFloat(e.target.value) || 0
                                }))
                              }
                              className="w-full min-h-[44px] px-2.5 py-2 rounded-md text-xs font-mono tabular-nums bg-white dark:bg-[#26262B] border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Page Orientation */}
                    <div className="space-y-1.5">
                      <span className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                        Orientation
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 p-1 bg-neutral-100 dark:bg-[#26262B] rounded-lg">
                        {(["portrait", "landscape"] as OrientationOption[]).map((orientation) => (
                          <button
                            key={orientation}
                            type="button"
                            onClick={() =>
                              setPageSettings((prev) => ({ ...prev, orientation }))
                            }
                            className={cn(
                              "apple-press min-h-[40px] py-2 rounded-md text-xs font-semibold capitalize transition-colors cursor-pointer",
                              pageSettings.orientation === orientation
                                ? "bg-white dark:bg-[#383840] text-neutral-900 dark:text-white shadow-xs"
                                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                            )}
                          >
                            {orientation}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Margin Presets */}
                    <div className="space-y-1.5">
                      <label
                        htmlFor="margin-preset-select"
                        className="block text-xs font-semibold text-neutral-800 dark:text-neutral-200"
                      >
                        Margins
                      </label>
                      <select
                        id="margin-preset-select"
                        value={pageSettings.marginPreset}
                        onChange={(e) =>
                          setPageSettings((prev) => ({
                            ...prev,
                            marginPreset: e.target.value as MarginPreset
                          }))
                        }
                        className="w-full min-h-[44px] px-3 py-2 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-[#26262B] border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white focus:outline-2 focus:outline-[#0066CC] cursor-pointer"
                      >
                        <option value="default">Default (15 mm)</option>
                        <option value="narrow">Narrow (8 mm)</option>
                        <option value="normal">Normal (20 mm)</option>
                        <option value="wide">Wide (30 mm)</option>
                        <option value="custom">Custom Margins</option>
                      </select>
                    </div>

                    {/* Custom Margin Inputs */}
                    {pageSettings.marginPreset === "custom" && (
                      <div className="p-3 rounded-lg bg-neutral-50 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/10 space-y-2">
                        <span className="block text-[11px] font-semibold text-neutral-700 dark:text-neutral-300">
                          Custom Margins (mm)
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {(["top", "bottom", "left", "right"] as const).map((side) => (
                            <div key={side}>
                              <label
                                htmlFor={`margin-${side}`}
                                className="block text-[11px] capitalize text-neutral-500 dark:text-neutral-400 mb-0.5"
                              >
                                {side}
                              </label>
                              <input
                                id={`margin-${side}`}
                                type="number"
                                min={0}
                                max={80}
                                value={pageSettings.customMargins[side]}
                                onChange={(e) =>
                                  setPageSettings((prev) => ({
                                    ...prev,
                                    customMargins: {
                                      ...prev.customMargins,
                                      [side]: parseFloat(e.target.value) || 0
                                    }
                                  }))
                                }
                                className="w-full min-h-[40px] px-2.5 py-1.5 rounded-md text-xs font-mono tabular-nums bg-white dark:bg-[#26262B] border border-neutral-200 dark:border-white/10 text-neutral-900 dark:text-white"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {settingsValidationError && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                        {settingsValidationError}
                      </p>
                    )}

                    <button
                      type="button"
                      onClick={() => setIsSettingsOpen(false)}
                      className="w-full min-h-[44px] py-2.5 rounded-lg text-xs font-semibold bg-[#0066CC] hover:bg-[#0055B3] text-white cursor-pointer mt-2"
                    >
                      Apply Geometry
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Desktop-only Quick Actions: Reset & Clear */}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              onClick={handleReset}
              className="apple-press min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.07] flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Reset editors and settings to sample"
            >
              <RotateCcw size={13.5} />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={!html && !css}
              className="apple-press min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              title="Clear HTML and CSS"
            >
              <Trash2 size={13.5} />
              <span>Clear</span>
            </button>
          </div>

          {/* Theme Switcher Button */}
          <button
            type="button"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
            className="apple-press min-h-[38px] min-w-[38px] p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.07] flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0066CC] outline-none"
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          >
            {theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
          </button>

          {/* Mobile Overflow Menu Button (< 768px) */}
          <div className="relative md:hidden">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((v) => !v)}
              className="apple-press min-h-[38px] min-w-[38px] p-2 rounded-lg text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/[0.07] flex items-center justify-center cursor-pointer"
              aria-label="More options"
              aria-expanded={isMobileMenuOpen}
            >
              <MoreVertical size={16} />
            </button>

            {/* Mobile Menu Dropdown */}
            <AnimatePresence>
              {isMobileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsMobileMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -6 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-[#1C1C1F] border border-neutral-200 dark:border-white/15 rounded-xl shadow-xl py-1.5 z-50 text-xs"
                  >
                    <button
                      type="button"
                      onClick={handleReset}
                      className="w-full min-h-[40px] px-3.5 py-2 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-white/10 text-neutral-700 dark:text-neutral-200"
                    >
                      <RotateCcw size={14} />
                      <span>Reset Sample</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleClear}
                      disabled={!html && !css}
                      className="w-full min-h-[40px] px-3.5 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-neutral-700 dark:text-neutral-200 hover:text-rose-600 disabled:opacity-40"
                    >
                      <Trash2 size={14} />
                      <span>Clear Code</span>
                    </button>
                    {hasEmbeddedStyleTag && (
                      <button
                        type="button"
                        onClick={() => {
                          handleSplitEmbeddedStyleToCss();
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full min-h-[40px] px-3.5 py-2 text-left flex items-center gap-2 hover:bg-[#0066CC]/10 text-[#0066CC] dark:text-[#2997FF]"
                      >
                        <Scissors size={14} />
                        <span>Split &lt;style&gt; to CSS</span>
                      </button>
                    )}
                    <div className="border-t border-neutral-100 dark:border-white/10 my-1" />
                    <div className="px-3.5 py-1.5 text-[10px] text-neutral-400">
                      AuraConvert · AuraNix
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Primary Action Button: Convert to PDF */}
          {readyPdf && !isReadyModalOpen && (
            <button
              type="button"
              onClick={() => setIsReadyModalOpen(true)}
              className="apple-press hidden sm:flex min-h-[38px] px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer focus-visible:ring-2 focus-visible:ring-emerald-500 outline-none"
              title="Open generated PDF preview & download dialog"
            >
              <CheckCircle2 size={14} className="shrink-0" />
              <span>PDF Ready</span>
            </button>
          )}

          <button
            type="button"
            data-testid="convert-btn"
            aria-label="Convert to PDF"
            onClick={handleConvertToPdf}
            disabled={isConverting || !html.trim() || Boolean(settingsValidationError)}
            className="apple-press hidden sm:flex min-h-[38px] px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold bg-[#0066CC] hover:bg-[#0055B3] disabled:opacity-50 text-white items-center gap-1.5 sm:gap-2 shadow-xs whitespace-nowrap cursor-pointer focus-visible:ring-2 focus-visible:ring-[#0066CC] outline-none"
          >
            {isConverting ? (
              <>
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span>
                  {conversionPhase === "preparing"
                    ? "Preparing Document…"
                    : conversionPhase === "rendering"
                      ? "Rendering PDF…"
                      : "Validating PDF…"}
                </span>
              </>
            ) : (
              <>
                <FileText size={14} className="shrink-0" />
                <span>Generate PDF</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Validation / Error Banner */}
      {(errorMsg || validationNotice) && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "px-4 sm:px-5 py-2 border-b text-xs flex items-center justify-between gap-3 shrink-0",
            errorMsg
              ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-300"
              : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <AlertCircle size={14} className="shrink-0" />
            <span className="truncate font-medium">{errorMsg || validationNotice}</span>
          </div>
          {errorMsg && (
            <button
              type="button"
              onClick={() => setErrorMsg(null)}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 shrink-0 text-current"
              aria-label="Dismiss message"
            >
              <X size={13} />
            </button>
          )}
        </div>
      )}

      {/* =========================================================================
          MOBILE WORKSPACE TAB SWITCHER (< lg, 320px to 1023px)
          Allows phone and tablet users to cleanly view HTML, CSS, or Live Preview
          without vertical congestion, compressed editors, or horizontal blowout.
          ========================================================================= */}
      <div className="lg:hidden flex items-center justify-between px-2 sm:px-3 py-1.5 bg-[#FAFAFC] dark:bg-[#18181B] border-b border-neutral-200/80 dark:border-white/[0.08] shrink-0">
        <div
          role="tablist"
          aria-label="Workspace View Mode"
          className="flex items-center gap-0.5 sm:gap-1 p-0.5 bg-neutral-200/70 dark:bg-white/[0.08] rounded-xl w-full sm:max-w-sm"
        >
          <button
            role="tab"
            aria-selected={mobileTab === "html"}
            onClick={() => setMobileTab("html")}
            className={cn(
              "apple-press flex-1 min-h-[36px] py-1.5 px-1 sm:px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer",
              mobileTab === "html"
                ? "bg-white dark:bg-[#2A2A30] text-neutral-900 dark:text-white shadow-2xs"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <FileCode size={13} className="text-[#0066CC] dark:text-[#2997FF] shrink-0" />
            <span>HTML</span>
            <span className="hidden sm:inline text-[10px] opacity-60 font-mono font-normal">({htmlLineCount})</span>
          </button>

          <button
            role="tab"
            aria-selected={mobileTab === "css"}
            onClick={() => setMobileTab("css")}
            className={cn(
              "apple-press flex-1 min-h-[36px] py-1.5 px-1 sm:px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer",
              mobileTab === "css"
                ? "bg-white dark:bg-[#2A2A30] text-neutral-900 dark:text-white shadow-2xs"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <Paintbrush size={13} className="text-[#0066CC] dark:text-[#2997FF] shrink-0" />
            <span>CSS</span>
            <span className="hidden sm:inline text-[10px] opacity-60 font-mono font-normal">({cssLineCount})</span>
          </button>

          <button
            role="tab"
            aria-selected={mobileTab === "preview"}
            onClick={() => setMobileTab("preview")}
            className={cn(
              "apple-press flex-1 min-h-[36px] py-1.5 px-1 sm:px-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer",
              mobileTab === "preview"
                ? "bg-white dark:bg-[#2A2A30] text-neutral-900 dark:text-white shadow-2xs"
                : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            )}
          >
            <Eye size={13} className="text-[#0066CC] dark:text-[#2997FF] shrink-0" />
            <span>Preview</span>
            <span className="hidden sm:inline text-[10px] opacity-60 font-mono font-normal">
              ({previewPagination.pagesCount}p)
            </span>
          </button>
        </div>

        {/* Quick Convert Indicator on Mobile when editing code (sm+ only) */}
        {mobileTab !== "preview" && (
          <button
            type="button"
            onClick={() => setMobileTab("preview")}
            className="apple-press hidden sm:flex text-[11px] font-semibold text-[#0066CC] dark:text-[#2997FF] hover:underline items-center gap-1 px-2 py-1 shrink-0"
          >
            <Eye size={13} />
            <span>View Preview</span>
          </button>
        )}
      </div>

      {/* =========================================================================
          MAIN WORKSPACE
          - Desktop (>= 1024px): Side-by-side Split View with Draggable Resizer
          - Mobile / Tablet (< 1024px): Tab-driven Responsive Viewport Container
          ========================================================================= */}
      <main
        ref={workspaceContainerRef}
        className="flex-1 min-h-0 flex flex-col lg:flex-row lg:overflow-hidden relative"
      >
        {/* Left Column: Code Editors (Visible on desktop OR when mobileTab is 'html' or 'css') */}
        <section
          ref={editorsContainerRef}
          aria-label="HTML and CSS Code Editors"
          style={{ width: `${workspaceSplitPct}%` }}
          className={cn(
            "flex flex-col border-b lg:border-b-0 lg:border-r border-neutral-200/80 dark:border-white/10 bg-white dark:bg-[#141416] overflow-hidden shrink-0",
            // Responsive visibility and sizing
            "max-lg:!w-full max-lg:flex-1 max-lg:h-full lg:h-full lg:min-h-0",
            // In mobile mode, hide if user selected 'preview' tab
            mobileTab === "preview" && "max-lg:hidden"
          )}
        >
          {/* Split Editors Desktop Control Bar */}
          <div className="h-9 px-3 bg-[#F4F4F6] dark:bg-[#18181B] border-b border-neutral-200/80 dark:border-white/[0.08] hidden lg:flex items-center justify-between gap-2 shrink-0">
            <div
              role="group"
              aria-label="HTML and CSS Editor Split Layout"
              className="flex items-center gap-1 bg-neutral-200/70 dark:bg-white/[0.07] p-0.5 rounded-lg"
            >
              <button
                type="button"
                onClick={() => setEditorLayoutMode("split-horizontal")}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap",
                  editorLayoutMode === "split-horizontal"
                    ? "bg-white dark:bg-[#2C2C32] text-neutral-900 dark:text-white shadow-2xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
                title="Stack HTML and CSS editors top and bottom"
              >
                <Rows size={12} />
                <span>Stacked</span>
              </button>

              <button
                type="button"
                onClick={() => setEditorLayoutMode("split-vertical")}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap",
                  editorLayoutMode === "split-vertical"
                    ? "bg-white dark:bg-[#2C2C32] text-neutral-900 dark:text-white shadow-2xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
                title="Split HTML and CSS editors side by side"
              >
                <Columns size={12} />
                <span>Side-by-Side</span>
              </button>

              <button
                type="button"
                onClick={() => setEditorLayoutMode("html-only")}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                  editorLayoutMode === "html-only"
                    ? "bg-white dark:bg-[#2C2C32] text-neutral-900 dark:text-white shadow-2xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                HTML Only
              </button>

              <button
                type="button"
                onClick={() => setEditorLayoutMode("css-only")}
                className={cn(
                  "px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap",
                  editorLayoutMode === "css-only"
                    ? "bg-white dark:bg-[#2C2C32] text-neutral-900 dark:text-white shadow-2xs"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                )}
              >
                CSS Only
              </button>
            </div>

            {hasEmbeddedStyleTag && (
              <button
                type="button"
                onClick={handleSplitEmbeddedStyleToCss}
                className="apple-press px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-[#0066CC]/10 dark:bg-[#2997FF]/15 text-[#0066CC] dark:text-[#2997FF] hover:bg-[#0066CC]/20 flex items-center gap-1 whitespace-nowrap cursor-pointer"
                title="Extract <style> tags from HTML into the CSS editor"
              >
                <Scissors size={12} />
                <span>Split &lt;style&gt; to CSS</span>
              </button>
            )}
          </div>

          {/* Editors Split Container */}
          <div
            className={cn(
              "flex-1 flex h-full min-h-0 overflow-hidden",
              // On desktop: respects editorLayoutMode
              "lg:flex",
              editorLayoutMode === "split-vertical" ? "lg:flex-row" : "lg:flex-col",
              // On mobile: strictly shows either HTML pane or CSS pane based on mobileTab
              "max-lg:flex-col"
            )}
          >
            {/* HTML Editor Pane */}
            {(editorLayoutMode !== "css-only" || mobileTab === "html") && (
              <div
                style={
                  editorLayoutMode === "html-only"
                    ? { flex: "1 1 100%" }
                    : { flex: `${editorSplitPct} 1 0%` }
                }
                className={cn(
                  "flex flex-col min-h-0 overflow-hidden",
                  // In mobile tab mode, hide HTML if user selected CSS tab
                  mobileTab === "css" && "max-lg:hidden",
                  "max-lg:!flex-1 max-lg:!h-full"
                )}
              >
                {/* HTML Editor Header */}
                <div className="h-8 px-3.5 bg-[#FAFAFC] dark:bg-[#18181B] border-b border-neutral-200/70 dark:border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    <FileCode size={13.5} className="text-[#0066CC] dark:text-[#2997FF]" />
                    <span>HTML Editor</span>
                    <span className="text-[11px] font-mono font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                      ({htmlLineCount} lines)
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {hasEmbeddedStyleTag && (
                      <button
                        type="button"
                        onClick={handleSplitEmbeddedStyleToCss}
                        className="lg:hidden px-2 py-0.5 rounded text-[11px] font-semibold text-[#0066CC] dark:text-[#2997FF] hover:bg-[#0066CC]/10 flex items-center gap-1 cursor-pointer"
                        title="Extract <style> tags to CSS editor"
                      >
                        <Scissors size={11} />
                        <span>Extract &lt;style&gt;</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleCopyPane("html")}
                      disabled={!html}
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/10 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                      title="Copy HTML"
                    >
                      {copiedHtml ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedHtml ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setHtml("")}
                      disabled={!html}
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 cursor-pointer"
                      title="Clear HTML only"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Monaco HTML Editor Component */}
                <div className="flex-1 relative min-h-0 w-full overflow-hidden">
                  <div className="absolute inset-0">
                    <Editor
                      height="100%"
                      width="100%"
                      defaultLanguage="html"
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      value={html}
                      onChange={(val) => setHtml(val || "")}
                      options={{
                        automaticLayout: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineHeight: 20,
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        autoIndent: "full",
                        formatOnPaste: true,
                        fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
                        padding: { top: 8, bottom: 8 }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Draggable Resizer Between HTML and CSS Editors (Desktop only) */}
            {(editorLayoutMode === "split-horizontal" || editorLayoutMode === "split-vertical") && (
              <div
                role="separator"
                aria-label="Resize HTML and CSS editors. Double-click to reset."
                onPointerDown={startEditorSplitDrag}
                onDoubleClick={() => setEditorSplitPct(50)}
                className={cn(
                  "hidden lg:flex bg-neutral-200/90 dark:bg-white/10 hover:bg-[#0066CC] dark:hover:bg-[#2997FF] transition-colors items-center justify-center shrink-0 select-none z-10",
                  editorLayoutMode === "split-vertical"
                    ? "w-1.5 cursor-col-resize"
                    : "h-1.5 cursor-row-resize"
                )}
                title="Drag to resize HTML & CSS split · Double-click to set 50/50"
              />
            )}

            {/* CSS Editor Pane */}
            {(editorLayoutMode !== "html-only" || mobileTab === "css") && (
              <div
                style={
                  editorLayoutMode === "css-only"
                    ? { flex: "1 1 100%" }
                    : { flex: `${100 - editorSplitPct} 1 0%` }
                }
                className={cn(
                  "flex flex-col min-h-0 overflow-hidden",
                  // In mobile tab mode, hide CSS if user selected HTML tab
                  mobileTab === "html" && "max-lg:hidden",
                  "max-lg:!flex-1 max-lg:!h-full"
                )}
              >
                {/* CSS Editor Header */}
                <div className="h-8 px-3.5 bg-[#FAFAFC] dark:bg-[#18181B] border-b border-neutral-200/70 dark:border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                    <Paintbrush size={13.5} className="text-[#0066CC] dark:text-[#2997FF]" />
                    <span>CSS Editor</span>
                    <span className="text-[11px] font-mono font-normal tabular-nums text-neutral-400 dark:text-neutral-500">
                      ({cssLineCount} lines)
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCopyPane("css")}
                      disabled={!css}
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-200/60 dark:hover:bg-white/10 disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                      title="Copy CSS"
                    >
                      {copiedCss ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                      <span>{copiedCss ? "Copied" : "Copy"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCss("")}
                      disabled={!css}
                      className="px-2 py-0.5 rounded text-[11px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-500/10 disabled:opacity-40 cursor-pointer"
                      title="Clear CSS only"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Monaco CSS Editor Component */}
                <div className="flex-1 relative min-h-0 w-full overflow-hidden">
                  <div className="absolute inset-0">
                    <Editor
                      height="100%"
                      width="100%"
                      defaultLanguage="css"
                      theme={theme === "dark" ? "vs-dark" : "light"}
                      value={css}
                      onChange={(val) => setCss(val || "")}
                      options={{
                        automaticLayout: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineHeight: 20,
                        wordWrap: "on",
                        scrollBeyondLastLine: false,
                        autoIndent: "full",
                        formatOnPaste: true,
                        fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
                        padding: { top: 8, bottom: 8 }
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Draggable Resizer Between Editors and Live Preview (Desktop only) */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize code editors and preview pane. Double-click to reset."
          onPointerDown={startWorkspaceDrag}
          onDoubleClick={() => setWorkspaceSplitPct(50)}
          className="hidden lg:flex w-1.5 bg-neutral-200/90 dark:bg-white/10 hover:bg-[#0066CC] dark:hover:bg-[#2997FF] transition-colors cursor-col-resize shrink-0 select-none z-20"
          title="Drag to resize Editors & Preview · Double-click to reset"
        />

        {/* Right Column: Live Proportional Document Preview */}
        <section
          aria-label="Live Document Preview"
          style={{ width: `${100 - workspaceSplitPct}%` }}
          className={cn(
            "flex-1 flex flex-col bg-[#E8E8ED] dark:bg-[#09090B] overflow-hidden",
            "max-lg:!w-full max-lg:flex-1 max-lg:h-full lg:h-full lg:min-h-0",
            // In mobile mode, hide if user selected 'html' or 'css' tab
            mobileTab !== "preview" && "max-lg:hidden"
          )}
        >
          {/* Responsive Preview Top Bar */}
          <div className="h-9 px-3 sm:px-4 bg-[#FAFAFC] dark:bg-[#18181B] border-b border-neutral-200/80 dark:border-white/[0.07] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 whitespace-nowrap">
                Live Preview
              </span>
              <span className="text-[11px] font-mono text-neutral-400 dark:text-neutral-500 whitespace-nowrap truncate">
                {pageGeometry.shortBadge} · {previewPagination.pagesCount}{" "}
                {previewPagination.pagesCount === 1 ? "pg" : "pgs"}
              </span>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(true)}
                title="Click to edit filename in Page Settings"
                className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-neutral-500 dark:text-neutral-400 hover:text-[#0066CC] dark:hover:text-[#2997FF] hover:bg-neutral-200/50 dark:hover:bg-white/[0.06] transition-colors truncate max-w-[200px]"
              >
                <FileText size={11} className="shrink-0 text-[#0066CC] dark:text-[#2997FF]" />
                <span className="truncate">{filenameValidation.finalFilename}</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleZoomOut}
                className="apple-press p-1 rounded text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-white/10 cursor-pointer"
                title="Zoom Out"
                aria-label="Zoom Out"
              >
                <ZoomOut size={13} />
              </button>

              <button
                type="button"
                onClick={handleZoomReset}
                className={cn(
                  "px-1.5 py-0.5 rounded text-[11px] font-mono font-medium transition-colors cursor-pointer",
                  previewZoom === "fit"
                    ? "bg-[#0066CC]/10 text-[#0066CC] dark:text-[#2997FF]"
                    : "text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-white/10"
                )}
                title="Fit to Width (Auto-Scale)"
              >
                {previewZoom === "fit"
                  ? "Fit"
                  : `${Math.round(previewPagination.scale * 100)}%`}
              </button>

              <button
                type="button"
                onClick={handleZoomIn}
                className="apple-press p-1 rounded text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-white/10 cursor-pointer"
                title="Zoom In"
                aria-label="Zoom In"
              >
                <ZoomIn size={13} />
              </button>

              {previewZoom !== "fit" && (
                <button
                  type="button"
                  onClick={handleZoomReset}
                  className="apple-press p-1 rounded text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-200/70 dark:hover:bg-white/10 cursor-pointer ml-0.5"
                  title="Reset to Fit Width"
                  aria-label="Reset to Fit Width"
                >
                  <Maximize2 size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Proportional Paper Stage */}
          <div
            ref={previewStageRef}
            className="flex-1 overflow-auto p-3 sm:p-5 lg:p-6 flex justify-center items-start relative max-w-full"
          >
            {debouncedDoc ? (
              <div
                style={{
                  width: `${Math.round(pageGeometry.widthPx * previewPagination.scale)}px`,
                  height: `${Math.round(previewPagination.totalSheetHeightPx * previewPagination.scale)}px`
                }}
                className="relative shrink-0 transition-all duration-150 mx-auto"
              >
                <div
                  style={{
                    width: `${pageGeometry.widthPx}px`,
                    height: `${previewPagination.totalSheetHeightPx}px`,
                    transform: `scale(${previewPagination.scale})`,
                    transformOrigin: "top left"
                  }}
                  className="relative bg-white text-black shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.65)] rounded-[2px] overflow-hidden"
                >
                  <iframe
                    ref={iframeRef}
                    title="AuraConvert Live Document Preview"
                    sandbox="allow-same-origin"
                    srcDoc={debouncedDoc}
                    onLoad={measureIframeHeight}
                    style={{
                      width: `${pageGeometry.widthPx}px`,
                      height: `${previewPagination.totalSheetHeightPx}px`
                    }}
                    className="border-none block bg-white"
                  />

                  {/* Multi-page separation guides when document spans more than 1 page */}
                  {previewPagination.pagesCount > 1 &&
                    Array.from({ length: previewPagination.pagesCount - 1 }).map((_, idx) => {
                      const topPx = (idx + 1) * previewPagination.singlePagePx;
                      return (
                        <div
                          key={idx}
                          aria-hidden="true"
                          style={{ top: `${topPx}px` }}
                          className="absolute left-0 right-0 border-t-2 border-dashed border-[#0066CC]/45 pointer-events-none flex justify-end pr-3"
                        >
                          <span className="-mt-2.5 px-1.5 py-0.5 rounded bg-[#0066CC] text-white font-mono text-[10px] font-semibold shadow-xs">
                            Page {idx + 2}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md min-h-[360px] bg-white dark:bg-[#141416] border border-neutral-200/80 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center p-6 sm:p-8 text-center my-auto">
                <FileCode size={36} className="text-neutral-400 mb-3" />
                <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
                  Document Preview is Empty
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4 max-w-xs">
                  Enter HTML code or restore the default sample template to preview the PDF.
                </p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="apple-press min-h-[40px] px-4 py-2 rounded-lg text-xs font-semibold bg-[#0066CC] text-white cursor-pointer"
                >
                  Restore Sample Document
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* =========================================================================
          PERSISTENT MOBILE ACTION BAR (< lg)
          Provides 1-tap conversion without scrolling all the way back up
          ========================================================================= */}
      <aside aria-label="Quick Action Bar" className="lg:hidden p-2.5 bg-white/95 dark:bg-[#141416]/95 backdrop-blur-md border-t border-neutral-200/80 dark:border-white/10 flex items-center justify-between gap-3 safe-area-bottom shrink-0 z-30">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-200 truncate">
            {pageSettings.pageSize}
          </span>
          <span className="text-[11px] text-neutral-400">·</span>
          <span className="text-[11px] text-neutral-500 dark:text-neutral-400 capitalize truncate">
            {pageSettings.orientation}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {readyPdf && !isReadyModalOpen && (
            <button
              type="button"
              onClick={() => setIsReadyModalOpen(true)}
              className="apple-press min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>PDF Ready</span>
            </button>
          )}

          <button
            type="button"
            data-testid="mobile-convert-btn"
            onClick={handleConvertToPdf}
            disabled={isConverting || !html.trim() || Boolean(settingsValidationError)}
            className="apple-press min-h-[42px] px-5 py-2 rounded-xl text-xs font-semibold bg-[#0066CC] hover:bg-[#0055B3] disabled:opacity-50 text-white flex items-center justify-center gap-2 shadow-xs whitespace-nowrap cursor-pointer"
          >
            {isConverting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>
                  {conversionPhase === "preparing"
                    ? "Preparing Document…"
                    : conversionPhase === "rendering"
                      ? "Rendering PDF…"
                      : "Validating PDF…"}
                </span>
              </>
            ) : (
              <>
                <FileText size={15} />
                <span>Generate PDF</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Minimal Semantic Footer */}
      <footer className="h-8 px-4 sm:px-6 bg-white dark:bg-[#141416] border-t border-neutral-200/80 dark:border-white/10 flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 shrink-0">
        <span className="truncate">
          &copy; {new Date().getFullYear()} AuraConvert ·{" "}
          <a
            href="https://auranix.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#0066CC] dark:hover:text-[#2997FF] underline underline-offset-2 transition-colors"
          >
            AuraNix Technologies
          </a>
        </span>
        <span className="hidden sm:inline">Convert HTML to PDF. Fast, Beautiful, Effortless.</span>
      </footer>

      {/* =========================================================================
          PROFESSIONAL PDF READY POPUP MODAL (Fully Responsive Across All Screens)
          ========================================================================= */}
      <AnimatePresence>
        {isReadyModalOpen && readyPdf && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pdf-ready-heading"
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4"
          >
            {/* Scrim Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsReadyModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Surface */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", bounce: 0, duration: 0.32 }}
              className="relative w-full max-w-md bg-white dark:bg-[#18181C] border border-neutral-200/90 dark:border-white/10 rounded-2xl shadow-2xl p-5 sm:p-7 z-10 max-h-[92vh] overflow-y-auto"
            >
              <button
                type="button"
                onClick={() => setIsReadyModalOpen(false)}
                aria-label="Close modal"
                className="apple-press absolute top-4 right-4 p-2 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 cursor-pointer min-h-[36px] min-w-[36px] flex items-center justify-center"
              >
                <X size={16} />
              </button>

              {/* Animated Checkmark Icon */}
              <div className="w-14 h-14 rounded-full bg-emerald-500/12 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.25, duration: 0.45 }}
                  className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-sm"
                >
                  <Check size={20} strokeWidth={2.75} />
                </motion.div>
              </div>

              {/* Heading & Description */}
              <div className="text-center mb-5">
                <h2
                  id="pdf-ready-heading"
                  className="text-lg font-bold tracking-tight text-neutral-900 dark:text-white mb-1"
                >
                  Your PDF is Ready!
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-xs mx-auto">
                  Your document has been successfully rendered and is ready for instant download.
                </p>
              </div>

              {/* Document Information & Filename Customization */}
              <div className="space-y-3 mb-5">
                {/* Filename Customization Section */}
                <PdfFilenameSection
                  value={filenameInput}
                  onChange={handleFilenameChange}
                  onBlur={handleFilenameBlur}
                  onReset={handleResetFilename}
                  isDefault={filenameValidation.isDefault}
                  finalFilename={filenameValidation.finalFilename}
                  hasInvalidChars={filenameValidation.hasInvalidChars}
                  hasDuplicateExt={filenameValidation.hasDuplicateExt}
                  variant="modal"
                  idPrefix="ready-modal-pdf-filename"
                />

                {/* Document Information Summary Card */}
                <div className="bg-neutral-50 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/10 rounded-xl p-3.5 sm:p-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500 dark:text-neutral-400">Page format</span>
                    <span className="font-mono font-medium text-neutral-900 dark:text-white tabular-nums text-right">
                      {readyPdf.pageSizeLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500 dark:text-neutral-400">Orientation</span>
                    <span className="font-medium text-neutral-900 dark:text-white">
                      {readyPdf.orientationLabel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500 dark:text-neutral-400">Total pages</span>
                    <span className="font-mono font-semibold text-neutral-900 dark:text-white tabular-nums">
                      {readyPdf.pageCount} {readyPdf.pageCount === 1 ? "page" : "pages"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <span className="text-neutral-500 dark:text-neutral-400">PDF size</span>
                    <span className="font-mono font-medium text-neutral-900 dark:text-white tabular-nums">
                      {formatBytes(readyPdf.byteSize)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleDownloadReadyPdf}
                  disabled={isDownloadingLock}
                  className="apple-press w-full sm:flex-1 min-h-[46px] py-2.5 px-4 rounded-xl text-xs font-semibold bg-[#0066CC] hover:bg-[#0055B3] disabled:opacity-60 text-white flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <Download size={15} />
                  <span>{isDownloadingLock ? "Starting Download…" : "Download PDF"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsReadyModalOpen(false)}
                  className="apple-press w-full sm:w-auto min-h-[46px] py-2.5 px-5 rounded-xl text-xs font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-white/10 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
