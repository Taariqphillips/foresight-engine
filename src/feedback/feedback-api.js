import express from 'express';
import {
  insertFeedback,
  getInsightById,
  getAllFeedbackStats,
  getAllLearnedWeights,
  getRecentInsightsWithFeedback,
  getDashboardStats,
  getBriefsByDate
} from '../config/database.js';

/**
 * Generate dashboard HTML
 */
function generateDashboardHTML(stats, recentInsights, learnedWeights) {
  const feedbackStats = stats.feedbackStats || [];
  const domainBreakdown = stats.domainBreakdown || [];

  const domainStatsHTML = feedbackStats.map(stat => `
    <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid #3B82F6;">
      <h3 style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #111827; text-transform: uppercase;">
        ${stat.domain}
      </h3>
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; font-size: 13px;">
        <div>
          <div style="color: #6B7280;">Avg Rating</div>
          <div style="font-size: 20px; font-weight: 700; color: #111827;">
            ${stat.avg_rating ? stat.avg_rating.toFixed(2) : 'N/A'}/5
          </div>
        </div>
        <div>
          <div style="color: #6B7280;">Total Feedback</div>
          <div style="font-size: 20px; font-weight: 700; color: #111827;">${stat.total_feedback}</div>
        </div>
        <div>
          <div style="color: #6B7280;">Acted On</div>
          <div style="font-size: 20px; font-weight: 700; color: #10B981;">${stat.acted_on_count}</div>
        </div>
        <div>
          <div style="color: #6B7280;">Irrelevant</div>
          <div style="font-size: 20px; font-weight: 700; color: #EF4444;">${stat.irrelevant_count}</div>
        </div>
      </div>
    </div>
  `).join('');

  const recentInsightsHTML = recentInsights.slice(0, 15).map(insight => {
    const ratingDisplay = insight.rating ? `${insight.rating}/5` : '-';
    const actionDisplay = insight.action_taken || '-';

    return `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #E5E7EB; font-size: 13px; color: #111827;">
          ${insight.title}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; text-transform: uppercase;">
          ${insight.domain}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #E5E7EB; font-size: 12px; color: #6B7280;">
          ${insight.insight_type}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #E5E7EB; font-size: 13px; color: #111827; font-weight: 600;">
          ${insight.relevance_score}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #E5E7EB; font-size: 13px; color: #111827;">
          ${ratingDisplay}
        </td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #E5E7EB; font-size: 12px; color: #6B7280;">
          ${actionDisplay}
        </td>
      </tr>
    `;
  }).join('');

  const weightsHTML = learnedWeights.map(weight => {
    const adjustmentValue = weight.weight_adjustment.toFixed(2);
    const isPositive = weight.weight_adjustment > 0;
    const color = isPositive ? '#10B981' : '#EF4444';
    const sign = isPositive ? '+' : '';

    return `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; font-size: 12px; color: #6B7280; text-transform: uppercase;">
          ${weight.dimension_type}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; font-size: 13px; color: #111827; font-weight: 500;">
          ${weight.dimension_value}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; font-size: 14px; font-weight: 700; color: ${color};">
          ${sign}${adjustmentValue}
        </td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #E5E7EB; font-size: 12px; color: #6B7280;">
          ${weight.total_feedback_count}
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Foresight Engine Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #F9FAFB; }
  </style>
</head>
<body>
  <div style="max-width: 1200px; margin: 0 auto; padding: 24px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1F2937 0%, #111827 100%); padding: 32px; border-radius: 12px; margin-bottom: 24px;">
      <h1 style="font-size: 32px; font-weight: 700; color: white; margin-bottom: 8px;">
        Foresight Engine Dashboard
      </h1>
      <div style="font-size: 14px; color: #D1D5DB;">
        Learning Intelligence System — Operational Status
      </div>
    </div>

    <!-- System Stats -->
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
      <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Total Signals</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827;">${stats.signals?.count || 0}</div>
        <div style="font-size: 11px; color: #10B981; margin-top: 4px;">${stats.unprocessedSignals?.count || 0} unprocessed</div>
      </div>
      <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Total Insights</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827;">${stats.insights?.count || 0}</div>
      </div>
      <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Feedback Count</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827;">${stats.feedbackCount?.count || 0}</div>
      </div>
      <div style="background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Avg Rating</div>
        <div style="font-size: 28px; font-weight: 700; color: #111827;">
          ${stats.avgRating?.avg ? stats.avgRating.avg.toFixed(2) : 'N/A'}
        </div>
      </div>
    </div>

    <!-- Domain Performance -->
    <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 16px;">Domain Performance</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px;">
        ${domainStatsHTML || '<div style="color: #6B7280;">No feedback data yet</div>'}
      </div>
    </div>

    <!-- Recent Insights -->
    <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 16px;">Recent Insights</h2>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #F9FAFB;">
              <th style="padding: 12px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Title</th>
              <th style="padding: 12px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Domain</th>
              <th style="padding: 12px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Type</th>
              <th style="padding: 12px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Score</th>
              <th style="padding: 12px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Rating</th>
              <th style="padding: 12px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${recentInsightsHTML || '<tr><td colspan="6" style="padding: 20px; text-align: center; color: #6B7280;">No insights yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Learned Weights -->
    <div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 8px;">Learned Weights</h2>
      <p style="font-size: 13px; color: #6B7280; margin-bottom: 16px;">
        The engine adjusts scoring weights based on your feedback. Positive adjustments (green) boost similar signals, negative adjustments (red) penalize them.
      </p>
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #F9FAFB;">
              <th style="padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Type</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Value</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Adjustment</th>
              <th style="padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Feedback Count</th>
            </tr>
          </thead>
          <tbody>
            ${weightsHTML || '<tr><td colspan="4" style="padding: 16px; text-align: center; color: #6B7280;">No learned weights yet</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * Generate feedback confirmation HTML
 */
function generateConfirmationHTML(insight, rating, action) {
  let message = '';

  if (rating) {
    message = `You rated this insight <strong>${rating}/5</strong>.<br><br>`;
    if (rating >= 4) {
      message += 'High ratings boost similar signals in future scans.';
    } else if (rating <= 2) {
      message += 'Low ratings reduce the weight of similar signals.';
    } else {
      message += 'Neutral ratings help maintain balance.';
    }
  }

  if (action) {
    const actionMessages = {
      acted_on: 'Marked as <strong>Acted On</strong>. The engine will prioritize similar signals.',
      saved: 'Marked as <strong>Saved</strong>. You can reference this later.',
      irrelevant: 'Marked as <strong>Irrelevant</strong>. The engine will reduce similar signals.',
      dismissed: 'Dismissed. No learning adjustment applied.'
    };
    message = actionMessages[action] || 'Feedback recorded.';
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Feedback Recorded</title>
</head>
<body style="margin: 0; padding: 0; background: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 60px auto; padding: 20px;">
    <div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); text-align: center;">
      <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
      <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 16px;">
        Feedback Recorded
      </h1>
      <p style="font-size: 15px; color: #6B7280; line-height: 1.6; margin-bottom: 20px;">
        ${message}
      </p>
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin-top: 24px;">
        <div style="font-size: 13px; font-weight: 600; color: #111827; margin-bottom: 8px;">
          ${insight.title}
        </div>
        <div style="font-size: 12px; color: #6B7280;">
          ${insight.domain} • Score: ${insight.relevance_score}/100
        </div>
      </div>
      <div style="margin-top: 24px;">
        <a href="${process.env.FEEDBACK_URL || 'http://localhost:3000'}/feedback?view=dashboard" style="display: inline-block; padding: 12px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
          View Dashboard
        </a>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Create Express server for feedback and analytics
 */
export function createFeedbackServer() {
  const app = express();

  app.use(express.json());

  // GET /feedback - Dashboard, rating, or action recording
  app.get('/feedback', async (req, res) => {
    try {
      const { view, id, rating, action } = req.query;

      // Dashboard view
      if (view === 'dashboard') {
        const dashboardStats = getDashboardStats();
        const recentInsights = getRecentInsightsWithFeedback(20);
        const learnedWeights = getAllLearnedWeights();

        const feedbackStats = getAllFeedbackStats();

        const html = generateDashboardHTML(
          { ...dashboardStats, feedbackStats },
          recentInsights,
          learnedWeights
        );

        return res.send(html);
      }

      // Rating or action recording
      if (id && (rating || action)) {
        const insight = getInsightById(id);

        if (!insight) {
          return res.status(404).send('Insight not found');
        }

        // Record feedback
        insertFeedback({
          insightId: id,
          rating: rating ? parseInt(rating) : null,
          actionTaken: action || null
        });

        const html = generateConfirmationHTML(insight, rating, action);
        return res.send(html);
      }

      return res.status(400).send('Invalid request');
    } catch (error) {
      console.error('[feedback-api] Error handling feedback:', error);
      return res.status(500).send('Internal server error');
    }
  });

  // POST /feedback - Detailed feedback
  app.post('/feedback', async (req, res) => {
    try {
      const { insightId, rating, actionTaken, notes } = req.body;

      if (!insightId) {
        return res.status(400).json({ error: 'insightId is required' });
      }

      const insight = getInsightById(insightId);

      if (!insight) {
        return res.status(404).json({ error: 'Insight not found' });
      }

      insertFeedback({
        insightId,
        rating: rating || null,
        actionTaken: actionTaken || null,
        notes: notes || null
      });

      return res.json({ success: true, insightId });
    } catch (error) {
      console.error('[feedback-api] Error recording feedback:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /analytics/feedback - Feedback stats JSON
  app.get('/analytics/feedback', (req, res) => {
    try {
      const stats = getAllFeedbackStats();
      return res.json(stats);
    } catch (error) {
      console.error('[feedback-api] Error fetching feedback stats:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /analytics/weights - Learned weights JSON
  app.get('/analytics/weights', (req, res) => {
    try {
      const weights = getAllLearnedWeights();
      return res.json(weights);
    } catch (error) {
      console.error('[feedback-api] Error fetching weights:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /analytics/briefs - Brief history JSON
  app.get('/analytics/briefs', (req, res) => {
    try {
      const { date } = req.query;

      if (date) {
        const briefs = getBriefsByDate(date, date);
        return res.json(briefs);
      }

      // Last 7 days by default
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const briefs = getBriefsByDate(startDate, endDate);

      return res.json(briefs);
    } catch (error) {
      console.error('[feedback-api] Error fetching briefs:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /action - Handle action button clicks (Execute, Delegate, Complete, Dismiss)
  app.get('/action', async (req, res) => {
    try {
      const { id, status } = req.query;

      if (!id || !status) {
        return res.status(400).send('Missing required parameters');
      }

      const insight = getInsightById(id);

      if (!insight) {
        return res.status(404).send('Insight not found');
      }

      // If status is 'delegated', spawn an autonomous agent
      if (status === 'delegated') {
        // Import agent orchestrator
        const { delegateToAgent } = await import('../agents/agent-orchestrator.js');
        const { sendAgentReport, sendAgentErrorNotification } = await import('../delivery/agent-report-email.js');
        const { updateInsightAction } = await import('../config/database.js');

        // Update status immediately
        updateInsightAction(id, 'delegated', 'Spawning autonomous agent...');

        // Spawn agent asynchronously (don't block response)
        delegateToAgent(insight).then(result => {
          if (result.success) {
            console.log(`[feedback-api] Agent completed successfully for insight ${id}`);
            // Send email with agent results
            sendAgentReport(insight, result.output, result.agentType).catch(err => {
              console.error('[feedback-api] Failed to send agent report email:', err);
            });
          } else {
            console.error(`[feedback-api] Agent failed for insight ${id}:`, result.error);
            // Send error notification
            sendAgentErrorNotification(insight, result.error, result.agentType).catch(err => {
              console.error('[feedback-api] Failed to send error notification:', err);
            });
          }
        }).catch(error => {
          console.error(`[feedback-api] Agent error for insight ${id}:`, error);
          sendAgentErrorNotification(insight, error.message).catch(err => {
            console.error('[feedback-api] Failed to send error notification:', err);
          });
        });

        // Return immediate confirmation (agent is running in background)
        const execution = Array.isArray(insight.execution) ? insight.execution : [];

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Deployed</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background: #F9FAFB; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 700px; margin: 60px auto; padding: 20px;">
    <div style="background: white; padding: 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">

      <!-- Animated Icon -->
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-flex; align-items: center; justify-content: center; width: 96px; height: 96px; background: linear-gradient(135deg, #6366F1, #8B5CF6); border-radius: 50%; font-size: 48px; animation: pulse 2s infinite;">
          🤖
        </div>
      </div>

      <h1 style="text-align: center; color: #1F2937; font-size: 28px; font-weight: 700; margin-bottom: 12px;">
        Agent Deployed
      </h1>

      <p style="text-align: center; color: #6B7280; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
        An autonomous Claude agent has been spawned to execute this mission.<br>
        You'll receive an email report when the agent completes its work.
      </p>

      <!-- Mission Card -->
      <div style="background: linear-gradient(135deg, #F3F4F6, #E5E7EB); padding: 20px; border-radius: 12px; margin-bottom: 28px; border-left: 4px solid #6366F1;">
        <h2 style="color: #1F2937; font-size: 16px; font-weight: 600; margin: 0 0 8px 0;">Mission</h2>
        <p style="color: #374151; font-size: 15px; margin: 0;">${insight.title}</p>
      </div>

      ${execution.length > 0 ? `
      <!-- Execution Tasks -->
      <div style="margin-bottom: 28px;">
        <h3 style="color: #6B7280; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0;">
          Agent Will Execute
        </h3>
        <ol style="margin: 0; padding-left: 24px; color: #374151; font-size: 14px; line-height: 2;">
          ${execution.map(step => `<li>${step}</li>`).join('')}
        </ol>
      </div>
      ` : ''}

      <!-- Status Updates -->
      <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; border-radius: 8px; margin-bottom: 28px;">
        <p style="color: #92400E; font-size: 14px; margin: 0; line-height: 1.6;">
          <strong>📊 Real-time execution:</strong> The agent is working autonomously. Progress is being tracked and logged.
        </p>
      </div>

      <!-- Action Buttons -->
      <div style="text-align: center;">
        <a href="${process.env.FEEDBACK_URL || 'http://localhost:3000'}/feedback?view=dashboard"
           style="display: inline-block; padding: 14px 32px; background: #6366F1; color: white; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600; margin-right: 8px;">
          View Dashboard
        </a>
      </div>

      <!-- Footer Note -->
      <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 32px; padding-top: 20px; border-top: 1px solid #E5E7EB;">
        Powered by Claude AI with computer use capabilities
      </p>

    </div>
  </div>

  <style>
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }
  </style>
</body>
</html>
        `;

        return res.send(html);
      }

      // Update action status for non-delegated actions
      const { updateInsightAction } = await import('../config/database.js');
      updateInsightAction(id, status);

      // Generate confirmation page for other statuses
      const statusMessages = {
        in_progress: { title: 'Executing', message: 'Marked as in progress. You\'ve committed to taking action on this insight.', icon: '⚡', color: '#3B82F6' },
        completed: { title: 'Completed', message: 'Marked as complete. Great work executing on strategic intelligence!', icon: '✅', color: '#10B981' },
        dismissed: { title: 'Dismissed', message: 'This insight has been dismissed. Your feedback helps the engine learn what matters to you.', icon: '✕', color: '#6B7280' }
      };

      const statusInfo = statusMessages[status] || statusMessages.dismissed;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusInfo.title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background: #F9FAFB; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 80px auto; padding: 20px;">
    <div style="background: white; padding: 48px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align: center;">
      <div style="font-size: 64px; margin-bottom: 24px;">${statusInfo.icon}</div>
      <h1 style="font-size: 28px; font-weight: 700; color: #111827; margin-bottom: 16px;">
        ${statusInfo.title}
      </h1>
      <p style="font-size: 16px; color: #6B7280; line-height: 1.7; margin-bottom: 28px;">
        ${statusInfo.message}
      </p>
      <div style="background: #F3F4F6; padding: 20px; border-radius: 12px; margin-bottom: 28px; text-align: left;">
        <div style="font-size: 13px; font-weight: 600; color: #374151; margin-bottom: 8px;">
          ${insight.title}
        </div>
        <div style="font-size: 12px; color: #6B7280;">
          ${insight.domain} • Score: ${insight.relevance_score}/100
        </div>
      </div>
      <a href="${process.env.FEEDBACK_URL || 'http://localhost:3000'}/feedback?view=dashboard" style="display: inline-block; padding: 14px 32px; background: ${statusInfo.color}; color: white; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 600;">
        Back to Dashboard
      </a>
    </div>
  </div>
</body>
</html>
      `;

      return res.send(html);
    } catch (error) {
      console.error('[feedback-api] Error handling action:', error);
      return res.status(500).send('Internal server error');
    }
  });

  // GET /health - Health check
  app.get('/health', (req, res) => {
    const stats = getDashboardStats();

    return res.json({
      status: 'operational',
      timestamp: new Date().toISOString(),
      database: 'connected',
      totalSignals: stats.signals?.count || 0,
      totalInsights: stats.insights?.count || 0,
      totalFeedback: stats.feedbackCount?.count || 0
    });
  });

  return app;
}
