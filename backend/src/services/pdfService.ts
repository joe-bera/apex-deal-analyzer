import fs from 'fs';
import pdf from 'pdf-parse';
import { AppError } from '../middleware/errorHandler';

/**
 * PDF parsing result
 */
export interface PDFParseResult {
  text: string;
  numPages: number;
  info: {
    Title?: string;
    Author?: string;
    Subject?: string;
    Creator?: string;
    Producer?: string;
    CreationDate?: string;
    ModDate?: string;
  };
}

/**
 * Extract text and metadata from PDF file
 *
 * @param filePath - Path to PDF file (local or downloaded)
 * @returns Parsed PDF data (text, metadata, page count)
 */
export const parsePDF = async (filePath: string): Promise<PDFParseResult> => {
  try {
    // Read PDF file
    const dataBuffer = fs.readFileSync(filePath);

    // Parse PDF using pdf-parse
    const data = await pdf(dataBuffer);

    return {
      text: data.text,
      numPages: data.numpages,
      info: {
        Title: data.info?.Title,
        Author: data.info?.Author,
        Subject: data.info?.Subject,
        Creator: data.info?.Creator,
        Producer: data.info?.Producer,
        CreationDate: data.info?.CreationDate,
        ModDate: data.info?.ModDate,
      },
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new AppError(500, 'Failed to parse PDF file');
  }
};

/**
 * Download PDF from URL and parse
 *
 * @param url - URL to PDF file
 * @returns Parsed PDF data
 */
export const parsePDFFromURL = async (url: string): Promise<PDFParseResult> => {
  try {
    // Fetch PDF from URL
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const data = await pdf(buffer);

    return {
      text: data.text,
      numPages: data.numpages,
      info: {
        Title: data.info?.Title,
        Author: data.info?.Author,
        Subject: data.info?.Subject,
        Creator: data.info?.Creator,
        Producer: data.info?.Producer,
        CreationDate: data.info?.CreationDate,
        ModDate: data.info?.ModDate,
      },
    };
  } catch (error) {
    console.error('PDF URL parsing error:', error);
    throw new AppError(500, 'Failed to download and parse PDF from URL');
  }
};

/**
 * Clean and normalize extracted text
 * - Remove excessive whitespace
 * - Normalize line breaks
 * - Trim leading/trailing spaces
 */
export const cleanPDFText = (text: string): string => {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/ {2,}/g, ' ') // Remove excessive spaces
    .trim();
};
