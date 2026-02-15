import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';

// ── Environment ──────────────────────────────────────────────────────
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const EXPLICIT_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || '';
const CALLBACK_PATH = '/auth/google/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/userinfo.email',
];

export const isGoogleDriveConfigured = () =>
  Boolean(CLIENT_ID && CLIENT_SECRET);

// ── Token storage keyed by email (survives socket reconnects) ────────
// email → tokens
const tokenStore = new Map<string, Credentials>();
// socketId → email (current session mapping)
const socketToEmail = new Map<string, string>();
// OAuth state → { socketId, redirectUri }
const pendingOAuth = new Map<string, { socketId: string; redirectUri: string }>();

// ── OAuth helpers ────────────────────────────────────────────────────

const createOAuth2Client = (redirectUri: string): OAuth2Client =>
  new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);

const resolveRedirectUri = (origin?: string): string => {
  if (EXPLICIT_REDIRECT_URI) return EXPLICIT_REDIRECT_URI;
  if (origin) return `${origin.replace(/\/$/, '')}${CALLBACK_PATH}`;
  return `http://localhost:3000${CALLBACK_PATH}`;
};

/** Generate the consent URL for a moderator. */
export const getAuthUrl = (socketId: string, origin?: string): string => {
  const redirectUri = resolveRedirectUri(origin);
  const client = createOAuth2Client(redirectUri);
  const state = `${socketId}_${Date.now()}`;
  pendingOAuth.set(state, { socketId, redirectUri });

  const url = client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
    state,
  });

  console.log(`[GDRIVE] Auth URL generated. redirect_uri=${redirectUri}`);
  return url;
};

/** Exchange the callback code for tokens. Returns the email. */
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

  // Fetch email
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email || 'unknown';

  // Store tokens keyed by email (persistent across socket reconnects)
  tokenStore.set(email, tokens);
  socketToEmail.set(socketId, email);

  console.log(`[GDRIVE] Authenticated: ${email} (socket ${socketId})`);
  return { socketId, email };
};

/**
 * Link a new socket ID to an existing email's tokens.
 * Called when a moderator reconnects and provides their email.
 */
export const linkSocketToEmail = (socketId: string, email: string): boolean => {
  if (tokenStore.has(email)) {
    socketToEmail.set(socketId, email);
    console.log(`[GDRIVE] Socket ${socketId} linked to ${email}`);
    return true;
  }
  return false;
};

/** Check if a moderator (by socket) has valid tokens. */
export const isModeratorAuthenticated = (socketId: string): boolean => {
  const email = socketToEmail.get(socketId);
  return email ? tokenStore.has(email) : false;
};

/** Check if an email has valid tokens (for reconnection). */
export const isEmailAuthenticated = (email: string): boolean =>
  tokenStore.has(email);

/** Get the email for a socket. */
export const getModeratorEmail = (socketId: string): string | undefined =>
  socketToEmail.get(socketId);

/** Disconnect a moderator's Google account. */
export const clearModeratorTokens = (socketId: string) => {
  const email = socketToEmail.get(socketId);
  if (email) {
    tokenStore.delete(email);
    // Remove all socket mappings for this email
    for (const [sid, e] of socketToEmail.entries()) {
      if (e === email) socketToEmail.delete(sid);
    }
  }
  socketToEmail.delete(socketId);
};

/** Clean up socket mapping on disconnect (keep tokens for reconnect). */
export const onSocketDisconnect = (socketId: string) => {
  socketToEmail.delete(socketId);
};

/** Get an authenticated OAuth2Client for a moderator socket. */
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
const folderCache = new Map<string, { rootFolderId: string; dateFolderId: string; date: string }>();
const ROOT_FOLDER_NAME = 'Turing Test Research';

const getOrCreateFolder = async (
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> => {
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const res = await drive.files.list({ q: query, fields: 'files(id,name)', spaces: 'drive' });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

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
  if (cached && cached.date === today) return cached.dateFolderId;

  const drive = google.drive({ version: 'v3', auth });
  const rootFolderId = cached?.rootFolderId || await getOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const dateFolderId = await getOrCreateFolder(drive, today, rootFolderId);

  folderCache.set(email, { rootFolderId, dateFolderId, date: today });
  return dateFolderId;
};

// ── Doc/Sheet tracking per session ───────────────────────────────────
interface SessionDocs { docId: string; sheetId: string }
const sessionDocsCache = new Map<string, SessionDocs>();

const cacheKey = (email: string, sessionId: string) => {
  const today = new Date().toISOString().slice(0, 10);
  return `${email}:${sessionId}:${today}`;
};

const getOrCreateSessionDocs = async (
  email: string,
  sessionId: string,
  condition: string | undefined,
  auth: OAuth2Client
): Promise<SessionDocs> => {
  const key = cacheKey(email, sessionId);
  const cached = sessionDocsCache.get(key);
  if (cached) return cached;

  const folderId = await getDayFolder(email, auth);
  const today = new Date().toISOString().slice(0, 10);
  const shortId = sessionId.slice(-8);
  const condLabel = condition || 'unknown';

  const drive = google.drive({ version: 'v3', auth });

  // Create Google Doc
  const doc = await drive.files.create({
    requestBody: {
      name: `Chat - ${shortId} - ${condLabel} - ${today}`,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId],
    },
    fields: 'id',
  });
  const docId = doc.data.id!;

  // Create Google Sheet
  const sheet = await drive.files.create({
    requestBody: {
      name: `Data - ${shortId} - ${condLabel} - ${today}`,
      mimeType: 'application/vnd.google-apps.spreadsheet',
      parents: [folderId],
    },
    fields: 'id',
  });
  const sheetId = sheet.data.id!;

  // Cache immediately after file creation so we don't create duplicates
  // if the content write below fails
  const result = { docId, sheetId };
  sessionDocsCache.set(key, result);
  console.log(`[GDRIVE] Created Doc (${docId}) and Sheet (${sheetId}) for session ${shortId}`);

  // Write header content (non-fatal if this fails — files still exist)
  try {
    const docs = google.docs({ version: 'v1', auth });
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: 1 },
            text: `Chat Transcript\nSession: ${sessionId}\nCondition: ${condLabel}\nDate: ${today}\n\n`,
          },
        }],
      },
    });
  } catch (err) {
    console.error(`[GDRIVE] Warning: failed to write doc header for ${docId}:`, err);
  }

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
    console.error(`[GDRIVE] Warning: failed to write sheet header for ${sheetId}:`, err);
  }

  return result;
};

