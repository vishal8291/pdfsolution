import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorker;

export type PdfThumbnail = {
  pageNumber: number;
  image: string;
};

export type PdfPreview = {
  pageCount: number;
  heroImage: string;
  thumbnails: PdfThumbnail[];
};

export async function buildPdfPreview(file: File): Promise<PdfPreview> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const loadingTask = getDocument({ data: bytes });
  const pdf = await loadingTask.promise;
  const thumbnails: PdfThumbnail[] = [];
  let heroImage = "";

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const thumbnail = await renderPageToImage(page, 0.32);
    thumbnails.push({ pageNumber, image: thumbnail });

    if (pageNumber === 1) {
      heroImage = await renderPageToImage(page, 1);
    }
  }

  return {
    pageCount: pdf.numPages,
    heroImage,
    thumbnails,
  };
}

async function renderPageToImage(page: any, scale: number) {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to create preview canvas.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);

  await page.render({
    canvasContext: context,
    viewport,
  }).promise;

  return canvas.toDataURL("image/png");
}
