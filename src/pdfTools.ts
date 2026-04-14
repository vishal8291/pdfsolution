import { Document, Packer, Paragraph } from "docx";
import JSZip from "jszip";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { createWorker } from "tesseract.js";

GlobalWorkerOptions.workerSrc = pdfWorker;

export type ResultFile = {
  name: string;
  blob: Blob;
  summary: string;
  textPreview?: string;
};

export type MergePlanItem = {
  file: File;
  pageIndex: number;
};

export type TextExtractionOptions = {
  useOcr?: boolean;
};

export async function getPdfPageCount(file: File): Promise<number> {
  const bytes = await readFileBytes(file);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getPageCount();
}

export async function mergePdfFiles(files: File[], mergePlan?: MergePlanItem[]): Promise<ResultFile> {
  const merged = await PDFDocument.create();

  if (mergePlan && mergePlan.length > 0) {
    const loaded = new Map<File, PDFDocument>();

    for (const item of mergePlan) {
      if (!loaded.has(item.file)) {
        loaded.set(
          item.file,
          await PDFDocument.load(await readFileBytes(item.file), { ignoreEncryption: true }),
        );
      }

      const source = loaded.get(item.file);
      if (!source) {
        throw new Error("Unable to load a PDF for merging.");
      }

      const [page] = await merged.copyPages(source, [item.pageIndex]);
      merged.addPage(page);
    }
  } else {
    for (const file of files) {
      const source = await PDFDocument.load(await readFileBytes(file), {
        ignoreEncryption: true,
      });
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
    }
  }

  const output = await merged.save({ useObjectStreams: true });
  return {
    name: "merged-document.pdf",
    blob: toPdfBlob(output),
    summary: `Merged ${files.length} PDF files into one document.`,
  };
}

export async function splitPdfFile(
  file: File,
  selection: string,
  splitEveryPage: boolean,
): Promise<ResultFile[]> {
  const bytes = await readFileBytes(file);
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = source.getPageCount();
  const baseName = stripExtension(file.name);

  if (splitEveryPage) {
    const outputs: ResultFile[] = [];

    for (let index = 0; index < totalPages; index += 1) {
      const nextPdf = await PDFDocument.create();
      const [page] = await nextPdf.copyPages(source, [index]);
      nextPdf.addPage(page);
      const saved = await nextPdf.save({ useObjectStreams: true });
      outputs.push({
        name: `${baseName}-page-${index + 1}.pdf`,
        blob: toPdfBlob(saved),
        summary: `Extracted page ${index + 1} of ${totalPages}.`,
      });
    }

    return outputs;
  }

  const selectedPages = parsePageSelection(selection, totalPages);
  const nextPdf = await PDFDocument.create();
  const copied = await nextPdf.copyPages(source, selectedPages);
  copied.forEach((page) => nextPdf.addPage(page));
  const saved = await nextPdf.save({ useObjectStreams: true });

  return [
    {
      name: `${baseName}-split.pdf`,
      blob: toPdfBlob(saved),
      summary: `Created a new PDF with ${selectedPages.length} selected page(s).`,
    },
  ];
}

export async function extractTextFromPdf(
  file: File,
  options: TextExtractionOptions = {},
): Promise<ResultFile> {
  const text = await extractPdfText(file, options);
  const safeText = text || "No readable text was found in this PDF.";

  return {
    name: `${stripExtension(file.name)}.txt`,
    blob: new Blob([safeText], { type: "text/plain;charset=utf-8" }),
    summary: text
      ? options.useOcr
        ? "Extracted text into a TXT file using OCR support."
        : "Extracted text into a TXT file."
      : "No readable text found. Exported a TXT note instead.",
    textPreview: safeText.slice(0, 4000),
  };
}

