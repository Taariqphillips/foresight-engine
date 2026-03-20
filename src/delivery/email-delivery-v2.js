import nodemailer from 'nodemailer';
import { feedbackWeights } from '../config/domains.js';
import { insertBriefLog } from '../config/database.js';

// Create transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const FEEDBACK_URL = process.env.FEEDBACK_URL || 'http://localhost:3000';

/**
 * Get styling for insight type
 */
function getInsightTypeStyle(type) {
  const styles = {
    action_trigger: {
      gradient: 'linear-gradient(135deg, #DC2626 0%, #991B1B 100%)',
      color: '#DC2626',
      label: '🎯 ACTION REQUIRED',
      icon: '⚡'
    },
    cross_domain: {
      gradient: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)',
      color: '#7C3AED',
      label: '🔗 CROSS-DOMAIN',
      icon: '✨'
    },
    pattern: {
      gradient: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
      color: '#059669',
      label: '📊 EMERGING PATTERN',
      icon: '📈'
    },
    signal: {
      gradient: 'linear-gradient(135deg, #2563EB 0%, #1E40AF 100%)',
      color: '#2563EB',
      label: '📡 NEW SIGNAL',
      icon: '💡'
    }
  };

  return styles[type] || styles.signal;
}

/**
 * Generate enhanced HTML email with OPORD structure
 */
