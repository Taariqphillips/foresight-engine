import 'dotenv/config';
import cron from 'node-cron';
import { initializeDatabase, closeDatabase, getUndeliveredInsights, markInsightsDelivered } from './config/database.js';
import { scanAllFeeds } from './scanners/rss-scanner.js';
import { runWebSearches } from './scanners/web-scanner.js';
import { synthesizeInsights } from './analysis/synthesis-engine.js';
import { sendDailyBrief, sendAlert } from './delivery/email-delivery.js';
import { createFeedbackServer } from './feedback/feedback-api.js';

// Configuration
const PORT = process.env.PORT || 3000;
const BRIEF_CRON = process.env.BRIEF_CRON || '15 4 * * *'; // 4:15 AM daily
const TIMEZONE = process.env.TIMEZONE || 'America/Chicago';
const ALERT_THRESHOLD = parseInt(process.env.ALERT_THRESHOLD || '85');

/**
 * Log with timestamp
 */
function log(message, data = null) {
  const timestamp = new Date().toISOString();
  if (data) {
    console.log(`[${timestamp}] ${message}`, data);
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * Run full scan: RSS + Web
 * Check for alert-threshold signals
 */
export async function runFullScan() {
  log('[SCAN] Starting full scan cycle');

  // Scan RSS feeds
  const rssResults = await scanAllFeeds();

  // Scan web (if NewsAPI configured)
  const webResults = await runWebSearches();

  const totalSignals = rssResults.totalSignals + webResults.totalSignals;

  log('[SCAN] Scan complete', {
    rss: rssResults.totalSignals,
    web: webResults.totalSignals,
    total: totalSignals
  });

  // Check for high-priority signals that warrant immediate alerts
  // (This would check if any new insights were auto-generated from high-scoring signals)
  // For simplicity, we'll synthesize and check afterward

  return {
    rssResults,
    webResults,
    totalSignals
  };
}

/**
 * Run full pipeline: Scan → Synthesize → Deliver
 */
export async function runFullPipeline() {
  log('[PIPELINE] Starting full pipeline');

  try {
    // Step 1: Scan for signals
    const scanResults = await runFullScan();

    // Step 2: Synthesize insights
    log('[PIPELINE] Synthesizing insights');
    const synthesisResults = await synthesizeInsights();

    // Step 3: Check for alert-threshold insights
    const alertInsights = getUndeliveredInsights(100).filter(
      insight => insight.relevance_score >= ALERT_THRESHOLD
    );

    if (alertInsights.length > 0) {
      log(`[PIPELINE] Found ${alertInsights.length} alert-threshold insights`);
      for (const insight of alertInsights) {
        await sendAlert(insight);
        // Mark as delivered so it doesn't send again in daily brief
        markInsightsDelivered([insight.id]);
      }
    }

    // Step 4: Get undelivered insights for daily brief
    const briefInsights = getUndeliveredInsights(20);

    if (briefInsights.length === 0) {
      log('[PIPELINE] No insights to deliver in brief');
      return {
        success: true,
        scanResults,
        synthesisResults,
        briefDelivered: false,
        alertsSent: alertInsights.length
      };
    }

    // Step 5: Send daily brief
    log(`[PIPELINE] Sending daily brief with ${briefInsights.length} insights`);
    const deliveryResult = await sendDailyBrief(briefInsights, scanResults);

    // Mark insights as delivered
    if (deliveryResult.success) {
      const insightIds = briefInsights.map(i => i.id);
      markInsightsDelivered(insightIds);
    }

    log('[PIPELINE] Pipeline complete', {
      totalSignals: scanResults.totalSignals,
      totalInsights: synthesisResults.totalInsights,
      briefDelivered: deliveryResult.success,
      alertsSent: alertInsights.length
    });

    return {
      success: true,
      scanResults,
      synthesisResults,
      deliveryResult,
      alertsSent: alertInsights.length
    };
  } catch (error) {
    log('[PIPELINE] Pipeline failed', { error: error.message });
    throw error;
  }
}

/**
 * Main entry point
 */
async function main() {
  log('='.repeat(60));
  log('FORESIGHT ENGINE — STRATEGIC INTELLIGENCE SYSTEM');
  log('='.repeat(60));

  // Initialize database
  log('[INIT] Initializing database');
  initializeDatabase();

  // Create Express server for feedback
  const app = createFeedbackServer();

  // Add manual trigger endpoints
  app.post('/trigger/scan', async (req, res) => {
    try {
      log('[TRIGGER] Manual scan triggered');
      const results = await runFullScan();
      res.json({ success: true, results });
    } catch (error) {
      log('[TRIGGER] Scan failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/trigger/brief', async (req, res) => {
    try {
      log('[TRIGGER] Manual pipeline triggered');
      const results = await runFullPipeline();
      res.json({ success: true, results });
    } catch (error) {
      log('[TRIGGER] Pipeline failed', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Start server
  const server = app.listen(PORT, '0.0.0.0', () => {
    log(`[INIT] Server listening on port ${PORT}`);
    log(`[INIT] Dashboard: http://localhost:${PORT}/feedback?view=dashboard`);
    log(`[INIT] Health check: http://localhost:${PORT}/health`);
  });

  // Schedule daily brief
  log(`[INIT] Scheduling daily brief: ${BRIEF_CRON} (${TIMEZONE})`);
  cron.schedule(BRIEF_CRON, () => {
    log('[CRON] Daily brief triggered');
    runFullPipeline().catch(error => {
      log('[CRON] Pipeline failed', { error: error.message });
    });
  }, {
    timezone: TIMEZONE
  });

  // Schedule periodic scanning (every 4 hours)
  log('[INIT] Scheduling periodic scans: every 4 hours');
  cron.schedule('0 */4 * * *', () => {
    log('[CRON] Periodic scan triggered');
    runFullScan().catch(error => {
      log('[CRON] Scan failed', { error: error.message });
    });
  }, {
    timezone: TIMEZONE
  });

  log('[INIT] Foresight Engine operational');
  log(`[INIT] Alert threshold: ${ALERT_THRESHOLD}`);
  log('[INIT] Use POST /trigger/scan or POST /trigger/brief for manual testing');

  // Graceful shutdown
  const shutdown = async (signal) => {
    log(`[SHUTDOWN] Received ${signal}, shutting down gracefully`);

    server.close(() => {
      log('[SHUTDOWN] Server closed');
    });

    closeDatabase();

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('[FATAL] Startup failed:', error);
    process.exit(1);
  });
}
