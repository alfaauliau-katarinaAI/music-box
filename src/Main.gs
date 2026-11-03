/**
 * Office Music Bot - Google Chat / Apps Script / YouTube IFrame Player.
 * Data antrean berada di Google Sheets milik akun kantor.
 */
const MUSIC = Object.freeze({
  SHEET: 'Queue',
  HEADERS: ['id', 'video_id', 'title', 'requester', 'user_id', 'status', 'created_at', 'started_at', 'finished_at', 'message_id', 'notes'],
  MAX_PER_USER: 2,
  MAX_SECONDS: 600,
  MAX_QUEUE_DISPLAY: 10,
  STATUSES: { QUEUED: 'QUEUED', PLAYING: 'PLAYING', PLAYED: 'PLAYED', SKIPPED: 'SKIPPED', FAILED: 'FAILED' }
});

/** Jalankan sekali dari Apps Script editor. */
function setupOnce() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('SPREADSHEET_ID')) {
    const spreadsheet = SpreadsheetApp.create('Office Music Bot - Queue');
    const sheet = spreadsheet.getActiveSheet();
    sheet.setName(MUSIC.SHEET);
    sheet.getRange(1, 1, 1, MUSIC.HEADERS.length).setValues([MUSIC.HEADERS]);
    sheet.setFrozenRows(1);
    props.setProperty('SPREADSHEET_ID', spreadsheet.getId());
    console.log('Spreadsheet: ' + spreadsheet.getUrl());
  }
  console.log('Set YOUTUBE_API_KEY, ALLOWED_SPACE_NAME, ADMIN_IDS in Script Properties.');
  console.log('SPREADSHEET_ID: ' + props.getProperty('SPREADSHEET_ID'));
}

/** Adapts Workspace add-on Chat event payloads to shared Music Box logic. */
function onMessage(e) {
  if (e && e.chat) {
    const chat = e.chat, payload = chat.messagePayload || {};
    const legacy = {
      message: payload.message || {},
      user: chat.user || (payload.message && payload.message.sender) || {},
      space: chat.space || payload.space || {}
    };
    return addOnMessage_(onMessageLegacy_(legacy));
  }
  return onMessageLegacy_(e);
}
function addOnMessage_(message) {
  return { hostAppDataAction: { chatDataAction: { createMessageAction: { message: message } } } };
}
/** Shared command logic for both Chat event formats. */
function onMessageLegacy_(e) {
  try {
    const msg = e && e.message || {};
    const user = e && e.user || msg.sender || {};
    const spaceName = e && e.space && e.space.name || '';
    const allowed = setting_('ALLOWED_SPACE_NAME');
    if (allowed && allowed !== spaceName) return { text: 'Bot ini hanya tersedia di ruang Google Chat yang diizinkan.' };
    const raw = String(msg.argumentText || msg.text || '').trim();
    const parsed = parseCommand_(raw);
    const userId = String(user.name || user.email || '').trim();
    const displayName = String(user.displayName || 'Anggota');
    const messageId = String(msg.name || '');

    if (parsed.cmd === 'help') return { text: 'Office Music Bot\n@Bot play <judul lagu atau URL YouTube>\n@Bot queue\n@Bot nowplaying\n@Bot whoami\n@Bot skip (admin)' };
    if (parsed.cmd === 'whoami') return { text: 'ID Google Chat: ' + (userId || 'tidak tersedia') + '\nSpace: ' + (spaceName || 'tidak tersedia') };
    if (parsed.cmd === 'queue') return { text: queueText_() };
    if (parsed.cmd === 'nowplaying') {
      const current = getRows_().find(r => r.status === MUSIC.STATUSES.PLAYING);
      return { text: current ? 'Memutar: ' + current.title + ' — request ' + current.requester : 'Belum ada lagu yang diputar.' };
    }
    if (parsed.cmd === 'skip') {
      if (!isAdmin_(user)) return { text: 'Skip hanya untuk admin terdaftar.' };
      return { text: skipCurrent_() ? 'Lagu dilewati. Player akan memproses lagu berikutnya.' : 'Tidak ada lagu yang sedang diputar.' };
    }
    if (parsed.cmd !== 'play' || !parsed.args) return { text: 'Gunakan @Bot play judul lagu atau @Bot play URL YouTube. Ketik help.' };
    if (!userId) return { text: 'Identitas pengguna tidak tersedia.' };
    const video = findVideo_(parsed.args);
    const result = enqueue_(video, displayName, userId, messageId);
    if (result.duplicate) return { text: 'Request ini sudah tercatat.' };
    return { text: 'Request diterima!\n' + video.title + '\nOleh: ' + displayName + '\nhttps://www.youtube.com/watch?v=' + video.videoId + '\nPosisi: ' + result.position };
  } catch (err) {
    console.error(err && err.stack || err);
    return { text: 'Request gagal: ' + friendlyError_(err) };
  }
}
function onAddToSpace() { return { text: 'Halo! Sebut bot dan kirim play judul lagu, queue, nowplaying, atau help.' }; }
function onAddedToSpace(e) { return addOnMessage_(onAddToSpace(e)); }
function onRemoveFromSpace(e) { console.log('Bot removed from ' + ((e && e.space && e.space.name) || 'unknown')); }
function onRemovedFromSpace(e) {
  const chat = (e && e.chat) || {};
  onRemoveFromSpace({space: chat.space || (chat.removedFromSpacePayload && chat.removedFromSpacePayload.space) || {}});
}