function generateEnhancedBriefHTML(insights, scanSummary) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Sort insights by priority
  const sortedInsights = [...insights].sort((a, b) => {
    const typeOrder = { action_trigger: 0, cross_domain: 1, pattern: 2, signal: 3 };
    const orderA = typeOrder[a.insight_type] || 99;
    const orderB = typeOrder[b.insight_type] || 99;

    if (orderA !== orderB) return orderA - orderB;
    return b.relevance_score - a.relevance_score;
  });

  const briefInsights = sortedInsights.slice(0, feedbackWeights.maxBriefSignals);

  // Count by type
  const actionCount = briefInsights.filter(i => i.insight_type === 'action_trigger').length;
  const crossDomainCount = briefInsights.filter(i => i.insight_type === 'cross_domain').length;
  const patternCount = briefInsights.filter(i => i.insight_type === 'pattern').length;

  const insightsHTML = briefInsights.map((insight, index) => {
    const style = getInsightTypeStyle(insight.insight_type);

    // Format execution steps (more concise)
    const execution = Array.isArray(insight.execution) ? insight.execution : [];
    const executionSteps = execution.map((step, i) => `
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        <div style="flex-shrink: 0; width: 20px; height: 20px; background: ${style.color}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 11px;">
          ${i + 1}
        </div>
        <div style="flex: 1; font-size: 13px; line-height: 1.5; color: #374151;">
          ${step}
        </div>
      </div>
    `).join('');

    // Format resources (more compact)
    const resources = Array.isArray(insight.resources) ? insight.resources : [];
    const resourcesHTML = resources.map(resource => `
      <span style="display: inline-block; background: #F3F4F6; padding: 4px 10px; border-radius: 4px; font-size: 12px; color: #374151; margin: 3px 3px 3px 0; border-left: 2px solid ${style.color};">
        ${resource}
      </span>
    `).join('');

    return `
      <div style="margin-bottom: 20px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.08);">

        <!-- Insight Header -->
        <div style="background: ${style.gradient}; padding: 16px 20px; color: white;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.9;">
              ${style.label}
            </div>
            <div style="background: rgba(255,255,255,0.25); padding: 4px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;">
              ${insight.relevance_score}
            </div>
          </div>
          <h2 style="margin: 0; font-size: 18px; font-weight: 700; line-height: 1.3; color: white;">
            ${insight.title}
          </h2>
          ${insight.timeline ? `
            <div style="margin-top: 8px; font-size: 11px; opacity: 0.9;">
              ⏱ ${insight.timeline}
            </div>
          ` : ''}
        </div>

        <!-- Insight Body -->
        <div style="padding: 20px;">

          <!-- SITUATION -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <div style="width: 3px; height: 16px; background: ${style.color}; border-radius: 2px;"></div>
              <h3 style="margin: 0; font-size: 12px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                SITUATION
              </h3>
            </div>
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #374151;">
              ${insight.situation || insight.analysis || 'No context available'}
            </p>
          </div>

          <!-- IMPLICATION -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
              <div style="width: 3px; height: 16px; background: ${style.color}; border-radius: 2px;"></div>
              <h3 style="margin: 0; font-size: 12px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                IMPLICATION
              </h3>
            </div>
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #374151;">
              ${insight.implication || 'Strategic implications to be analyzed.'}
            </p>
          </div>

          <!-- EXECUTION -->
          <div style="margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 10px;">
              <div style="width: 3px; height: 16px; background: ${style.color}; border-radius: 2px;"></div>
              <h3 style="margin: 0; font-size: 12px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                EXECUTION
              </h3>
            </div>
            ${executionSteps || `<p style="margin: 0; font-size: 12px; color: #6B7280; font-style: italic;">No execution steps provided</p>`}
          </div>

          <!-- RESOURCES -->
          ${resources.length > 0 ? `
            <div style="margin-bottom: 16px;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                <div style="width: 3px; height: 16px; background: ${style.color}; border-radius: 2px;"></div>
                <h3 style="margin: 0; font-size: 12px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                  RESOURCES
                </h3>
              </div>
              <div>
                ${resourcesHTML}
              </div>
            </div>
          ` : ''}

          <!-- ACTION BUTTONS -->
          <div style="border-top: 1px solid #F3F4F6; padding-top: 12px; margin-top: 4px;">
            <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px;">
              <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=in_progress" style="display: inline-block; padding: 8px 14px; background: ${style.color}; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600;">
                ✓ Execute
              </a>
              <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=delegated" style="display: inline-block; padding: 8px 14px; background: #6366F1; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600;">
                🤖 Delegate
              </a>
              <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=completed" style="display: inline-block; padding: 8px 14px; background: #10B981; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600;">
                ✅ Done
              </a>
              <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=dismissed" style="display: inline-block; padding: 8px 14px; background: #6B7280; color: white; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600;">
                ✕ Dismiss
              </a>
            </div>
            <!-- FEEDBACK -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-size: 10px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.3px; margin-right: 4px;">
                Rate:
              </span>
              ${[1, 2, 3, 4, 5].map(rating => `
                <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=${rating}" style="display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; background: #F3F4F6; color: #6B7280; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600;">
                  ${rating}
                </a>
              `).join('')}
            </div>
          </div>

        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Strategic Intelligence Brief</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  </style>
</head>
<body style="margin: 0; padding: 0; background: #F9FAFB; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">

  <div style="max-width: 650px; margin: 0 auto; padding: 20px;">

    <!-- Hero Header -->
    <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%); padding: 32px 24px; border-radius: 16px; margin-bottom: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
      <div style="text-align: center;">
        <div style="font-size: 10px; color: #94A3B8; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; font-weight: 600;">
          ${date}
        </div>
        <h1 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px; line-height: 1.2;">
          STRATEGIC INTELLIGENCE
        </h1>
        <div style="font-size: 13px; color: #CBD5E1; font-weight: 500;">
          ${briefInsights.length} Insights • ${scanSummary?.totalSignals || 0} Signals Analyzed
        </div>
      </div>
    </div>

    <!-- Insights -->
    ${insightsHTML}

    <!-- Footer -->
    <div style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 24px; border-radius: 12px; text-align: center; margin-top: 20px;">
      <a href="${FEEDBACK_URL}/feedback?view=dashboard" style="display: inline-block; padding: 10px 24px; background: linear-gradient(135deg, #3B82F6, #2563EB); color: white; text-decoration: none; border-radius: 8px; font-size: 13px; font-weight: 600; box-shadow: 0 2px 4px rgba(37,99,235,0.3); margin-bottom: 12px;">
        View Dashboard →
      </a>
      <div style="font-size: 10px; color: #64748B; margin-top: 12px;">
        Foresight Engine | Powered by Claude Sonnet 4
      </div>
    </div>

  </div>

</body>
</html>
  `;
}

/**
 * Generate plain text version
 */
function generateEnhancedBriefText(insights, scanSummary) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let text = `═══════════════════════════════════════════════════════════\n`;
  text += `STRATEGIC INTELLIGENCE BRIEF\n`;
  text += `${date}\n`;
  text += `═══════════════════════════════════════════════════════════\n\n`;

  text += `Total Insights: ${insights.length}\n`;
  text += `Signals Analyzed: ${scanSummary?.totalSignals || 0}\n\n`;

  for (const insight of insights) {
    text += `\n${'─'.repeat(60)}\n`;
    text += `[${insight.insight_type.toUpperCase()}] ${insight.title}\n`;
    text += `Score: ${insight.relevance_score}/100\n`;
    if (insight.timeline) text += `Timeline: ${insight.timeline}\n`;
    text += `${'─'.repeat(60)}\n\n`;

    text += `1. SITUATION:\n${insight.situation || insight.analysis}\n\n`;

    if (insight.implication) {
      text += `2. IMPLICATION:\n${insight.implication}\n\n`;
    }

    if (insight.execution && insight.execution.length > 0) {
      text += `3. EXECUTION:\n`;
      insight.execution.forEach((step, i) => {
        text += `  ${i + 1}. ${step}\n`;
      });
      text += `\n`;
    }

    if (insight.resources && insight.resources.length > 0) {
      text += `4. RESOURCES:\n`;
      insight.resources.forEach(resource => {
        text += `  - ${resource}\n`;
      });
      text += `\n`;
    }

    text += `Actions: ${FEEDBACK_URL}/action?id=${insight.id}\n`;
    text += `Rate: ${FEEDBACK_URL}/feedback?id=${insight.id}&rating=5\n`;
    text += `\n`;
  }

  text += `\n═══════════════════════════════════════════════════════════\n`;
  text += `Dashboard: ${FEEDBACK_URL}/feedback?view=dashboard\n`;
  text += `Foresight Engine by P&F Management Group\n`;

  return text;
}

/**
 * Send enhanced daily brief
 */
export async function sendEnhancedDailyBrief(insights, scanSummary) {
  const timestamp = new Date().toISOString();
  console.log(`[email-delivery][${timestamp}] Preparing enhanced daily brief`);

  if (!insights || insights.length === 0) {
    console.log('[email-delivery] No insights to deliver');
    return { success: false, reason: 'no_insights' };
  }

  const htmlContent = generateEnhancedBriefHTML(insights, scanSummary);
  const textContent = generateEnhancedBriefText(insights, scanSummary);

  const mailOptions = {
    from: `Foresight Engine <${process.env.SMTP_USER}>`,
    to: process.env.DELIVERY_EMAIL,
    subject: `⚡ Strategic Intelligence Brief — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    text: textContent,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[email-delivery] Enhanced brief delivered successfully:`, info.messageId);

    const insightIds = insights.map(i => i.id);
    const briefDate = new Date().toISOString().split('T')[0];
    insertBriefLog(briefDate, insightIds, 'success');

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[email-delivery] Failed to send enhanced brief:', error.message);

    const insightIds = insights.map(i => i.id);
    const briefDate = new Date().toISOString().split('T')[0];
    insertBriefLog(briefDate, insightIds, 'failed');

    return { success: false, error: error.message };
  }
}
