import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';
import { Readable } from 'stream';

// ── Environment ──────────────────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const EXPLICIT_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
const CALLBACK_PATH = '/auth/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
];

export const isGoogleDriveConfigured = () =>
  Boolean(CLIENT_ID && CLIENT_SECRET);

// ── Token storage keyed by email ─────────────────────────────────────
const tokenStore = new Map<string, Credentials>();
const socketToEmail = new Map<string, string>();
const pendingOAuth = new Map<string, { socketId: string; redirectUri: string }>();

// ── OAuth helpers ────────────────────────────────────────────────────

const createOAuth2Client = (redirectUri: string): OAuth2Client =>
  new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);

const resolveRedirectUri = (origin?: string): string => {
  if (EXPLICIT_REDIRECT_URI) return EXPLICIT_REDIRECT_URI;
  if (origin) return `${origin.replace(/\/$/, '')}${CALLBACK_PATH}`;
  return `http://localhost:3000${CALLBACK_PATH}`;
};

export const getAuthUrl = (socketId: string, origin?: string): string => {
  const redirectUri = resolveRedirectUri(origin);
  const client = createOAuth2Client(redirectUri);
  const state = `${socketId}_${Date.now()}`;
  pendingOAuth.set(state, { socketId, redirectUri });
  console.log(`[GDRIVE] Auth URL generated. redirect_uri=${redirectUri}`);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });
};

export const handleAuthCallback = async (
  code: string,
  state: string
): Promise<{ socketId: string; email: string }> => {
  const pending = pendingOAuth.get(state);
  if (!pending) throw new Error('Invalid OAuth state');
  pendingOAuth.delete(state);

  const { socketId, redirectUri } = pending;
  const client = createOAuth2Client(redirectUri);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email || 'unknown';

  tokenStore.set(email, tokens);
  socketToEmail.set(socketId, email);
  console.log(`[GDRIVE] Authenticated: ${email} (socket ${socketId})`);
  return { socketId, email };
};

export const linkSocketToEmail = (socketId: string, email: string): boolean => {
  if (tokenStore.has(email)) {
    socketToEmail.set(socketId, email);
    return true;
  }
  return false;
};

export const isModeratorAuthenticated = (socketId: string): boolean => {
  const email = socketToEmail.get(socketId);
  return email ? tokenStore.has(email) : false;
};

export const isEmailAuthenticated = (email: string): boolean =>
  tokenStore.has(email);

export const getModeratorEmail = (socketId: string): string | undefined =>
  socketToEmail.get(socketId);

export const clearModeratorTokens = (socketId: string) => {
  const email = socketToEmail.get(socketId);
  if (email) {
    tokenStore.delete(email);
    for (const [sid, e] of socketToEmail.entries()) {
      if (e === email) socketToEmail.delete(sid);
    }
  }
  socketToEmail.delete(socketId);
};

export const onSocketDisconnect = (socketId: string) => {
  socketToEmail.delete(socketId);
};

const getClientForModerator = (socketId: string): OAuth2Client | null => {
  const email = socketToEmail.get(socketId);
  if (!email) return null;
  const tokens = tokenStore.get(email);
  if (!tokens) return null;
  const client = createOAuth2Client(resolveRedirectUri());
  client.setCredentials(tokens);
  client.on('tokens', (newTokens) => {
    const existing = tokenStore.get(email);
    tokenStore.set(email, { ...existing, ...newTokens });
  });
  return client;
};

// ── Drive folder management ──────────────────────────────────────────
const ROOT_FOLDER_NAME = 'Turing Test Research';
const folderCache = new Map<string, { rootId: string; dateId: string; date: string }>();

const findOrCreateFolder = async (
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> => {
  let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;

  const res = await drive.files.list({ q, fields: 'files(id)', spaces: 'drive' });
  if (res.data.files?.length) return res.data.files[0].id!;

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    },
    fields: 'id',
  });
  console.log(`[GDRIVE] Created folder: ${name}`);
  return folder.data.id!;
};

const getDayFolder = async (email: string, auth: OAuth2Client): Promise<string> => {
  const today = new Date().toISOString().slice(0, 10);
  const cached = folderCache.get(email);
  if (cached && cached.date === today) return cached.dateId;

  const drive = google.drive({ version: 'v3', auth });
  const rootId = cached?.rootId || await findOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const dateId = await findOrCreateFolder(drive, today, rootId);
  folderCache.set(email, { rootId, dateId, date: today });
  return dateId;
};

// ── Session doc/sheet tracking ───────────────────────────────────────
interface SessionFiles { docId: string; sheetId: string }
const fileCache = new Map<string, SessionFiles>();

const fileKey = (email: string, sessionId: string) =>
  `${email}:${sessionId}:${new Date().toISOString().slice(0, 10)}`;

// ── Create files ─────────────────────────────────────────────────────

