import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../../data/foresight.db');

let db;

/**
 * Initialize the SQLite database with schema
 */
export function initializeDatabase() {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS signals (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      source TEXT NOT NULL,
      source_type TEXT NOT NULL, -- 'rss' or 'web'
      title TEXT NOT NULL,
      link TEXT,
      summary TEXT,
      published_at DATETIME,
      captured_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      relevance_score INTEGER NOT NULL,
      urgency_level TEXT NOT NULL, -- 'act_now', 'this_week', 'monitor', 'background'
      cross_domain_connections TEXT, -- JSON array of connected domain codes
      processed BOOLEAN NOT NULL DEFAULT 0,
      processed_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_signals_domain ON signals(domain);
    CREATE INDEX IF NOT EXISTS idx_signals_processed ON signals(processed);
    CREATE INDEX IF NOT EXISTS idx_signals_relevance ON signals(relevance_score DESC);
    CREATE INDEX IF NOT EXISTS idx_signals_captured ON signals(captured_at DESC);

    CREATE TABLE IF NOT EXISTS insights (
      id TEXT PRIMARY KEY,
      domain TEXT NOT NULL,
      insight_type TEXT NOT NULL, -- 'signal', 'pattern', 'action_trigger', 'cross_domain'
      title TEXT NOT NULL,
      -- OPORD-inspired structure
      situation TEXT,           -- Context: what's emerging and why now
      implication TEXT,         -- Strategic meaning and moat potential
      execution TEXT,           -- JSON array of action steps
      resources TEXT,           -- JSON array of required resources
      timeline TEXT,            -- Execution window/urgency
      -- Legacy fields (kept for backwards compatibility)
      analysis TEXT,
      action_recommendation TEXT,
      relevance_score INTEGER NOT NULL,
      supporting_signal_ids TEXT, -- JSON array of signal IDs
      generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered BOOLEAN NOT NULL DEFAULT 0,
      delivered_at DATETIME,
      -- Action tracking
      action_status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'delegated', 'dismissed'
      action_notes TEXT,
      action_updated_at DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_insights_type ON insights(insight_type);
    CREATE INDEX IF NOT EXISTS idx_insights_generated ON insights(generated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_insights_score ON insights(relevance_score DESC);

    CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY,
      insight_id TEXT NOT NULL,
      rating INTEGER, -- 1-5 scale
      action_taken TEXT, -- 'acted_on', 'saved', 'irrelevant', 'dismissed'
      notes TEXT,
      submitted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (insight_id) REFERENCES insights(id)
    );

    CREATE INDEX IF NOT EXISTS idx_feedback_insight ON feedback(insight_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_submitted ON feedback(submitted_at DESC);

    CREATE TABLE IF NOT EXISTS learned_weights (
      id TEXT PRIMARY KEY,
      dimension_type TEXT NOT NULL, -- 'domain', 'source', 'insight_type'
      dimension_value TEXT NOT NULL,
      weight_adjustment REAL NOT NULL DEFAULT 0.0,
      total_feedback_count INTEGER NOT NULL DEFAULT 0,
      last_updated DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(dimension_type, dimension_value)
    );

    CREATE INDEX IF NOT EXISTS idx_weights_dimension ON learned_weights(dimension_type, dimension_value);

    CREATE TABLE IF NOT EXISTS brief_log (
      id TEXT PRIMARY KEY,
      brief_date DATE NOT NULL UNIQUE,
      insight_ids TEXT NOT NULL, -- JSON array of insight IDs
      total_insights INTEGER NOT NULL,
      delivered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivery_status TEXT NOT NULL -- 'success', 'failed'
    );

    CREATE INDEX IF NOT EXISTS idx_brief_date ON brief_log(brief_date DESC);
  `);

  console.log('[database] Database initialized');
  return db;
}

/**
 * Close database connection gracefully
 */
export function closeDatabase() {
  if (db) {
    db.close();
    console.log('[database] Database closed');
  }
}

// ============================================================
// SIGNALS - CRUD Operations
// ============================================================

export function insertSignal(signal) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO signals (
      id, domain, source, source_type, title, link, summary,
      published_at, relevance_score, urgency_level, cross_domain_connections
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    signal.domain,
    signal.source,
    signal.sourceType,
    signal.title,
    signal.link,
    signal.summary || null,
    signal.publishedAt || null,
    signal.relevanceScore,
    signal.urgencyLevel,
    JSON.stringify(signal.crossDomainConnections || [])
  );

  return id;
}

export function getUnprocessedSignals(limit = 60) {
  const stmt = db.prepare(`
    SELECT * FROM signals
    WHERE processed = 0
    ORDER BY relevance_score DESC, captured_at DESC
    LIMIT ?
  `);

  return stmt.all(limit).map(row => ({
    ...row,
    crossDomainConnections: JSON.parse(row.cross_domain_connections || '[]'),
    processed: Boolean(row.processed)
  }));
}

export function markSignalsProcessed(signalIds) {
  const placeholders = signalIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    UPDATE signals
    SET processed = 1, processed_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `);

  return stmt.run(...signalIds);
}

export function getSignalsByDomain(domain) {
  const stmt = db.prepare('SELECT * FROM signals WHERE domain = ? ORDER BY captured_at DESC LIMIT 50');
  return stmt.all(domain);
}

// ============================================================
// INSIGHTS - CRUD Operations
// ============================================================

export function insertInsight(insight) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO insights (
      id, domain, insight_type, title,
      situation, implication, execution, resources, timeline,
      analysis, action_recommendation,
      relevance_score, supporting_signal_ids
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    insight.domain,
    insight.insightType,
    insight.title,
    insight.situation || null,
    insight.implication || null,
    JSON.stringify(insight.execution || []),
    JSON.stringify(insight.resources || []),
    insight.timeline || null,
    insight.analysis || null, // Legacy
    insight.actionRecommendation || null, // Legacy
    insight.relevanceScore,
    JSON.stringify(insight.supportingSignalIds || [])
  );

  return id;
}

export function getInsightById(insightId) {
  const stmt = db.prepare('SELECT * FROM insights WHERE id = ?');
  const row = stmt.get(insightId);

  if (!row) return null;

  return {
    ...row,
    execution: JSON.parse(row.execution || '[]'),
    resources: JSON.parse(row.resources || '[]'),
    supportingSignalIds: JSON.parse(row.supporting_signal_ids || '[]'),
    delivered: Boolean(row.delivered)
  };
}

/**
 * Update action status for an insight
 */
export function updateInsightAction(insightId, actionStatus, actionNotes = null) {
  const stmt = db.prepare(`
    UPDATE insights
    SET action_status = ?,
        action_notes = ?,
        action_updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  return stmt.run(actionStatus, actionNotes, insightId);
}

export function getUndeliveredInsights(limit = 20) {
  const stmt = db.prepare(`
    SELECT * FROM insights
    WHERE delivered = 0
    ORDER BY insight_type = 'action_trigger' DESC,
             insight_type = 'cross_domain' DESC,
             relevance_score DESC,
             generated_at DESC
    LIMIT ?
  `);

  return stmt.all(limit).map(row => ({
    ...row,
    execution: JSON.parse(row.execution || '[]'),
    resources: JSON.parse(row.resources || '[]'),
    supportingSignalIds: JSON.parse(row.supporting_signal_ids || '[]'),
    delivered: Boolean(row.delivered)
  }));
}

export function markInsightsDelivered(insightIds) {
  const placeholders = insightIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    UPDATE insights
    SET delivered = 1, delivered_at = CURRENT_TIMESTAMP
    WHERE id IN (${placeholders})
  `);

  return stmt.run(...insightIds);
}

// ============================================================
// FEEDBACK - CRUD Operations
// ============================================================

export function insertFeedback(feedback) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO feedback (id, insight_id, rating, action_taken, notes)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    feedback.insightId,
    feedback.rating || null,
    feedback.actionTaken || null,
    feedback.notes || null
  );

  // Update learned weights based on this feedback
  updateLearnedWeights(feedback.insightId, feedback.rating, feedback.actionTaken);

  return id;
}

