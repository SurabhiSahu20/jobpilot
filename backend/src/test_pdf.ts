import * as pdfParseStar from 'pdf-parse';

const test = async () => {
  try {
    const parser = new pdfParseStar.PDFParse({ data: Buffer.from('%PDF-1.4 ...') });
    console.log('Parser constructed successfully!');
    const textResult = await parser.getText();
    console.log('Text result:', textResult);
  } catch (e: any) {
    console.log('Error caught:', e.message);
  }
};
test();