export async function convertPdfToWord(
  file: File,
  options: TextExtractionOptions = {},
): Promise<ResultFile> {
  const text = await extractPdfText(file, options);
  const safeText = text || "No readable text was extracted from this PDF.";
  const sections = safeText
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => new Paragraph({ text: block }));

  const doc = new Document({
    sections: [
      {
        children: sections.length > 0 ? sections : [new Paragraph(safeText)],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  return {
    name: `${stripExtension(file.name)}.docx`,
    blob,
    summary: text
      ? options.useOcr
        ? "Created a DOCX file using OCR-recognized text from the PDF."
        : "Converted extracted PDF text into a DOCX file."
      : "Created a DOCX file with a fallback note because no readable text was found.",
    textPreview: safeText.slice(0, 2500),
  };
}

export type EditOptions = {
  rotation: number;
  removePages: string;
  watermark: string;
};

export async function editPdfFile(
  file: File,
  options: EditOptions,
): Promise<ResultFile> {
  const bytes = await readFileBytes(file);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const totalPages = pdf.getPageCount();
  const toRemove = options.removePages.trim()
    ? parsePageSelection(options.removePages, totalPages)
    : [];

  if (toRemove.length === totalPages) {
    throw new Error("You cannot remove every page from the PDF.");
  }

  [...toRemove]
    .sort((left, right) => right - left)
    .forEach((pageIndex) => {
      pdf.removePage(pageIndex);
    });

  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const rotateBy = normalizeRotation(options.rotation);

  pdf.getPages().forEach((page) => {
    if (rotateBy !== 0) {
      page.setRotation(degrees((page.getRotation().angle + rotateBy) % 360));
    }

    if (options.watermark.trim()) {
      const width = page.getWidth();
      const height = page.getHeight();
      const size = Math.max(24, Math.min(width, height) / 14);
      page.drawText(options.watermark.trim(), {
        x: width * 0.12,
        y: height * 0.5,
        size,
        font,
        rotate: degrees(-35),
        color: rgb(0.72, 0.16, 0.16),
        opacity: 0.22,
      });
    }
  });

  const saved = await pdf.save({ useObjectStreams: true, addDefaultPage: false });

  return {
    name: `${stripExtension(file.name)}-edited.pdf`,
    blob: toPdfBlob(saved),
    summary: "Applied page edits and watermark changes.",
  };
}

export async function compressPdfFile(file: File): Promise<ResultFile> {
  const bytes = await readFileBytes(file);
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const rebuilt = await PDFDocument.create();
  const pages = await rebuilt.copyPages(source, source.getPageIndices());
  pages.forEach((page) => rebuilt.addPage(page));
  const saved = await rebuilt.save({ useObjectStreams: true, addDefaultPage: false });

  return {
    name: `${stripExtension(file.name)}-compressed.pdf`,
    blob: toPdfBlob(saved),
    summary: `Re-saved the PDF with browser-side optimization. Original: ${formatBytes(file.size)}. New: ${formatBytes(saved.byteLength)}.`,
  };
}

export async function imagesToPdf(files: File[]): Promise<ResultFile> {
  const pdf = await PDFDocument.create();

  for (const file of files) {
    const imageBytes = await readFileBytes(file);
    const isPng = file.type === "image/png" || file.name.toLowerCase().endsWith(".png");
    const image = isPng ? await pdf.embedPng(imageBytes) : await pdf.embedJpg(imageBytes);
    const page = pdf.addPage([image.width, image.height]);
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    });
  }

  const saved = await pdf.save({ useObjectStreams: true });
  return {
    name: "images-to-pdf.pdf",
    blob: toPdfBlob(saved),
    summary: `Converted ${files.length} image file(s) into a PDF.`,
  };
}

export async function rotatePdfPages(file: File, rotateDeg: number): Promise<ResultFile> {
  const bytes = await readFileBytes(file);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  pdf.getPages().forEach((page) => {
    page.setRotation(degrees((page.getRotation().angle + rotateDeg) % 360));
  });
  const saved = await pdf.save({ useObjectStreams: true });
  return {
    name: `${stripExtension(file.name)}-rotated.pdf`,
    blob: toPdfBlob(saved),
    summary: `All ${pdf.getPageCount()} pages rotated by ${rotateDeg}°.`,
  };
}

export type PageNumberOptions = {
  startFrom: number;
  position: "bottom-center" | "bottom-right" | "bottom-left";
  fontSize: number;
};

export async function addPageNumbersToPdf(file: File, options: PageNumberOptions): Promise<ResultFile> {
  const bytes = await readFileBytes(file);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const pages = pdf.getPages();
  const { startFrom, fontSize, position } = options;
  pages.forEach((page, i) => {
    const { width } = page.getSize();
    const label = String(i + startFrom);
    const textWidth = font.widthOfTextAtSize(label, fontSize);
    let x: number;
    if (position === "bottom-center") x = (width - textWidth) / 2;
    else if (position === "bottom-right") x = width - textWidth - 36;
    else x = 36;
    page.drawText(label, { x, y: 18, size: fontSize, font, color: rgb(0.3, 0.3, 0.3) });
  });
  const saved = await pdf.save({ useObjectStreams: true });
  return {
    name: `${stripExtension(file.name)}-numbered.pdf`,
    blob: toPdfBlob(saved),
    summary: `Added page numbers to ${pages.length} pages (starting from ${startFrom}).`,
  };
}

export async function pdfToJpeg(file: File, quality = 0.92, scale = 2): Promise<ResultFile[]> {
  const bytes = await readFileBytes(file);
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const results: ResultFile[] = [];
  const baseName = stripExtension(file.name);
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Unable to create canvas context.");
    await page.render({ canvasContext: ctx as CanvasRenderingContext2D, viewport, canvas }).promise;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Canvas export failed."))),
        "image/jpeg",
        quality,
      );
    });
    results.push({
      name: `${baseName}-page-${i}.jpg`,
      blob,
      summary: `Page ${i} of ${pdf.numPages} — ${formatBytes(blob.size)}`,
    });
  }
  return results;
}

