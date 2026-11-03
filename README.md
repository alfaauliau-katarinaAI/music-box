# Music Box — Google Chat Music Bot

Prototype for office Google Chat music requests and queue management, with playback through an authorized YouTube IFrame Player on a visible Windows PC.

**Status:** Web App and Google Sheets created by project owner; YouTube API configured. Workspace add-on Chat integration has been updated in source but still needs deployment and end-to-end testing. Physical PC playback not verified.

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
5. No manual \`setupOnce()\` is needed for the web-player flow. After deploying the web app as **Execute as me / Only myself**, open its URL as the script owner. The first visit calls \`setupOnce()\` to create the queue spreadsheet; Google may still require the owner to authorize Spreadsheet scopes before this succeeds. You can also run \`setupOnce()\` in the Apps Script editor if authorization/setup is blocked.
6. Google Chat API was created with the **Workspace add-on** setting, which cannot be unchecked after it is saved. The manifest supports this through \`addOns.chat\`; Chat callbacks accept add-on event objects. Deploy **Add-on** in Apps Script, then configure Google Chat API → Connection settings → Apps Script with that **Add-on deployment ID**, Message trigger \`onMessage\`, Added to space trigger \`onAddedToSpace\`, and your tester email in Visibility. This is separate from the player Web App deployment. Use \`@Bot whoami\` after the Chat app responds.
7. Deploy the Apps Script web app as **Execute as me / Only myself**; open its URL as the script owner to initialize the queue, then keep it open in Chrome or Edge on the Windows PC. Click **Mulai Pemutaran** to enable audio.
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
