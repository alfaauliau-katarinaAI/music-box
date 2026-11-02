# Music Box — Google Chat Music Bot

Prototype for office Google Chat music requests and queue management, with playback through an authorized YouTube IFrame Player on a visible Windows PC.

**Status:** source and local tests ready. Google Workspace, YouTube API, Google Chat, Apps Script deployment, and physical PC playback have not been configured or integration-tested.

## Features
- Mention the Chat app and send: \`play Dewa 19 Kangen\` or \`play https://youtu.be/VIDEO_ID\`.
- \`queue\`, \`nowplaying\`, \`whoami\`, and admin-only \`skip\`.
- Google Sheets FIFO queue; deduplication per message; limit 2 pending requests per user.
- YouTube Data API search and video validation; max 10 minutes per video.
- HTMLService player using the official YouTube IFrame API, with a visible player and operator start button.

## Setup
1. In a permitted company Google Cloud project, enable Google Chat API and YouTube Data API v3; create a YouTube API key restricted to that API.
2. Create a Google Apps Script project. Enable Apps Script API in your account settings if using clasp. Associate the same standard Google Cloud project where needed.
3. Push \`src/\` using clasp, or copy \`Main.gs\`, \`Player.html\`, and \`appsscript.json\` to the project manually.
4. Configure **Script Properties**: \`YOUTUBE_API_KEY\`, \`ALLOWED_SPACE_NAME\` (for production), \`ADMIN_IDS\`; \`SPREADSHEET_ID\` will be set by \`setupOnce()\`. Never commit secrets.
5. Run \`setupOnce()\` in the Apps Script editor and authorize creating the queue spreadsheet.
6. Configure Google Chat API connection to the Apps Script deployment and add the app to a test Chat Space. Use \`@Bot whoami\` to learn the Space and user IDs.
7. Deploy the Apps Script web app as **Execute as me / Only myself**; open the resulting URL in Chrome or Edge on the Windows PC logged in as the script owner. Click **Mulai Pemutaran** to enable audio.
8. Keep the YouTube player visible; set Windows sleep to Never and arrange opening the player after login. A browser may block further autoplay after reopening.

## GitHub Actions + clasp
- Workflows validate on push/PR. The sync workflow runs **manually**, never automatically.
- Add GitHub Actions secrets \`CLASPRC_JSON\` (OAuth file from your own authorized clasp login) and \`CLASP_JSON\` (JSON containing \`scriptId\` and \`rootDir: "src"\`).
- **Protect OAuth credentials and project access**. This repository is presently public; do not commit access tokens or Google credentials. Prefer a private repository before configuring deployment credentials.
- In Actions, run **Sync Google Apps Script** manually after installing secrets. It pushes source to HEAD; a versioned \`/exec\` web app may require redeploy.

## Tests
\`\`\`bash
node tests/check.js
node tests/functional.js
\`\`\`

## Operational constraints
- Google Workspace admin may restrict deploying Chat apps or granting OAuth access.
- The YouTube player must remain visible and not be used as a background audio extractor. Use YouTube according to its terms and check music licensing for office use.
- This proof of concept does not establish unattended 24/7 audio playback through a locked or logged-out Windows desktop.
- No hardware, accounts, or credentials are configured by this repository change.

References: https://developers.google.com/workspace/chat/quickstart/apps-script-app · https://developers.google.com/apps-script/guides/clasp · https://developers.google.com/youtube/iframe_api_reference