// ── Public API ───────────────────────────────────────────────────────

export interface ChatMessageForExport {
  id: string;
  content: string;
  sender: 'participant' | 'moderator';
  timestamp: Date;
}

/** Auto-save a single message to the moderator's Google Drive. */
export const autoSaveMessageToGoogleDrive = async (
  moderatorSocketId: string,
  sessionId: string,
  condition: string | undefined,
  message: ChatMessageForExport
): Promise<boolean> => {
  const email = socketToEmail.get(moderatorSocketId);
  if (!email) { console.log('[GDRIVE] No email for socket', moderatorSocketId); return false; }
  const auth = getClientForModerator(moderatorSocketId);
  if (!auth) { console.log('[GDRIVE] No auth client for socket', moderatorSocketId); return false; }

  try {
    const { docId, sheetId } = await getOrCreateSessionDocs(email, sessionId, condition, auth);

    const timestamp = new Date(message.timestamp).toLocaleString();
    const senderLabel = message.sender === 'participant' ? 'Participant' : 'Moderator/AI';
    const docContent = `[${timestamp}] ${senderLabel}:\n${message.content}\n\n`;

    // Append to Google Doc
    try {
      const docs = google.docs({ version: 'v1', auth });
      const docMeta = await docs.documents.get({ documentId: docId });
      const endIndex = docMeta.data.body?.content?.slice(-1)?.[0]?.endIndex || 1;
      const insertAt = Math.max(1, endIndex - 1);

      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [{
            insertText: {
              location: { index: insertAt },
              text: docContent,
            },
          }],
        },
      });
      console.log(`[GDRIVE] Doc append OK - ${sessionId.slice(-8)}`);
    } catch (docErr) {
      console.error(`[GDRIVE] Doc append FAILED for ${docId}:`, docErr instanceof Error ? docErr.message : docErr);
    }

    // Append to Google Sheet
    try {
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
    } catch (sheetErr) {
      console.error(`[GDRIVE] Sheet append FAILED for ${sheetId}:`, sheetErr instanceof Error ? sheetErr.message : sheetErr);
    }

    return true;
  } catch (err) {
    console.error(`[GDRIVE] Error saving message:`, err instanceof Error ? err.message : err);
    return false;
  }
};

/**
 * Export an entire session's messages to Google Drive (batch).
 * Used for manual "Save to Google Drive" from the history tab.
 */
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

  console.log(`[GDRIVE] Exporting session ${sessionId.slice(-8)} (${messages.length} messages) for ${email}`);

  try {
    const { docId, sheetId } = await getOrCreateSessionDocs(email, sessionId, condition, auth);

    // Batch append all messages to Doc
    const docText = messages.map(m => {
      const ts = new Date(m.timestamp).toLocaleString();
      const label = m.sender === 'participant' ? 'Participant' : 'Moderator/AI';
      return `[${ts}] ${label}:\n${m.content}\n\n`;
    }).join('');

    if (docText) {
      try {
        const docs = google.docs({ version: 'v1', auth });
        const docMeta = await docs.documents.get({ documentId: docId });
        const endIndex = docMeta.data.body?.content?.slice(-1)?.[0]?.endIndex || 1;
        const insertAt = Math.max(1, endIndex - 1);

        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: {
            requests: [{
              insertText: {
                location: { index: insertAt },
                text: docText,
              },
            }],
          },
        });
        console.log(`[GDRIVE] Doc batch write OK - ${docId}`);
      } catch (docErr) {
        console.error(`[GDRIVE] Doc batch write FAILED for ${docId}:`, docErr instanceof Error ? docErr.message : docErr);
      }
    }

    // Batch append all messages to Sheet
    const rows = messages.map(m => [
      new Date(m.timestamp).toISOString(),
      m.sender,
      m.content,
      sessionId,
      condition || 'unknown',
      m.id,
    ]);

    if (rows.length) {
      try {
        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Sheet1!A:F',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: rows },
        });
        console.log(`[GDRIVE] Sheet batch write OK - ${sheetId}`);
      } catch (sheetErr) {
        console.error(`[GDRIVE] Sheet batch write FAILED for ${sheetId}:`, sheetErr instanceof Error ? sheetErr.message : sheetErr);
      }
    }

    console.log(`[GDRIVE] Batch exported ${messages.length} messages for session ${sessionId.slice(-8)}`);
    return true;
  } catch (err) {
    console.error(`[GDRIVE] Error in exportSession:`, err instanceof Error ? err.message : err);
    return false;
  }
};

export const getAuthenticatedModeratorIds = (): string[] =>
  Array.from(socketToEmail.keys()).filter(sid => {
    const email = socketToEmail.get(sid);
    return email && tokenStore.has(email);
  });
