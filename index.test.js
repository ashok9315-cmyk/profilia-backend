const textExtractor = require('./services/textExtractor');
const portfolioGenerator = require('./services/portfolioGenerator');
const s3Uploader = require('./services/s3Uploader');

describe('Text Extractor Service', () => {
  test('should be defined', () => {
    expect(textExtractor).toBeDefined();
    expect(textExtractor.extractText).toBeDefined();
  });
});

describe('Portfolio Generator Service', () => {
  test('should be defined', () => {
    expect(portfolioGenerator).toBeDefined();
    expect(portfolioGenerator.generatePortfolio).toBeDefined();
  });
});

describe('S3 Uploader Service', () => {
  test('should be defined', () => {
    expect(s3Uploader).toBeDefined();
    expect(s3Uploader.uploadToS3).toBeDefined();
  });
});

describe('Lambda Handler', () => {
  test('should be defined', () => {
    const handler = require('./index');
    expect(handler).toBeDefined();
    expect(handler.handler).toBeDefined();
  });
});