export function getFeedbackByInsight(insightId) {
  const stmt = db.prepare('SELECT * FROM feedback WHERE insight_id = ? ORDER BY submitted_at DESC');
  return stmt.all(insightId);
}

export function getAllFeedbackStats() {
  const stmt = db.prepare(`
    SELECT
      i.domain,
      COUNT(*) as total_feedback,
      AVG(f.rating) as avg_rating,
      SUM(CASE WHEN f.action_taken = 'acted_on' THEN 1 ELSE 0 END) as acted_on_count,
      SUM(CASE WHEN f.action_taken = 'irrelevant' THEN 1 ELSE 0 END) as irrelevant_count
    FROM feedback f
    JOIN insights i ON f.insight_id = i.id
    WHERE f.rating IS NOT NULL OR f.action_taken IS NOT NULL
    GROUP BY i.domain
  `);

  return stmt.all();
}

// ============================================================
// LEARNED WEIGHTS - Adaptive Learning System
// ============================================================

/**
 * Update learned weights based on user feedback
 * This is the core of the learning system - it adjusts scoring weights
 * for domains, sources, and insight types based on user ratings and actions
 */
export function updateLearnedWeights(insightId, rating, actionTaken) {
  const insight = getInsightById(insightId);
  if (!insight) return;

  // Calculate weight adjustments
  let adjustment = 0;

  if (rating) {
    // Rating 4-5: positive signal (boost)
    // Rating 3: neutral
    // Rating 1-2: negative signal (penalize)
    if (rating >= 4) {
      adjustment = 0.1 * (rating - 3); // +0.1 for 4, +0.2 for 5
    } else if (rating <= 2) {
      adjustment = -0.1 * (3 - rating); // -0.1 for 2, -0.2 for 1
    }
  }

  if (actionTaken === 'acted_on') {
    adjustment += 0.2; // Strong positive signal
  } else if (actionTaken === 'irrelevant') {
    adjustment -= 0.2; // Strong negative signal
  }

  // Only update if there's a meaningful adjustment
  if (adjustment !== 0) {
    // Update domain weight
    upsertWeight('domain', insight.domain, adjustment);

    // Update insight type weight
    upsertWeight('insight_type', insight.insight_type, adjustment);
  }
}

