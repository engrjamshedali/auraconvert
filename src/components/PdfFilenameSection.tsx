import React, { useRef } from "react";
import { FileText, RotateCcw, AlertCircle, Sparkles } from "lucide-react";
import { cn } from "../lib/utils";

interface PdfFilenameSectionProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  onReset: () => void;
  isDefault: boolean;
  finalFilename: string;
  hasInvalidChars?: boolean;
  hasDuplicateExt?: boolean;
  variant?: "settings" | "modal";
  idPrefix?: string;
}

export const PdfFilenameSection: React.FC<PdfFilenameSectionProps> = ({
  value,
  onChange,
  onBlur,
  onReset,
  isDefault,
  finalFilename,
  hasInvalidChars = false,
  hasDuplicateExt = false,
  variant = "settings",
  idPrefix = "pdf-filename"
}) => {
  const inputId = `${idPrefix}-input`;
  const inputRef = useRef<HTMLInputElement>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleBlur = () => {
    if (onBlur) {
      onBlur();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
  };

  const isModal = variant === "modal";

  return (
    <div
      className={cn(
        "rounded-xl transition-all",
        isModal
          ? "p-3.5 bg-neutral-100/70 dark:bg-white/[0.04] border border-neutral-200/80 dark:border-white/10 space-y-2.5"
          : "space-y-1.5"
      )}
    >
      {/* Header with Title and Reset Action */}
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor={inputId}
          className="flex items-center gap-1.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 select-none cursor-pointer"
        >
          <FileText size={14} className="text-[#0066CC] dark:text-[#2997FF] shrink-0" />
          <span>PDF File Name</span>
        </label>

        <button
          type="button"
          onClick={onReset}
          disabled={isDefault}
          className={cn(
            "apple-press text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer",
            isDefault
              ? "text-neutral-400 dark:text-neutral-500 opacity-60 cursor-default"
              : "text-neutral-600 dark:text-neutral-300 hover:text-[#0066CC] dark:hover:text-[#2997FF]"
          )}
          title="Reset to automatically generated default date filename"
          aria-label="Reset to default filename"
        >
          <RotateCcw size={11} className={cn(!isDefault && "hover:-rotate-45 transition-transform")} />
          <span>Reset default</span>
        </button>
      </div>

      {/* Input Field with File Icon and .pdf Badge */}
      <div
        className={cn(
          "relative flex items-center rounded-lg border transition-all",
          "bg-white dark:bg-[#26262B]",
          "border-neutral-200 dark:border-white/15",
          "focus-within:border-[#0066CC] dark:focus-within:border-[#2997FF]",
          "focus-within:ring-2 focus-within:ring-[#0066CC]/20 dark:focus-within:ring-[#2997FF]/20"
        )}
      >
        <div className="pl-3 pr-1 text-neutral-400 dark:text-neutral-500 shrink-0 pointer-events-none select-none">
          <FileText size={14} />
        </div>

        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={value}
          onChange={handleInputChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder="e.g. My-Invoice or htmltopdfbyauranixtech-..."
          autoComplete="off"
          spellCheck={false}
          className="w-full py-2 px-2 bg-transparent text-xs font-mono font-medium text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none"
        />

        <div className="pr-2.5 shrink-0 select-none">
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-tight bg-neutral-100 dark:bg-white/10 text-neutral-600 dark:text-neutral-300 border border-neutral-200/60 dark:border-white/5">
            .pdf
          </span>
        </div>
      </div>

      {/* Live Filename Preview Pill */}
      <div className="flex items-center justify-between gap-2 px-1 text-[11px]">
        <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 dark:text-neutral-500 shrink-0">
          Preview
        </span>
        <div
          className="flex items-center gap-1.5 min-w-0 max-w-[85%] font-mono text-[11px] font-medium text-neutral-700 dark:text-neutral-200 truncate bg-neutral-100/80 dark:bg-white/[0.06] px-2 py-0.5 rounded-md border border-neutral-200/60 dark:border-white/5"
          title={`Final file name: ${finalFilename}`}
        >
          {isDefault && (
            <Sparkles size={11} className="text-[#0066CC] dark:text-[#2997FF] shrink-0" />
          )}
          <span className="truncate">{finalFilename}</span>
        </div>
      </div>

      {/* Smart Validation Feedback */}
      {hasInvalidChars && (
        <div className="flex items-start gap-1.5 px-1 pt-0.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span className="leading-tight">
            Invalid characters (<code className="font-mono">&lt; &gt; : &quot; / \ | ? *</code>) are automatically removed.
          </span>
        </div>
      )}

      {hasDuplicateExt && (
        <div className="flex items-start gap-1.5 px-1 pt-0.5 text-[11px] text-blue-600 dark:text-blue-400">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          <span className="leading-tight">
            Redundant <code className="font-mono">.pdf</code> extension removed automatically.
          </span>
        </div>
      )}
    </div>
  );
};

