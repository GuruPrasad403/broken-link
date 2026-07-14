import { jest } from '@jest/globals';
import { extractAssets } from '../src/services/parserService.js';

describe('parserService', () => {
  it('should extract CSS and JS absolute and relative URLs', () => {
    const html = `
      <html>
        <head>
          <link rel="stylesheet" href="/style.css">
          <link rel="stylesheet" href="https://cdn.example.com/main.css">
        </head>
        <body>
          <script src="app.js"></script>
          <script src="//ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
          <script>console.log('inline')</script>
        </body>
      </html>
    `;
    const baseUrl = 'https://example.com/path/page.html';

    const { cssAssets, jsAssets } = extractAssets(html, baseUrl);

    expect(cssAssets).toContain('https://example.com/style.css');
    expect(cssAssets).toContain('https://cdn.example.com/main.css');
    
    expect(jsAssets).toContain('https://example.com/path/app.js');
    expect(jsAssets).toContain('https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js');
    
    expect(cssAssets.length).toBe(2);
    expect(jsAssets.length).toBe(2);
  });
});
