# NOLA Chill Fest Website - Production v4

This package is ready for Cloudflare Pages or GitHub Pages.

## Included in v4
- Responsive tournament website
- Patrick Cresson and Keith Nunez contact cards
- Optional Sponsors page and homepage sponsor module
- Tournament updates and countdown modules
- Google Apps Script registration backend
- Hidden Who's Coming navigation until enabled
- Six preloaded division bracket PDFs in `assets/pdfs/`

## Before launch
1. Create the Google Sheet and deploy `apps-script/Code.gs` as a Web App.
2. Paste the `/exec` URL into `assets/config.js`.
3. Test one registration.
4. Set `showWhosComing: true` after the first approved team.
5. Replace bracket PDFs with official files using the exact same filenames.
6. Set `showSponsors: false` in `assets/config.js` to hide sponsor modules.

## Bracket filenames
- `nola-chill-fest-7u-bracket.pdf` through `nola-chill-fest-12u-bracket.pdf`

Deploy the contents of this folder, not the ZIP itself, unless your hosting upload flow accepts archives.