/** Web App dijalankan sebagai pemilik, dibatasi Only myself. */
function doGet() {
  // Inisialisasi antrean otomatis saat pemilik membuka player Web App.
  // Deploy web app sebagai Execute as me, access Only myself.
  setupOnce();
  return HtmlService.createHtmlOutputFromFile('Player').setTitle('Office Music Bot — Player');
}
function playerGetState() {
  const rows = getRows_();
  return {
    now: rows.find(r => r.status === MUSIC.STATUSES.PLAYING) || null,
    queue: rows.filter(r => r.status === MUSIC.STATUSES.QUEUED).slice(0, MUSIC.MAX_QUEUE_DISPLAY),
    pending: rows.filter(r => r.status === MUSIC.STATUSES.QUEUED).length
  };
}
function playerClaimNext() {
  return locked_(() => {
    const sheet = getSheet_(), rows = getRows_();
    const active = rows.find(r => r.status === MUSIC.STATUSES.PLAYING);
    if (active) return active;
    const next = rows.find(r => r.status === MUSIC.STATUSES.QUEUED);
    if (!next) return null;
    sheet.getRange(next.row, 6).setValue(MUSIC.STATUSES.PLAYING);
    sheet.getRange(next.row, 8).setValue(new Date());
    next.status = MUSIC.STATUSES.PLAYING;
    return next;
  });
}
function playerFinish(id, outcome) {
  const nextStatus = outcome === 'FAILED' ? MUSIC.STATUSES.FAILED : MUSIC.STATUSES.PLAYED;
  return locked_(() => {
    const active = getRows_().find(r => r.id === id && r.status === MUSIC.STATUSES.PLAYING);
    if (!active) return false;
    const sheet = getSheet_();
    sheet.getRange(active.row, 6).setValue(nextStatus);
    sheet.getRange(active.row, 9).setValue(new Date());
    return true;
  });
}
function parseCommand_(raw) {
  const cleaned = String(raw || '').replace(/^\s*@[^\s]+\s+/i, '').trim();
  const match = cleaned.match(/^\/?(play|request|queue|nowplaying|skip|help|whoami)(?:\s+([\s\S]*))?$/i);
  return match ? {cmd: match[1].toLowerCase() === 'request' ? 'play' : match[1].toLowerCase(), args: (match[2] || '').trim()} : {cmd: 'help', args: ''};
}
function setting_(name) {
  return String(PropertiesService.getScriptProperties().getProperty(name) || '').trim();
}
function getSheet_() {
  const id = setting_('SPREADSHEET_ID');
  if (!id) throw Error('Jalankan setupOnce() terlebih dahulu.');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(MUSIC.SHEET);
  if (!sheet) throw Error('Sheet Queue tidak ditemukan.');
  return sheet;
}
function getRows_() {
  const sheet = getSheet_();
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, MUSIC.HEADERS.length).getValues().map((v, i) => ({
    row: i + 2, id: String(v[0]), videoId: String(v[1]), title: String(v[2]),
    requester: String(v[3]), userId: String(v[4]), status: String(v[5]),
    createdAt: String(v[6]), messageId: String(v[9])
  }));
}
function locked_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) throw Error('Antrean sedang sibuk, coba lagi.');
  try { return fn(); } finally { lock.releaseLock(); }
}
function enqueue_(video, displayName, userId, messageId) {
  return locked_(() => {
    const rows = getRows_();
    if (messageId && rows.some(r => r.messageId === messageId)) return {duplicate: true};
    if (rows.filter(r => r.userId === userId && r.status === MUSIC.STATUSES.QUEUED).length >= MUSIC.MAX_PER_USER)
      throw Error('Batas 2 request tertunda per orang.');
    const position = rows.filter(r => r.status === MUSIC.STATUSES.QUEUED).length + 1;
    getSheet_().appendRow([Utilities.getUuid(), video.videoId, video.title, displayName, userId,
      MUSIC.STATUSES.QUEUED, new Date(), '', '', messageId, '']);
    return {duplicate: false, position};
  });
}
function queueText_() {
  const queued = getRows_().filter(r => r.status === MUSIC.STATUSES.QUEUED);
  return queued.length
    ? 'Antrean (' + queued.length + '):\n' + queued.slice(0, MUSIC.MAX_QUEUE_DISPLAY).map((r,i) =>
        (i+1) + '. ' + r.title + ' — ' + r.requester).join('\n')
    : 'Antrean masih kosong.';
}
function isAdmin_(user) {
  const allowed = setting_('ADMIN_IDS').split(',').map(s => s.trim()).filter(Boolean);
  const candidates = [String(user && user.name || ''), String(user && user.email || '')].filter(Boolean);
  return allowed.length > 0 && candidates.some(x => allowed.includes(x));
}
function skipCurrent_() {
  return locked_(() => {
    const current = getRows_().find(r => r.status === MUSIC.STATUSES.PLAYING);
    if (!current) return false;
    const sheet = getSheet_();
    sheet.getRange(current.row, 6).setValue(MUSIC.STATUSES.SKIPPED);
    sheet.getRange(current.row, 9).setValue(new Date());
    return true;
  });
}
function extractVideoId_(raw) {
  const s = String(raw || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/^https?:\/\/([^\/?#:]+)(?:\:[0-9]+)?([^#]*)/i);
  if (!m) return null;
  const host = m[1].toLowerCase(), pathAndQuery = m[2] || '';
  let id = '';
  if (host === 'youtu.be' || host === 'www.youtu.be') {
    const v = pathAndQuery.match(/^\/([A-Za-z0-9_-]{11})(?:[?\/]|$)/);
    id = v ? v[1] : '';
  } else if (['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'].includes(host)) {
    const watch = pathAndQuery.match(/^\/watch\?([^#]*)/);
    if (watch) {
      const p = watch[1].split('&').find(x => /^v=/.test(x));
      id = p ? decodeURIComponent(p.slice(2)) : '';
    } else {
      const v = pathAndQuery.match(/^\/(?:shorts|live|embed)\/([A-Za-z0-9_-]{11})(?:[?\/]|$)/);
      id = v ? v[1] : '';
    }
  }
  return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}
function ytGet_(resource, params) {
  const key = setting_('YOUTUBE_API_KEY');
  if (!key) throw Error('YOUTUBE_API_KEY belum diisi.');
  const query = Object.keys(params).map(k => encodeURIComponent(k)+'='+encodeURIComponent(params[k])).join('&');
  const url = 'https://www.googleapis.com/youtube/v3/'+resource+'?'+query+'&key='+encodeURIComponent(key);
  const r = UrlFetchApp.fetch(url,{muteHttpExceptions:true});
  if (r.getResponseCode() !== 200) {
    console.error('YouTube API HTTP '+r.getResponseCode()+': '+r.getContentText().slice(0,400));
    throw Error('YouTube API error atau kuota habis (HTTP '+r.getResponseCode()+').');
  }
  return JSON.parse(r.getContentText());
}
function durationSeconds_(iso) {
  const m = String(iso || '').match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  return (+m[1]||0)*86400+(+m[2]||0)*3600+(+m[3]||0)*60+(+m[4]||0);
}
function findVideo_(input) {
  const directId = extractVideoId_(input);
  if (!directId && /^https?:\/\//i.test(input)) throw Error('Link harus dari youtube.com atau youtu.be.');
  let ids;
  if (directId) ids = [directId];
  else {
    if (input.length > 150) throw Error('Judul lagu terlalu panjang.');
    const search = ytGet_('search',{part:'snippet',type:'video',videoEmbeddable:'true',maxResults:5,q:input});
    ids = (search.items || []).map(x => x.id && x.id.videoId).filter(Boolean);
  }
  if (!ids.length) throw Error('Lagu tidak ditemukan.');
  const response = ytGet_('videos',{part:'snippet,contentDetails,status',id:ids.join(',')});
  const byId = {};
  (response.items || []).forEach(x => { byId[x.id]=x; });
  for (const id of ids) {
    const v = byId[id];
    if (!v || !v.status || v.status.embeddable === false) continue;
    if (v.snippet && v.snippet.liveBroadcastContent === 'live') continue;
    const seconds=durationSeconds_(v.contentDetails && v.contentDetails.duration);
    if (seconds > 0 && seconds <= MUSIC.MAX_SECONDS) return {
      videoId:id, title:String(v.snippet.title||'Video YouTube').slice(0,180),seconds
    };
  }
  throw Error('Video tidak bisa di-embed atau durasi lebih dari 10 menit.');
}
function friendlyError_(err) {
  const msg=String(err && err.message || 'Kesalahan tidak diketahui');
  if (/Spreadsheet|Sheet Queue|setupOnce|YOUTUBE_API_KEY|Antrean|Batas|YouTube|Video|Judul|Link|Lagu|request/i.test(msg))
    return msg;
  return 'Terjadi masalah. Hubungi pengelola bot.';
}
