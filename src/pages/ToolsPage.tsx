import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FaDownload, FaFileAlt, FaTrash, FaChevronUp, FaChevronDown } from "react-icons/fa";
import { toolDefinitions, type ToolId } from "../data";
import { buildPdfPreview, type PdfPreview } from "../pdfPreview";
import {
  addPageNumbersToPdf,
  bundleResultsAsZip,
  compressPdfFile,
  convertPdfToWord,
  editPdfFile,
  extractTextFromPdf,
  getPdfPageCount,
  imagesToPdf,
  mergePdfFiles,
  pdfToJpeg,
  rotatePdfPages,
  splitPdfFile,
  unlockPdfFile,
  type MergePlanItem,
  type ResultFile,
} from "../pdfTools";

type UploadedFile = { id: string; file: File; pageCount?: number; error?: string };
type DownloadResult = ResultFile & { id: string; url: string };
type MergeComposerPage = { id: string; fileId: string; fileName: string; file: File; pageIndex: number; pageNumber: number; image: string };

function isPdfFile(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
}

function ToolGlyph({ toolId }: { toolId: ToolId }) {
  const props = { viewBox: "0 0 48 48", fill: "none", xmlns: "http://www.w3.org/2000/svg", width: 28, height: 28, "aria-hidden": true as const };
  switch (toolId) {
    case "merge":
      return <svg {...props}><rect x="7" y="11" width="14" height="22" rx="4" stroke="currentColor" strokeWidth="3" /><rect x="27" y="11" width="14" height="22" rx="4" stroke="currentColor" strokeWidth="3" /><path d="M19 24H29" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" /></svg>;
    case "split":
      return <svg {...props}><rect x="9" y="10" width="30" height="28" rx="5" stroke="currentColor" strokeWidth="3" /><path d="M24 14V34" stroke="currentColor" strokeWidth="3" strokeDasharray="4 4" strokeLinecap="round" /></svg>;
    case "extract":
      return <svg {...props}><rect x="10" y="8" width="28" height="32" rx="5" stroke="currentColor" strokeWidth="3" /><path d="M17 18H31M17 24H31M17 30H25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
    case "ocr":
      return <svg {...props}><path d="M8 16H14M34 16H40M8 32H14M34 32H40" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><ellipse cx="24" cy="24" rx="10" ry="7" stroke="currentColor" strokeWidth="3" /><circle cx="24" cy="24" r="3.5" fill="currentColor" /></svg>;
    case "edit":
      return <svg {...props}><path d="M13 33L16 27L30 13L35 18L21 32L13 33Z" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" /><path d="M27 16L32 21" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>;
    case "rotate":
      return <svg {...props}><path d="M38 22C37 15 31 10 24 10C16.268 10 10 16.268 10 24C10 31.732 16.268 38 24 38C29 38 33.5 35.5 36 31.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path d="M34 13L38 22L29 22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "word":
      return <svg {...props}><rect x="8" y="10" width="12" height="28" rx="4" stroke="currentColor" strokeWidth="3" /><path d="M26 14H38M26 22H38M26 30H34" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path d="M11.5 18L14 30L16.5 22L19 30" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "imageToPdf":
      return <svg {...props}><rect x="8" y="11" width="32" height="26" rx="5" stroke="currentColor" strokeWidth="3" /><circle cx="18" cy="20" r="3" fill="currentColor" /><path d="M14 31L22 23L28 28L32 24L40 31" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "pdfToJpg":
      return <svg {...props}><rect x="8" y="10" width="32" height="28" rx="5" stroke="currentColor" strokeWidth="3" /><path d="M8 29L17 21L23 26L29 20L40 29" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="17" cy="20" r="3" fill="currentColor" /></svg>;
    case "compress":
      return <svg {...props}><rect x="11" y="8" width="26" height="32" rx="5" stroke="currentColor" strokeWidth="3" /><path d="M24 16V32M18 26L24 32L30 26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
    case "pageNumbers":
      return <svg {...props}><rect x="10" y="8" width="28" height="32" rx="5" stroke="currentColor" strokeWidth="3" /><path d="M17 18H31M17 25H27" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><path d="M16 35H22M25 35H32" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>;
    case "unlock":
      return <svg {...props}><rect x="10" y="22" width="28" height="18" rx="4" stroke="currentColor" strokeWidth="3" /><path d="M18 22V16A6 6 0 0 1 36 16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="24" cy="31" r="3" fill="currentColor" /></svg>;
    default:
      return null;
  }
}