function upsertWeight(dimensionType, dimensionValue, adjustment) {
  const stmt = db.prepare(`
    INSERT INTO learned_weights (id, dimension_type, dimension_value, weight_adjustment, total_feedback_count, last_updated)
    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(dimension_type, dimension_value) DO UPDATE SET
      weight_adjustment = weight_adjustment + ?,
      total_feedback_count = total_feedback_count + 1,
      last_updated = CURRENT_TIMESTAMP
  `);

  stmt.run(uuidv4(), dimensionType, dimensionValue, adjustment, adjustment);
}

export function getLearnedWeight(dimensionType, dimensionValue) {
  const stmt = db.prepare(`
    SELECT weight_adjustment FROM learned_weights
    WHERE dimension_type = ? AND dimension_value = ?
  `);

  const result = stmt.get(dimensionType, dimensionValue);
  return result ? result.weight_adjustment : 0;
}

export function getAllLearnedWeights() {
  const stmt = db.prepare('SELECT * FROM learned_weights ORDER BY dimension_type, weight_adjustment DESC');
  return stmt.all();
}

// ============================================================
// BRIEF LOG - Delivery Tracking
// ============================================================

export function insertBriefLog(briefDate, insightIds, deliveryStatus) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO brief_log (id, brief_date, insight_ids, total_insights, delivery_status)
    VALUES (?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    briefDate,
    JSON.stringify(insightIds),
    insightIds.length,
    deliveryStatus
  );

  return id;
}

export function getBriefsByDate(startDate, endDate) {
  const stmt = db.prepare(`
    SELECT * FROM brief_log
    WHERE brief_date BETWEEN ? AND ?
    ORDER BY brief_date DESC
  `);

  return stmt.all(startDate, endDate).map(row => ({
    ...row,
    insightIds: JSON.parse(row.insight_ids)
  }));
}

// ============================================================
// ANALYTICS QUERIES
// ============================================================

export function getDashboardStats() {
  const stats = {
    signals: db.prepare('SELECT COUNT(*) as count FROM signals').get(),
    unprocessedSignals: db.prepare('SELECT COUNT(*) as count FROM signals WHERE processed = 0').get(),
    insights: db.prepare('SELECT COUNT(*) as count FROM insights').get(),
    feedbackCount: db.prepare('SELECT COUNT(*) as count FROM feedback').get(),
    avgRating: db.prepare('SELECT AVG(rating) as avg FROM feedback WHERE rating IS NOT NULL').get(),
    domainBreakdown: db.prepare(`
      SELECT domain, COUNT(*) as count, AVG(relevance_score) as avg_score
      FROM signals
      GROUP BY domain
    `).all(),
    recentBriefs: db.prepare(`
      SELECT * FROM brief_log
      ORDER BY brief_date DESC
      LIMIT 7
    `).all()
  };

  return stats;
}

export function getRecentInsightsWithFeedback(limit = 20) {
  const stmt = db.prepare(`
    SELECT
      i.*,
      f.rating,
      f.action_taken,
      f.submitted_at as feedback_at
    FROM insights i
    LEFT JOIN feedback f ON i.id = f.insight_id
    ORDER BY i.generated_at DESC
    LIMIT ?
  `);

  return stmt.all(limit).map(row => ({
    ...row,
    execution: JSON.parse(row.execution || '[]'),
    resources: JSON.parse(row.resources || '[]'),
    supportingSignalIds: JSON.parse(row.supporting_signal_ids || '[]'),
    delivered: Boolean(row.delivered)
  }));
}
