import { google } from 'googleapis';
import { OAuth2Client, Credentials } from 'google-auth-library';

// ── Environment ──────────────────────────────────────────────────────
// Required env vars:
//   GOOGLE_CLIENT_ID      – OAuth 2.0 client ID
//   GOOGLE_CLIENT_SECRET  – OAuth 2.0 client secret
//   GOOGLE_REDIRECT_URI   – e.g. http://localhost:3000/auth/google/callback

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

// GOOGLE_REDIRECT_URI can be set explicitly, or auto-detected from the
// request origin at runtime (see getAuthUrl / handleAuthCallback).
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

// ── Per-moderator token store ────────────────────────────────────────
const tokenStore = new Map<string, Credentials>();
const emailStore = new Map<string, string>();
const pendingOAuth = new Map<string, { socketId: string; redirectUri: string }>();

// ── OAuth helpers ────────────────────────────────────────────────────

const createOAuth2Client = (redirectUri: string): OAuth2Client =>
  new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, redirectUri);

/**
 * Build the redirect URI from the request origin or env var.
 * `origin` is passed from the client (e.g. "https://myapp.com").
 */
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

/** Exchange the callback code for tokens. Returns the socket ID. */
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
  tokenStore.set(socketId, tokens);

  // Fetch the user's email for display
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  const email = data.email || 'unknown';
  emailStore.set(socketId, email);

  console.log(`[GDRIVE] Moderator ${socketId} authenticated as ${email}`);
  return { socketId, email };
};

/** Check if a moderator has valid tokens. */
export const isModeratorAuthenticated = (socketId: string): boolean =>
  tokenStore.has(socketId);

/** Get the email for a connected moderator. */
export const getModeratorEmail = (socketId: string): string | undefined =>
  emailStore.get(socketId);

/** Remove tokens when moderator disconnects. */
export const clearModeratorTokens = (socketId: string) => {
  tokenStore.delete(socketId);
  emailStore.delete(socketId);
};

/** Get an authenticated OAuth2Client for a moderator. */
const getClientForModerator = (socketId: string): OAuth2Client | null => {
  const tokens = tokenStore.get(socketId);
  if (!tokens) return null;
  // redirect_uri doesn't matter for API calls, only for token exchange
  const client = createOAuth2Client(resolveRedirectUri());
  client.setCredentials(tokens);
  client.on('tokens', (newTokens) => {
    const existing = tokenStore.get(socketId);
    tokenStore.set(socketId, { ...existing, ...newTokens });
  });
  return client;
};

// ── Drive folder management ──────────────────────────────────────────
// Cache: moderatorSocketId → { folderId, date }
const folderCache = new Map<string, { rootFolderId: string; dateFolderId: string; date: string }>();

const ROOT_FOLDER_NAME = 'Turing Test Research';

const getOrCreateFolder = async (
  drive: ReturnType<typeof google.drive>,
  name: string,
  parentId?: string
): Promise<string> => {
  // Search for existing folder
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const res = await drive.files.list({ q: query, fields: 'files(id,name)', spaces: 'drive' });
  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id!;
  }

  // Create folder
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

const getDayFolder = async (
  moderatorSocketId: string,
  auth: OAuth2Client
): Promise<string> => {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const cached = folderCache.get(moderatorSocketId);
  if (cached && cached.date === today) return cached.dateFolderId;

  const drive = google.drive({ version: 'v3', auth });
  const rootFolderId = cached?.rootFolderId || await getOrCreateFolder(drive, ROOT_FOLDER_NAME);
  const dateFolderId = await getOrCreateFolder(drive, today, rootFolderId);

  folderCache.set(moderatorSocketId, { rootFolderId, dateFolderId, date: today });
  return dateFolderId;
};

// ── Doc/Sheet tracking per session ───────────────────────────────────
// Key: `${moderatorSocketId}:${sessionId}:${date}`
interface SessionDocs {
  docId: string;
  sheetId: string;
}
const sessionDocsCache = new Map<string, SessionDocs>();

const cacheKey = (moderatorSocketId: string, sessionId: string) => {
  const today = new Date().toISOString().slice(0, 10);
  return `${moderatorSocketId}:${sessionId}:${today}`;
};

const getOrCreateSessionDocs = async (
  moderatorSocketId: string,
  sessionId: string,
  condition: string | undefined,
  auth: OAuth2Client
): Promise<SessionDocs> => {
  const key = cacheKey(moderatorSocketId, sessionId);
  const cached = sessionDocsCache.get(key);
  if (cached) return cached;

  const folderId = await getDayFolder(moderatorSocketId, auth);
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

  // Write doc header
  const docs = google.docs({ version: 'v1', auth });
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: `Chat Transcript\nSession: ${sessionId}\nCondition: ${condLabel}\nDate: ${today}\n\n`,
          },
        },
      ],
    },
  });

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

  // Write sheet header row
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.values.update({
    spreadsheetId: sheetId,
    range: 'Sheet1!A1:F1',
    valueInputOption: 'RAW',
    requestBody: {
      values: [['Timestamp', 'Sender', 'Message', 'Session ID', 'Condition', 'Message ID']],
    },
  });

  const result = { docId, sheetId };
  sessionDocsCache.set(key, result);
  console.log(`[GDRIVE] Created Doc (${docId}) and Sheet (${sheetId}) for session ${shortId}`);
  return result;
};

// ── Public API: auto-save a message ──────────────────────────────────

export interface ChatMessageForExport {
  id: string;
  content: string;
  sender: 'participant' | 'moderator';
  timestamp: Date;
}

/**
 * Auto-save a single message to the moderator's Google Drive.
 * Creates the day folder, Doc, and Sheet on first call per session per day.
 */
export const autoSaveMessageToGoogleDrive = async (
  moderatorSocketId: string,
  sessionId: string,
  condition: string | undefined,
  message: ChatMessageForExport
): Promise<boolean> => {
  const auth = getClientForModerator(moderatorSocketId);
  if (!auth) return false;

  try {
    const { docId, sheetId } = await getOrCreateSessionDocs(
      moderatorSocketId, sessionId, condition, auth
    );

    const timestamp = new Date(message.timestamp).toLocaleString();
    const senderLabel = message.sender === 'participant' ? 'Participant' : 'Moderator/AI';

    // Append to Google Doc
    const docs = google.docs({ version: 'v1', auth });
    const docContent = `[${timestamp}] ${senderLabel}:\n${message.content}\n\n`;
    // Get current doc length to append at end
    const docMeta = await docs.documents.get({ documentId: docId });
    const endIndex = docMeta.data.body?.content?.slice(-1)?.[0]?.endIndex || 1;
    const insertAt = Math.max(1, endIndex - 1);

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: insertAt },
              text: docContent,
            },
          },
        ],
      },
    });

    // Append to Google Sheet
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

    console.log(`[GDRIVE] Message saved - Session: ${sessionId.slice(-8)}, Sender: ${message.sender}`);
    return true;
  } catch (err) {
    console.error(`[GDRIVE] Error saving message:`, err);
    return false;
  }
};

/**
 * Get all moderator socket IDs that have Google Drive connected.
 */
export const getAuthenticatedModeratorIds = (): string[] =>
  Array.from(tokenStore.keys());