export default function ToolsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const toolParam = searchParams.get("tool") as ToolId | null;
  const validToolId = toolDefinitions.find((t) => t.id === toolParam)?.id ?? "merge";

  const [activeTool, setActiveTool] = useState<ToolId>(validToolId);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [results, setResults] = useState<DownloadResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [splitSelection, setSplitSelection] = useState("1");
  const [splitEveryPage, setSplitEveryPage] = useState(false);
  const [rotation, setRotation] = useState("90");
  const [removePages, setRemovePages] = useState("");
  const [watermark, setWatermark] = useState("");
  const [enableOcr, setEnableOcr] = useState(false);
  const [pageNumStart, setPageNumStart] = useState("1");
  const [pageNumPosition, setPageNumPosition] = useState<"bottom-center" | "bottom-right" | "bottom-left">("bottom-center");
  const [pageNumSize, setPageNumSize] = useState("12");
  const [jpgQuality, setJpgQuality] = useState("0.92");

  const [previewMap, setPreviewMap] = useState<Record<string, PdfPreview>>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [visualSplitPages, setVisualSplitPages] = useState<number[]>([1]);
  const [mergeComposerPages, setMergeComposerPages] = useState<MergeComposerPage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tool = useMemo(() => toolDefinitions.find((t) => t.id === activeTool) ?? toolDefinitions[0], [activeTool]);

  useEffect(() => {
    setSearchParams({ tool: activeTool }, { replace: true });
  }, [activeTool, setSearchParams]);

  useEffect(() => {
    setFiles([]);
    setError("");
    setStatus(`Selected: ${tool.title}`);
    setResults((curr) => { curr.forEach((r) => URL.revokeObjectURL(r.url)); return []; });
    setPreviewMap({});
    setMergeComposerPages([]);
    setVisualSplitPages([1]);
    setSplitSelection("1");
    setEnableOcr(false);
  }, [tool.title]);

  useEffect(() => () => { results.forEach((r) => URL.revokeObjectURL(r.url)); }, [results]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const pdfFiles = files.filter((f) => isPdfFile(f.file) && !f.error);
      if (!pdfFiles.length) { setPreviewMap({}); setMergeComposerPages([]); return; }
      setPreviewLoading(true);
      try {
        const entries = await Promise.all(pdfFiles.map(async (f) => [f.id, await buildPdfPreview(f.file)] as const));
        if (cancelled) return;
        const map = Object.fromEntries(entries);
        setPreviewMap(map);
        if (activeTool === "split") {
          const first = pdfFiles[0] ? map[pdfFiles[0].id] : null;
          if (first) { setVisualSplitPages([1]); setSplitSelection("1"); }
        }
        if (activeTool === "merge") {
          setMergeComposerPages(pdfFiles.flatMap((f) => {
            const preview = map[f.id];
            if (!preview) return [];
            return preview.thumbnails.map((t, i) => ({
              id: `${f.id}-${t.pageNumber}`,
              fileId: f.id, fileName: f.file.name, file: f.file,
              pageIndex: i, pageNumber: t.pageNumber, image: t.image,
            }));
          }));
        } else {
          setMergeComposerPages([]);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to render preview.");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [files, activeTool]);

  async function addFiles(incoming: File[]) {
    if (!incoming.length) return;
    setError(""); setStatus(`Loading ${incoming.length} file(s)…`);
    const mapped = await Promise.all(incoming.map(async (file, i) => {
      const id = `${file.name}-${file.size}-${i}-${Date.now()}`;
      if (isPdfFile(file)) {
        try { return { id, file, pageCount: await getPdfPageCount(file) }; }
        catch (e) { return { id, file, error: e instanceof Error ? e.message : "Unable to read PDF." }; }
      }
      return { id, file };
    }));
    setFiles((curr) => {
      const next = tool.multi ? [...curr, ...mapped] : mapped.slice(0, 1);
      setStatus(`${next.length} file(s) ready.`);
      return next;
    });
  }

  async function handleFileSelection(e: ChangeEvent<HTMLInputElement>) {
    await addFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  }

  async function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault(); setDragActive(false);
    await addFiles(Array.from(e.dataTransfer.files));
  }

  function removeFile(id: string) { setFiles((curr) => curr.filter((f) => f.id !== id)); }

  function moveFile(id: string, dir: -1 | 1) {
    setFiles((curr) => {
      const idx = curr.findIndex((f) => f.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= curr.length) return curr;
      const clone = [...curr];
      const [f] = clone.splice(idx, 1);
      clone.splice(next, 0, f);
      return clone;
    });
  }

  function moveMergePage(id: string, dir: -1 | 1) {
    setMergeComposerPages((curr) => {
      const idx = curr.findIndex((p) => p.id === id);
      const next = idx + dir;
      if (idx < 0 || next < 0 || next >= curr.length) return curr;
      const clone = [...curr];
      const [p] = clone.splice(idx, 1);
      clone.splice(next, 0, p);
      return clone;
    });
  }

  function toggleSplitPage(pageNumber: number) {
    if (splitEveryPage) return;
    setVisualSplitPages((curr) => {
      const exists = curr.includes(pageNumber);
      const next = exists ? curr.filter((p) => p !== pageNumber) : [...curr, pageNumber];
      const sorted = [...next].sort((a, b) => a - b);
      setSplitSelection(sorted.join(","));
      return sorted;
    });
  }

  async function runTool() {
    setBusy(true); setError("");
    setStatus(activeTool === "ocr" ? "Running OCR — this may take a moment…" : `Running ${tool.title}…`);
    try {
      const output = await executeTool();
      const nextResults = output.map((item, i) => ({ ...item, id: `${item.name}-${i}-${Date.now()}`, url: URL.createObjectURL(item.blob) }));
      setResults((curr) => { curr.forEach((r) => URL.revokeObjectURL(r.url)); return nextResults; });
      setStatus(`Done. ${nextResults.length} file(s) ready to download.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setStatus("Action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadAll() {
    setBusy(true);
    try {
      const zip = await bundleResultsAsZip(results.map(({ name, blob, summary, textPreview }) => ({ name, blob, summary, textPreview })), `${tool.id}-results.zip`);
      const url = URL.createObjectURL(zip.blob);
      triggerDownload(url, zip.name);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create ZIP.");
    } finally {
      setBusy(false);
    }
  }

  async function executeTool(): Promise<ResultFile[]> {
    if (!files.length) throw new Error("Upload a file before running.");
    if (files.some((f) => f.error)) throw new Error("One or more files could not be read. Replace them and try again.");
    if (activeTool === "merge" && files.length < 2) throw new Error("Merge needs at least two PDF files.");
    if (activeTool === "merge" && !mergeComposerPages.length) throw new Error("No merge pages available yet — wait for previews to load.");
    if (activeTool === "imageToPdf" && files.some((f) => isPdfFile(f.file))) throw new Error("Image to PDF only accepts JPG and PNG files.");

    switch (activeTool) {
      case "merge":   return [await mergePdfFiles(files.map((f) => f.file), mergeComposerPages.map((p) => ({ file: p.file, pageIndex: p.pageIndex } as MergePlanItem)))];
      case "split":   return splitPdfFile(files[0].file, splitSelection, splitEveryPage);
      case "extract": return [await extractTextFromPdf(files[0].file, { useOcr: enableOcr })];
      case "ocr":     return [await extractTextFromPdf(files[0].file, { useOcr: true })];
      case "edit":    return [await editPdfFile(files[0].file, { rotation: Number(rotation) || 0, removePages, watermark })];
      case "rotate":  return [await rotatePdfPages(files[0].file, Number(rotation) || 90)];
      case "word":    return [await convertPdfToWord(files[0].file, { useOcr: enableOcr })];
      case "imageToPdf": return [await imagesToPdf(files.map((f) => f.file))];
      case "compress": return [await compressPdfFile(files[0].file)];
      case "pdfToJpg": return pdfToJpeg(files[0].file, Number(jpgQuality) || 0.92);
      case "pageNumbers": return [await addPageNumbersToPdf(files[0].file, {
        startFrom: Math.max(1, Number(pageNumStart) || 1),
        position: pageNumPosition,
        fontSize: Math.max(8, Math.min(24, Number(pageNumSize) || 12)),
      })];
      case "unlock": return [await unlockPdfFile(files[0].file)];
      default: throw new Error("Unsupported tool.");
    }
  }

  const primaryPreviewFile = useMemo(() => files.find((f) => isPdfFile(f.file) && !f.error) ?? null, [files]);
  const primaryPreview = primaryPreviewFile ? previewMap[primaryPreviewFile.id] ?? null : null;

  return (
    <main className="tools-page">
      <div className="tools-layout">
        <aside className="tools-sidebar">
          <div className="tools-sidebar-inner">
            <h2 className="tools-sidebar-title">PDF Tools</h2>
            <nav aria-label="Tool selector">
              {toolDefinitions.map((t) => (
                <button key={t.id} type="button" className={`tool-sidebar-btn ${activeTool === t.id ? "active" : ""}`} onClick={() => setActiveTool(t.id)}>
                  <span className="tool-sidebar-icon"><ToolGlyph toolId={t.id} /></span>
                  <div className="tool-sidebar-text">
                    <strong>{t.title}</strong>
                    <span>{t.category}</span>
                  </div>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        <div className="tools-workspace">
          <div className="workspace-head">
            <div className="workspace-head-icon"><ToolGlyph toolId={activeTool} /></div>
            <div>
              <h1 className="workspace-title">{tool.title}</h1>
              <p className="workspace-subtitle">{tool.description}</p>
            </div>
            <div className="workspace-badges">
              <span className={`ws-badge ws-badge-${tool.multi ? "multi" : "single"}`}>{tool.multi ? "Multi-file" : "Single file"}</span>
              <span className="ws-badge">{tool.category}</span>
            </div>
          </div>

          <section className="ws-step-card">
            <div className="ws-step-label">Step 1 — Upload</div>
            <h2 className="ws-step-title">Add your files</h2>
            <p className="ws-step-hint">{tool.note}</p>
            <label className={`dropzone ${dragActive ? "dragover" : ""}`} onDragOver={(e) => { e.preventDefault(); setDragActive(true); }} onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }} onDrop={handleDrop}>
              <input ref={fileInputRef} type="file" accept={tool.accept} multiple={tool.multi} onChange={handleFileSelection} />
              <div className="dropzone-inner">
                <FaFileAlt className="dropzone-icon" />
                <strong>Drop files here or click to browse</strong>
                <span className="dropzone-accepts">{tool.accept.split(",").join("  •  ")}</span>
              </div>
            </label>
            {status && <p className="ws-status">{status}</p>}
            {error && <p className="ws-error" role="alert">{error}</p>}
            {files.length > 0 && (
              <ul className="file-list">
                {files.map((f) => (
                  <li key={f.id} className={`file-item ${f.error ? "file-item-error" : ""}`}>
                    <FaFileAlt className="file-item-icon" />
                    <div className="file-item-info">
                      <strong>{f.file.name}</strong>
                      <span>{f.error ? f.error : f.pageCount !== undefined ? `${f.pageCount} page${f.pageCount !== 1 ? "s" : ""}` : `${(f.file.size / 1024).toFixed(1)} KB`}</span>
                    </div>
                    <div className="file-item-actions">
                      {tool.multi && (<><button type="button" onClick={() => moveFile(f.id, -1)} title="Move up"><FaChevronUp /></button><button type="button" onClick={() => moveFile(f.id, 1)} title="Move down"><FaChevronDown /></button></>)}
                      <button type="button" className="file-remove-btn" onClick={() => removeFile(f.id)} title="Remove"><FaTrash /></button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ws-step-card">
            <div className="ws-step-label">Step 2 — Configure</div>
            <h2 className="ws-step-title">Set options</h2>

            {activeTool === "split" && (
              <div className="options-grid">
                <label className="option-row"><input type="checkbox" checked={splitEveryPage} onChange={(e) => setSplitEveryPage(e.target.checked)} /><span>Split every page into a separate file</span></label>
                {!splitEveryPage && (<label className="form-field"><span>Page ranges (e.g. 1-3,5,8)</span><input value={splitSelection} onChange={(e) => setSplitSelection(e.target.value)} placeholder="1-3,5,8" /></label>)}
                {primaryPreview && (<div className="split-visual"><p className="option-hint">Click pages to include in selection:</p><div className="split-thumbs">{primaryPreview.thumbnails.map((t) => (<button key={t.pageNumber} type="button" className={`split-thumb ${visualSplitPages.includes(t.pageNumber) ? "selected" : ""}`} onClick={() => toggleSplitPage(t.pageNumber)}><img src={t.image} alt={`Page ${t.pageNumber}`} /><span>{t.pageNumber}</span></button>))}</div></div>)}
              </div>
            )}

            {activeTool === "edit" && (
              <div className="options-grid">
                <label className="form-field"><span>Rotation (applied to all pages)</span><select value={rotation} onChange={(e) => setRotation(e.target.value)}><option value="0">No rotation</option><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise</option></select></label>
                <label className="form-field"><span>Remove pages (e.g. 2,4-6)</span><input value={removePages} onChange={(e) => setRemovePages(e.target.value)} placeholder="2,4-6" /></label>
                <label className="form-field"><span>Watermark text</span><input value={watermark} onChange={(e) => setWatermark(e.target.value)} placeholder="CONFIDENTIAL" /></label>
              </div>
            )}

            {activeTool === "rotate" && (
              <div className="options-grid">
                <label className="form-field"><span>Rotation angle (applied to all pages)</span><select value={rotation} onChange={(e) => setRotation(e.target.value)}><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">270° clockwise (= 90° counter-clockwise)</option></select></label>
              </div>
            )}

            {(activeTool === "extract" || activeTool === "word") && (
              <label className="option-row"><input type="checkbox" checked={enableOcr} onChange={(e) => setEnableOcr(e.target.checked)} /><span>Enable OCR (for scanned PDFs without selectable text)</span></label>
            )}

            {activeTool === "ocr" && (<p className="option-hint">OCR is always enabled for this tool. Processing a multi-page scanned PDF may take 30–60 seconds.</p>)}

            {activeTool === "pdfToJpg" && (
              <div className="options-grid">
                <label className="form-field"><span>Image quality</span><select value={jpgQuality} onChange={(e) => setJpgQuality(e.target.value)}><option value="1.0">Maximum (1.0 — largest files)</option><option value="0.92">High (0.92 — recommended)</option><option value="0.75">Medium (0.75 — smaller files)</option><option value="0.5">Low (0.5 — smallest files)</option></select></label>
                <p className="option-hint">Each page is exported as a separate JPG. Multi-page PDFs produce multiple files — use "Download All as ZIP".</p>
              </div>
            )}

            {activeTool === "pageNumbers" && (
              <div className="options-grid">
                <label className="form-field"><span>Starting page number</span><input type="number" min="1" value={pageNumStart} onChange={(e) => setPageNumStart(e.target.value)} placeholder="1" /></label>
                <label className="form-field"><span>Position</span><select value={pageNumPosition} onChange={(e) => setPageNumPosition(e.target.value as typeof pageNumPosition)}><option value="bottom-center">Bottom center</option><option value="bottom-right">Bottom right</option><option value="bottom-left">Bottom left</option></select></label>
                <label className="form-field"><span>Font size (pt)</span><input type="number" min="8" max="24" value={pageNumSize} onChange={(e) => setPageNumSize(e.target.value)} placeholder="12" /></label>
              </div>
            )}

            {(activeTool === "unlock" || activeTool === "compress" || activeTool === "imageToPdf") && (
              <p className="option-hint">No additional options needed — upload your file and click Run.</p>
            )}

            {activeTool === "merge" && mergeComposerPages.length > 0 && (
              <div className="merge-composer">
                <p className="option-hint">Reorder pages — they will merge in this order:</p>
                <div className="merge-thumbs">
                  {mergeComposerPages.map((page, idx) => (
                    <div key={page.id} className="merge-thumb">
                      <img src={page.image} alt={`${page.fileName} p${page.pageNumber}`} />
                      <span>{page.fileName.slice(0, 10)} · {page.pageNumber}</span>
                      <div className="merge-thumb-actions">
                        <button type="button" onClick={() => moveMergePage(page.id, -1)} disabled={idx === 0}><FaChevronUp /></button>
                        <button type="button" onClick={() => moveMergePage(page.id, 1)} disabled={idx === mergeComposerPages.length - 1}><FaChevronDown /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {previewLoading && <p className="ws-status">Generating preview…</p>}

            <button type="button" className="btn btn-primary btn-run" onClick={runTool} disabled={busy || !files.length}>
              {busy ? (activeTool === "ocr" ? "Running OCR…" : `Running ${tool.title}…`) : `Run ${tool.title}`}
            </button>
          </section>

          <section className="ws-step-card">
            <div className="ws-step-label">Step 3 — Download</div>
            <div className="ws-step-header">
              <h2 className="ws-step-title">Your results</h2>
              {results.length > 1 && (<button type="button" className="btn btn-outline" onClick={downloadAll} disabled={busy}><FaDownload /> Download All as ZIP</button>)}
            </div>
            {results.length === 0 ? (
              <div className="empty-results"><FaFileAlt className="empty-icon" /><p>No results yet. Upload a file and run the tool above.</p></div>
            ) : (
              <ul className="result-list">
                {results.map((r) => (
                  <li key={r.id} className="result-item">
                    <div className="result-info"><FaFileAlt /><div><strong>{r.name}</strong><span>{r.summary}</span></div></div>
                    <a className="btn btn-primary btn-sm" href={r.url} download={r.name}><FaDownload /> Download</a>
                    {r.textPreview && (<textarea className="text-preview" readOnly value={r.textPreview} rows={6} />)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
