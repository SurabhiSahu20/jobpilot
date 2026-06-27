import * as pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export const parsePdf = async (buffer: Buffer): Promise<string> => {
  try {
    const parser = new pdfParse.PDFParse({ data: buffer });
    const result = await parser.getText();
    return result.text || '';
  } catch (error: any) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }
};

export const parseDocx = async (buffer: Buffer): Promise<string> => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || '';
  } catch (error: any) {
    console.error('Error parsing DOCX:', error);
    throw new Error(`Failed to parse DOCX: ${error.message}`);
  }
};

export const parseResume = async (buffer: Buffer, mimetype: string): Promise<string> => {
  if (mimetype === 'application/pdf') {
    return parsePdf(buffer);
  } else if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword'
  ) {
    return parseDocx(buffer);
  } else {
    throw new Error(`Unsupported file type: ${mimetype}. Please upload a PDF or DOCX file.`);
  }
};