export async function unlockPdfFile(file: File): Promise<ResultFile> {
  const bytes = await readFileBytes(file);
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const saved = await pdf.save({ useObjectStreams: true });
  return {
    name: `${stripExtension(file.name)}-unlocked.pdf`,
    blob: toPdfBlob(saved),
    summary: `Unlocked and re-saved as an open PDF (${pdf.getPageCount()} pages).`,
  };
}

export async function bundleResultsAsZip(results: ResultFile[], zipName: string): Promise<ResultFile> {
  const zip = new JSZip();

  await Promise.all(
    results.map(async (result) => {
      zip.file(result.name, await result.blob.arrayBuffer());
    }),
  );

  const zipBlob = await zip.generateAsync({ type: "blob" });
  return {
    name: zipName,
    blob: zipBlob,
    summary: `Bundled ${results.length} files into a ZIP download.`,
  };
}

async function extractPdfText(file: File, options: TextExtractionOptions): Promise<string> {
  const directText = await extractDirectPdfText(file);

  if (directText) {
    return directText;
  }

  if (options.useOcr) {
    return extractPdfTextWithOcr(file);
  }

  return "";
}

async function extractDirectPdfText(file: File): Promise<string> {
  const bytes = await readFileBytes(file);
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    pages.push(`Page ${pageNumber}\n${pageText}`.trim());
  }

  return pages.join("\n\n").trim();
}

async function extractPdfTextWithOcr(file: File): Promise<string> {
  const bytes = await readFileBytes(file);
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const worker = await createWorker("eng");
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const canvas = document.createElement("canvas");
      const viewport = page.getViewport({ scale: 2 });
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Unable to create OCR canvas.");
      }

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);

      await page.render({
        canvas: canvas,
        canvasContext: context,
        viewport,
      }).promise;

      const { data } = await worker.recognize(canvas);
      const text = data.text.replace(/\s+\n/g, "\n").trim();
      pages.push(`Page ${pageNumber}\n${text}`.trim());
    }
  } finally {
    await worker.terminate();
  }

  return pages.join("\n\n").trim();
}

function parsePageSelection(selection: string, totalPages: number): number[] {
  const value = selection.trim();
  if (!value) {
    throw new Error("Enter the pages you want to use. Example: 1-3,5");
  }

  const pageSet = new Set<number>();

  value.split(",").forEach((part) => {
    const segment = part.trim();
    if (!segment) {
      return;
    }

    if (segment.includes("-")) {
      const [startText, endText] = segment.split("-").map((item) => item.trim());
      const start = Number(startText);
      const end = Number(endText);
      validatePageNumber(start, totalPages);
      validatePageNumber(end, totalPages);

      const min = Math.min(start, end);
      const max = Math.max(start, end);
      for (let page = min; page <= max; page += 1) {
        pageSet.add(page - 1);
      }
      return;
    }

    const page = Number(segment);
    validatePageNumber(page, totalPages);
    pageSet.add(page - 1);
  });

  if (pageSet.size === 0) {
    throw new Error("No valid pages were selected.");
  }

  return [...pageSet].sort((left, right) => left - right);
}

function validatePageNumber(value: number, totalPages: number) {
  if (!Number.isInteger(value) || value < 1 || value > totalPages) {
    throw new Error(`Page ${value} is outside the document range 1-${totalPages}.`);
  }
}

function normalizeRotation(value: number): number {
  const rounded = Math.round(value / 90) * 90;
  const normalized = rounded % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

async function readFileBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function stripExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function toPdfBlob(bytes: Uint8Array): Blob {
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;

  return new Blob([arrayBuffer], { type: "application/pdf" });
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(2)} MB`;
}