const getOrCreateFiles = async (
  email: string,
  sessionId: string,
  condition: string | undefined,
  auth: OAuth2Client
): Promise<SessionFiles> => {
  const key = fileKey(email, sessionId);
  const cached = fileCache.get(key);
  if (cached) return cached;

  const folderId = await getDayFolder(email, auth);
  const today = new Date().toISOString().slice(0, 10);
  const shortId = sessionId.slice(-8);
  const condLabel = condition || 'unknown';
  const drive = google.drive({ version: 'v3', auth });

  // Create Google Doc with initial content via media upload.
  // This uses the Drive API only (no Docs API needed).
  const docTitle = `Chat - ${shortId} - ${condLabel} - ${today}`;
  const initialText = `Chat Transcript - Session ${shortId}\n${today}\n\n`;

  const docRes = await drive.files.create({
    requestBody: {
      name: docTitle,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    },
    media: {
      mimeType: 'text/plain',
      body: Readable.from([initialText]),
    },
    fields: 'id',
  });
  const docId = docRes.data.id!;

  // Create Google Sheet with header row
  const sheetTitle = `Data - ${shortId} - ${condLabel} - ${today}`;
  const sheetRes = await drive.files.create({
    requestBody: {
      name: sheetTitle,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    },
    fields: 'id',
  });
  const sheetId = sheetRes.data.id!;

  // Write header row
  try {
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: 'Sheet1!A1:F1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['Timestamp', 'Sender', 'Message', 'Session ID', 'Condition', 'Message ID']],
      },
    });
  } catch (err) {
    console.error(`[GDRIVE] Sheet header write failed:`, err instanceof Error ? err.message : err);
  }

  const result = { docId, sheetId };
  fileCache.set(key, result);
  console.log(`[GDRIVE] Created Doc (${docId}) + Sheet (${sheetId}) for ${shortId}`);
  return result;
};

// ── Append text to a Google Doc via Drive API export/update ──────────
// Uses Drive API to download current content, append, and re-upload.
// This avoids the Docs API entirely.
const appendToDoc = async (
  drive: ReturnType<typeof google.drive>,
  docId: string,
  text: string
): Promise<void> => {
  // Export current doc content as plain text
  let existing = '';
  try {
    const exportRes = await drive.files.export({
      fileId: docId,
      mimeType: 'text/plain',
    });
    existing = String(exportRes.data || '');
  } catch {
    // New doc or export failed — start fresh
  }

  const updated = existing + text;

  await drive.files.update({
    fileId: docId,
    media: {
      mimeType: 'text/plain',
      body: Readable.from([updated]),
    },
  });
};

// ── Format a message for the doc ─────────────────────────────────────
const formatMessage = (msg: ChatMessageForExport): string => {
  const label = msg.sender === 'participant' ? 'Participant' : 'AI/Moderator';
  return `${label}: ${msg.content}\n\n`;
};

// ── Public API ───────────────────────────────────────────────────────

export interface ChatMessageForExport {
  id: string;
  content: string;
  sender: 'participant' | 'moderator';
  timestamp: Date;
}

/** Auto-save a single message in real time. */
export const autoSaveMessageToGoogleDrive = async (
  moderatorSocketId: string,
  sessionId: string,
  condition: string | undefined,
  message: ChatMessageForExport
): Promise<boolean> => {
  const email = socketToEmail.get(moderatorSocketId);
  if (!email) return false;
  const auth = getClientForModerator(moderatorSocketId);
  if (!auth) return false;

  try {
    const { docId, sheetId } = await getOrCreateFiles(email, sessionId, condition, auth);
    const drive = google.drive({ version: 'v3', auth });

    // Append to doc
    await appendToDoc(drive, docId, formatMessage(message));
    console.log(`[GDRIVE] Doc append OK - ${sessionId.slice(-8)}`);

    // Append to sheet
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Sheet1!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[
          new Date(message.timestamp).toISOString(),
          message.sender,
          message.content,
          sessionId,
          condition || 'unknown',
          message.id,
        ]],
      },
    });
    console.log(`[GDRIVE] Sheet append OK - ${sessionId.slice(-8)}`);

    return true;
  } catch (err) {
    console.error(`[GDRIVE] autoSave error:`, err instanceof Error ? err.message : err);
    return false;
  }
};

/** Batch export an entire session's messages. */
export const exportSessionToGoogleDrive = async (
  moderatorSocketId: string,
  sessionId: string,
  condition: string | undefined,
  messages: ChatMessageForExport[]
): Promise<boolean> => {
  const email = socketToEmail.get(moderatorSocketId);
  if (!email) {
    console.error(`[GDRIVE] exportSession: no email for socket ${moderatorSocketId}`);
    return false;
  }
  const auth = getClientForModerator(moderatorSocketId);
  if (!auth) {
    console.error(`[GDRIVE] exportSession: no auth for socket ${moderatorSocketId}`);
    return false;
  }

  console.log(`[GDRIVE] Exporting ${messages.length} messages for session ${sessionId.slice(-8)}`);

  try {
    const { docId, sheetId } = await getOrCreateFiles(email, sessionId, condition, auth);
    const drive = google.drive({ version: 'v3', auth });

    // Build full doc text — just participant/moderator messages
    const docText = messages.map(formatMessage).join('');
    if (docText) {
      await appendToDoc(drive, docId, docText);
      console.log(`[GDRIVE] Doc batch write OK - ${docId}`);
    }

    // Append all rows to sheet
    const rows = messages.map(m => [
      new Date(m.timestamp).toISOString(),
      m.sender,
      m.content,
      sessionId,
      condition || 'unknown',
      m.id,
    ]);
    if (rows.length) {
      const sheets = google.sheets({ version: 'v4', auth });
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1!A:F',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: rows },
      });
      console.log(`[GDRIVE] Sheet batch write OK - ${sheetId}`);
    }

    console.log(`[GDRIVE] Exported ${messages.length} messages for ${sessionId.slice(-8)}`);
    return true;
  } catch (err) {
    console.error(`[GDRIVE] exportSession error:`, err instanceof Error ? err.message : err);
    return false;
  }
};

export const getAuthenticatedModeratorIds = (): string[] =>
  Array.from(socketToEmail.keys()).filter(sid => {
    const email = socketToEmail.get(sid);
    return email && tokenStore.has(email);
  });
