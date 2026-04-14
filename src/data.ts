export type ToolId =
  | "merge"
  | "split"
  | "compress"
  | "rotate"
  | "extract"
  | "ocr"
  | "edit"
  | "word"
  | "imageToPdf"
  | "pdfToJpg"
  | "pageNumbers"
  | "unlock";

export type ToolDefinition = {
  id: ToolId;
  title: string;
  category: string;
  description: string;
  accept: string;
  multi: boolean;
  note: string;
};

export const toolDefinitions: ToolDefinition[] = [
  {
    id: "merge",
    title: "Merge PDF",
    category: "Organize",
    description: "Combine multiple PDF files into a single document in the order you choose.",
    accept: ".pdf,application/pdf",
    multi: true,
    note: "Upload two or more PDFs. Drag pages in the composer to set the final order.",
  },
  {
    id: "split",
    title: "Split PDF",
    category: "Organize",
    description: "Create a new PDF from selected pages, or export every page separately.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Enter page ranges like 1-3,5,8 or toggle 'split every page' for individual files.",
  },
  {
    id: "compress",
    title: "Compress PDF",
    category: "Optimize",
    description: "Re-save PDFs with browser-side optimization for lighter file sizes.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Compression is structure-based and works best on text-heavy PDFs.",
  },
  {
    id: "rotate",
    title: "Rotate PDF",
    category: "Organize",
    description: "Rotate all pages in a PDF by 90°, 180°, or 270°.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Select the rotation angle. All pages in the document will be rotated.",
  },
  {
    id: "extract",
    title: "Extract Text",
    category: "Content",
    description: "Pull readable text out of a PDF and download it as a TXT file.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Works best on text-based PDFs. Enable OCR below for scanned documents.",
  },
  {
    id: "ocr",
    title: "OCR PDF",
    category: "Content",
    description: "Use Optical Character Recognition to extract text from scanned PDFs.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "OCR runs entirely in your browser using Tesseract. Processing may take a minute for long documents.",
  },
  {
    id: "edit",
    title: "Edit PDF",
    category: "Editor",
    description: "Rotate pages, remove pages, and add a watermark text overlay.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Combine multiple page-level edits in one pass.",
  },
  {
    id: "word",
    title: "PDF to Word",
    category: "Convert",
    description: "Export extracted PDF text into an editable DOCX file.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Text-based PDFs convert best. Enable OCR for scanned documents.",
  },
  {
    id: "imageToPdf",
    title: "Image to PDF",
    category: "Convert",
    description: "Turn JPG or PNG images into a downloadable PDF document.",
    accept: ".png,.jpg,.jpeg,image/png,image/jpeg",
    multi: true,
    note: "Upload one or more images. Each image becomes a full PDF page.",
  },
  {
    id: "pdfToJpg",
    title: "PDF to JPG",
    category: "Convert",
    description: "Export each page of a PDF as a high-quality JPG image.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Each page is exported as a separate JPG. Download individually or as a ZIP.",
  },
  {
    id: "pageNumbers",
    title: "Add Page Numbers",
    category: "Editor",
    description: "Stamp numbered page labels on every page of a PDF.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Choose position, font size, and starting number.",
  },
  {
    id: "unlock",
    title: "Unlock PDF",
    category: "Security",
    description: "Remove PDF restrictions and re-save as a fully open, unrestricted file.",
    accept: ".pdf,application/pdf",
    multi: false,
    note: "Works on PDFs restricted by viewer permissions. Does not bypass owner passwords.",
  },
];
