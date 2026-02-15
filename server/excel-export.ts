import ExcelJS from 'exceljs';
import { promises as fs } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

/**
 * Excel Export Module for Research Data
 * Fallback export to Excel (.xlsx) files
 * Compliant with Indiana University research guidelines
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const exportsDir = resolve(__dirname, '../exports');

// Master workbook path for continuous export
const MASTER_EXCEL_PATH = resolve(exportsDir, 'research_data_master.xlsx');

// Serialize all Excel write operations to prevent concurrent read-modify-write races.
// Without this, two near-simultaneous messages can both read the same file state,
// and the second write silently drops the first message's row.
let writeQueue: Promise<void> = Promise.resolve();
const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
  const result = writeQueue.then(fn, fn);
  writeQueue = result.then(() => {}, () => {});
  return result;
};

/**
 * Ensure exports directory exists
 */
const ensureExportsDirExists = async () => {
  try {
    await fs.mkdir(exportsDir, { recursive: true });
  } catch (err) {
    console.error('[EXCEL] Error creating exports directory:', err);
  }
};

/**
 * Initialize or get master Excel workbook
 */
const getOrCreateMasterWorkbook = async (): Promise<ExcelJS.Workbook> => {
  try {
    const workbook = new ExcelJS.Workbook();

    // Try to read existing master file
    try {
      await workbook.xlsx.readFile(MASTER_EXCEL_PATH);
      console.log('[EXCEL] Opened existing master workbook');
      return workbook;
    } catch {
      // File doesn't exist, create new one
      console.log('[EXCEL] Creating new master workbook');

      // Create Messages sheet
      const messagesSheet = workbook.addWorksheet('Messages');
      messagesSheet.columns = [
        { header: 'Session ID', key: 'sessionId', width: 25 },
        { header: 'Message ID', key: 'messageId', width: 30 },
        { header: 'Sender', key: 'sender', width: 12 },
        { header: 'Content', key: 'content', width: 50 },
        { header: 'Timestamp', key: 'timestamp', width: 25 },
        { header: 'Partner Type', key: 'partnerType', width: 12 }
      ];

      // Style header row
      messagesSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      messagesSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };

      // Create Sessions sheet
      const sessionsSheet = workbook.addWorksheet('Sessions');
      sessionsSheet.columns = [
        { header: 'Session ID', key: 'sessionId', width: 25 },
        { header: 'Participant ID', key: 'participantId', width: 25 },
        { header: 'Partner Type', key: 'partnerType', width: 12 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Total Messages', key: 'totalMessages', width: 15 },
        { header: 'Participant Messages', key: 'participantMessages', width: 20 },
        { header: 'Moderator Messages', key: 'moderatorMessages', width: 18 },
        { header: 'Duration (minutes)', key: 'duration', width: 18 },
        { header: 'Start Time', key: 'startTime', width: 25 },
        { header: 'End Time', key: 'endTime', width: 25 },
        { header: 'Moderator ID', key: 'moderatorId', width: 25 }
      ];

      // Style header row
      sessionsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sessionsSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };

      // Create Summary sheet
      const summarySheet = workbook.addWorksheet('Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 25 },
        { header: 'Value', key: 'value', width: 20 }
      ];

      // Add metadata
      summarySheet.addRow({ metric: 'Export Date', value: new Date().toISOString() });
      summarySheet.addRow({ metric: 'Total Sessions', value: 0 });
      summarySheet.addRow({ metric: 'Total Messages', value: 0 });
      summarySheet.addRow({ metric: 'Human Partner Sessions', value: 0 });
      summarySheet.addRow({ metric: 'LLM Partner Sessions', value: 0 });

      // Style header row
      summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summarySheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC5504D' } };

      await workbook.xlsx.writeFile(MASTER_EXCEL_PATH);
      console.log('[EXCEL] Master workbook created');
      return workbook;
    }
  } catch (err) {
    console.error('[EXCEL] Error initializing workbook:', err);
    throw err;
  }
};

/**
 * Add message row to Excel workbook
 */
export const exportMessageToExcel = (
  message: {
    id: string;
    content: string;
    sender: 'participant' | 'moderator';
    timestamp: Date;
  },
  sessionId: string,
  partnerType?: 'human' | 'llm'
): Promise<boolean> => enqueue(async () => {
  try {
    await ensureExportsDirExists();
    const workbook = await getOrCreateMasterWorkbook();
    const messagesSheet = workbook.getWorksheet('Messages');

    if (!messagesSheet) {
      console.error('[EXCEL] Messages sheet not found');
      return false;
    }

    messagesSheet.addRow({
      sessionId,
      messageId: message.id,
      sender: message.sender,
      content: message.content,
      timestamp: new Date(message.timestamp).toISOString(),
      partnerType: partnerType || 'N/A'
    });

    await workbook.xlsx.writeFile(MASTER_EXCEL_PATH);
    console.log(`[EXCEL] Message exported - Session: ${sessionId}, Sender: ${message.sender}`);
    return true;
  } catch (err) {
    console.error('[EXCEL] Error exporting message:', err);
    return false;
  }
});

/**
 * Add session summary row to Excel workbook
 */
export const exportSessionSummaryToExcel = (
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
): Promise<boolean> => enqueue(async () => {
  try {
    await ensureExportsDirExists();
    const workbook = await getOrCreateMasterWorkbook();
    const sessionsSheet = workbook.getWorksheet('Sessions');

    if (!sessionsSheet) {
      console.error('[EXCEL] Sessions sheet not found');
      return false;
    }

    // Calculate session stats
    const totalMessages = session.messages.length;
    const participantMessages = session.messages.filter(m => m.sender === 'participant').length;
    const moderatorMessages = session.messages.filter(m => m.sender === 'moderator').length;
    const startTime = session.messages.length > 0 ? session.messages[0].timestamp : session.lastActivity;
    const endTime = session.lastActivity;
    const durationMinutes = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000);

    sessionsSheet.addRow({
      sessionId,
      participantId: session.participantId,
      partnerType: session.partnerType || 'unknown',
      status: session.status,
      totalMessages,
      participantMessages,
      moderatorMessages,
      duration: durationMinutes,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      moderatorId: session.moderatorId || 'N/A'
    });

    // Update Summary sheet
    const summarySheet = workbook.getWorksheet('Summary');
    if (summarySheet) {
      const totalSessionsRow = summarySheet.getRow(3);
      const totalMessagesRow = summarySheet.getRow(4);

      if (totalSessionsRow) {
        const currentSessions = parseInt(totalSessionsRow.getCell(2).value as string) || 0;
        totalSessionsRow.getCell(2).value = currentSessions + 1;
      }

      if (totalMessagesRow) {
        const currentMessages = parseInt(totalMessagesRow.getCell(2).value as string) || 0;
        totalMessagesRow.getCell(2).value = currentMessages + totalMessages;
      }
    }

    await workbook.xlsx.writeFile(MASTER_EXCEL_PATH);
    console.log(`[EXCEL] Session summary exported - SessionID: ${sessionId}, Messages: ${totalMessages}`);
    return true;
  } catch (err) {
    console.error('[EXCEL] Error exporting session summary:', err);
    return false;
  }
});

/**
 * Get path to master Excel file
 */
export const getMasterExcelPath = (): string => {
  return MASTER_EXCEL_PATH;
};
