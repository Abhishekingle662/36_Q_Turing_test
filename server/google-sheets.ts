import { google } from 'googleapis';
import { JWT } from 'google-auth-library';

/**
 * Google Sheets Integration for Research Data Export
 * Automatically exports chat messages to a shared Google Sheet
 * Compliant with Indiana University research guidelines
 */

// Environment variables needed:
// - GOOGLE_SERVICE_ACCOUNT_EMAIL: Service account email
// - GOOGLE_SERVICE_ACCOUNT_KEY: Base64-encoded private key JSON
// - GOOGLE_SHEETS_ID: Spreadsheet ID to export to

// Cache for JWT auth client
let authClient: JWT | null = null;

/**
 * Initialize Google Sheets authentication
 * Uses service account credentials from environment variables
 */
export const initializeGoogleSheets = (): boolean => {
  try {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKeyB64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountEmail || !serviceAccountKeyB64) {
      console.log('[GOOGLE-SHEETS] Service account credentials not configured. Skipping Google Sheets export.');
      return false;
    }

    // Decode base64 key
    const serviceAccountKeyJson = JSON.parse(Buffer.from(serviceAccountKeyB64, 'base64').toString('utf-8'));

    authClient = new JWT({
      email: serviceAccountEmail,
      key: serviceAccountKeyJson.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    console.log('[GOOGLE-SHEETS] Authentication initialized successfully');
    return true;
  } catch (err) {
    console.error('[GOOGLE-SHEETS] Failed to initialize authentication:', err);
    return false;
  }
};

/**
 * Create authenticated sheets instance
 */
const getAuthenticatedSheets = () => {
  if (!authClient) {
    throw new Error('Google Sheets not initialized');
  }
  return google.sheets({
    version: 'v4',
    auth: authClient
  });
};

/**
 * Export a single message to Google Sheets
 * Creates or updates row in Messages tab
 */
export const exportMessageToGoogleSheets = async (
  message: {
    id: string;
    content: string;
    sender: 'participant' | 'moderator';
    timestamp: Date;
  },
  sessionId: string,
  partnerType?: 'human' | 'llm'
): Promise<boolean> => {
  if (!authClient) {
    return false;
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return false;
    }

    // Append message row to Messages tab
    const timestamp = new Date(message.timestamp).toISOString();
    const values = [[
      sessionId,
      message.id,
      message.sender,
      message.content,
      timestamp,
      partnerType || 'N/A'
    ]];

    const sheets = getAuthenticatedSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Messages!A:F',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });
    console.log(`[GOOGLE-SHEETS] Message exported - Session: ${sessionId}, Sender: ${message.sender}`);
    return true;
  } catch (err) {
    console.error('[GOOGLE-SHEETS] Error exporting message:', err);
    return false;
  }
};

/**
 * Export complete session summary to Google Sheets
 * Creates or updates row in Sessions tab with aggregate data
 */
export const exportSessionSummaryToGoogleSheets = async (
  sessionId: string,
  session: {
    participantId: string;
    status: 'active' | 'inactive';
    lastActivity: Date;
    partnerType?: 'human' | 'llm';
    messages: Array<{
      id: string;
      content: string;
      sender: 'participant' | 'moderator';
      timestamp: Date;
    }>;
    moderatorId?: string;
  }
): Promise<boolean> => {
  if (!authClient) {
    return false;
  }

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return false;
    }

    // Calculate session stats
    const totalMessages = session.messages.length;
    const participantMessages = session.messages.filter(m => m.sender === 'participant').length;
    const moderatorMessages = session.messages.filter(m => m.sender === 'moderator').length;
    const startTime = session.messages.length > 0 ? session.messages[0].timestamp : session.lastActivity;
    const endTime = session.lastActivity;
    const durationMinutes = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);

    const values = [[
      sessionId,
      session.participantId,
      session.partnerType || 'unknown',
      session.status,
      totalMessages,
      participantMessages,
      moderatorMessages,
      durationMinutes,
      new Date(startTime).toISOString(),
      new Date(endTime).toISOString(),
      session.moderatorId || 'N/A'
    ]];

    const sheets = getAuthenticatedSheets();
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sessions!A:K',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values
      }
    });

    console.log(`[GOOGLE-SHEETS] Session summary exported - SessionID: ${sessionId}, Messages: ${totalMessages}`);
    return true;
  } catch (err) {
    console.error('[GOOGLE-SHEETS] Error exporting session summary:', err);
    return false;
  }
};

/**
 * Check if Google Sheets is properly configured
 */
export const isGoogleSheetsEnabled = (): boolean => {
  return authClient !== null && !!process.env.GOOGLE_SHEETS_ID;
};
