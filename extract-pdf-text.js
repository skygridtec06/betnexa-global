import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractPDFText() {
  try {
    const pdfPath = path.join(__dirname, 'public', 'betnexa-terms.pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.error('? PDF file not found at:', pdfPath);
      process.exit(1);
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse.default(pdfBuffer);
    
    console.log('? Extracted ' + data.numpages + ' pages from PDF');
    
    // Write to output file
    const outputPath = path.join(__dirname, 'extracted-terms.txt');
    fs.writeFileSync(outputPath, data.text);
    
    console.log('? Text saved to extracted-terms.txt');
    console.log('\n--- Extracted Content Preview ---\n');
    console.log(data.text.substring(0, 2000) + '...\n');
    
  } catch (error) {
    console.error('? Error:', error.message);
    process.exit(1);
  }
}

extractPDFText();
