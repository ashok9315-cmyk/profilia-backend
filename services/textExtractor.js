const pdf = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Extract text from PDF or Word document
 * @param {Buffer} fileBuffer - The file buffer
 * @param {string} fileExtension - The file extension (pdf, doc, docx)
 * @returns {Promise<string>} - Extracted text
 */
async function extractTextFromFile(fileBuffer, fileExtension) {
    try {
        switch (fileExtension.toLowerCase()) {
            case 'pdf':
                return await extractFromPDF(fileBuffer);
            
            case 'doc':
            case 'docx':
                return await extractFromWord(fileBuffer);
            
            default:
                throw new Error(`Unsupported file format: ${fileExtension}`);
        }
    } catch (error) {
        console.error('Error extracting text:', error);
        throw new Error(`Failed to extract text from ${fileExtension} file: ${error.message}`);
    }
}

/**
 * Extract text from PDF file
 * @param {Buffer} fileBuffer - The PDF file buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractFromPDF(fileBuffer) {
    try {
        const data = await pdf(fileBuffer);
        return data.text;
    } catch (error) {
        throw new Error(`PDF parsing failed: ${error.message}`);
    }
}

/**
 * Extract text from Word document
 * @param {Buffer} fileBuffer - The Word file buffer
 * @returns {Promise<string>} - Extracted text
 */
async function extractFromWord(fileBuffer) {
    try {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        return result.value;
    } catch (error) {
        throw new Error(`Word document parsing failed: ${error.message}`);
    }
}

module.exports = {
    extractTextFromFile
};
