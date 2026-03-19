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

    // Format execution steps
    const executionSteps = (insight.execution || []).map((step, i) => `
      <div style="display: flex; gap: 12px; margin-bottom: 10px;">
        <div style="flex-shrink: 0; width: 24px; height: 24px; background: ${style.color}; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px;">
          ${i + 1}
        </div>
        <div style="flex: 1; font-size: 14px; line-height: 1.6; color: #374151;">
          ${step}
        </div>
      </div>
    `).join('');

    // Format resources
    const resourcesHTML = (insight.resources || []).map(resource => `
      <span style="display: inline-block; background: #F3F4F6; padding: 6px 12px; border-radius: 6px; font-size: 13px; color: #374151; margin: 4px 4px 4px 0; border-left: 3px solid ${style.color};">
        ${resource}
      </span>
    `).join('');

    return `
      <div style="margin-bottom: 32px; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.06);">

        <!-- Insight Header -->
        <div style="background: ${style.gradient}; padding: 24px; color: white;">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.95;">
              ${style.label}
            </div>
            <div style="background: rgba(255,255,255,0.2); padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 600;">
              Score: ${insight.relevance_score}/100
            </div>
          </div>
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; line-height: 1.3; color: white;">
            ${insight.title}
          </h2>
          ${insight.timeline ? `
            <div style="margin-top: 12px; display: inline-block; background: rgba(255,255,255,0.15); padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600;">
              ⏱ ${insight.timeline}
            </div>
          ` : ''}
        </div>

        <!-- Insight Body -->
        <div style="padding: 28px;">

          <!-- SITUATION -->
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
              <div style="width: 4px; height: 20px; background: ${style.color}; border-radius: 2px;"></div>
              <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                1. SITUATION — What's Emerging
              </h3>
            </div>
            <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #374151;">
              ${insight.situation || insight.analysis || 'No context available'}
            </p>
          </div>

          <!-- IMPLICATION -->
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
              <div style="width: 4px; height: 20px; background: ${style.color}; border-radius: 2px;"></div>
              <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                2. STRATEGIC IMPLICATION — Why This Matters
              </h3>
            </div>
            <p style="margin: 0; font-size: 15px; line-height: 1.7; color: #374151;">
              ${insight.implication || 'Strategic implications to be analyzed.'}
            </p>
          </div>

          <!-- EXECUTION -->
          <div style="margin-bottom: 24px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <div style="width: 4px; height: 20px; background: ${style.color}; border-radius: 2px;"></div>
              <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                3. EXECUTION — Action Steps
              </h3>
            </div>
            ${executionSteps || `<p style="margin: 0; font-size: 14px; color: #6B7280; font-style: italic;">No execution steps provided</p>`}
          </div>

          <!-- RESOURCES -->
          ${(insight.resources || []).length > 0 ? `
            <div style="margin-bottom: 24px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                <div style="width: 4px; height: 20px; background: ${style.color}; border-radius: 2px;"></div>
                <h3 style="margin: 0; font-size: 14px; font-weight: 700; color: #111827; text-transform: uppercase; letter-spacing: 0.5px;">
                  4. RESOURCES REQUIRED
                </h3>
              </div>
              <div>
                ${resourcesHTML}
              </div>
            </div>
          ` : ''}

          <!-- ACTION BUTTONS -->
          <div style="border-top: 2px solid #F3F4F6; padding-top: 20px;">
            <div style="margin-bottom: 12px;">
              <span style="font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">
                Take Action
              </span>
            </div>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=in_progress" style="display: inline-block; padding: 12px 20px; background: ${style.color}; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ✓ Execute Now
              </a>
              <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=delegated" style="display: inline-block; padding: 12px 20px; background: #6366F1; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                🤖 Delegate to AI
              </a>
              <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=completed" style="display: inline-block; padding: 12px 20px; background: #10B981; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ✅ Mark Complete
              </a>
              <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=dismissed" style="display: inline-block; padding: 12px 20px; background: #6B7280; color: white; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                ✕ Dismiss
              </a>
            </div>
          </div>

          <!-- FEEDBACK -->
          <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; margin-top: 16px;">
            <div style="margin-bottom: 8px;">
              <span style="font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.5px;">
                Rate Relevance
              </span>
            </div>
            <div style="display: flex; gap: 6px;">
              ${[1, 2, 3, 4, 5].map(rating => `
                <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=${rating}" style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: #F3F4F6; color: #6B7280; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600; transition: all 0.2s;">
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

  <div style="max-width: 680px; margin: 0 auto; padding: 24px;">

    <!-- Hero Header -->
    <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%); padding: 48px 32px; border-radius: 20px; margin-bottom: 32px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);">
      <div style="text-align: center;">
        <div style="font-size: 11px; color: #94A3B8; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 12px; font-weight: 600;">
          ${date}
        </div>
        <h1 style="margin: 0 0 12px 0; font-size: 36px; font-weight: 800; color: #FFFFFF; letter-spacing: -1px; line-height: 1.2;">
          STRATEGIC<br>INTELLIGENCE BRIEF
        </h1>
        <div style="width: 60px; height: 3px; background: linear-gradient(90deg, #3B82F6, #8B5CF6); margin: 16px auto; border-radius: 2px;"></div>
        <div style="font-size: 15px; color: #CBD5E1; font-weight: 500;">
          Daily Reconnaissance for Generational Wealth
        </div>
      </div>
    </div>

    <!-- Quick Stats -->
    <div style="background: white; padding: 24px; border-radius: 16px; margin-bottom: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; text-align: center;">
        <div>
          <div style="font-size: 28px; font-weight: 800; color: #111827; margin-bottom: 4px;">${briefInsights.length}</div>
          <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Insights</div>
        </div>
        <div>
          <div style="font-size: 28px; font-weight: 800; color: #DC2626; margin-bottom: 4px;">${actionCount}</div>
          <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Actions</div>
        </div>
        <div>
          <div style="font-size: 28px; font-weight: 800; color: #7C3AED; margin-bottom: 4px;">${crossDomainCount}</div>
          <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Cross-Domain</div>
        </div>
        <div>
          <div style="font-size: 28px; font-weight: 800; color: #059669; margin-bottom: 4px;">${patternCount}</div>
          <div style="font-size: 10px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Patterns</div>
        </div>
      </div>
    </div>

    <!-- Insights -->
    ${insightsHTML}

    <!-- Footer -->
    <div style="background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%); padding: 32px; border-radius: 16px; text-align: center; margin-top: 32px;">
      <div style="font-size: 13px; color: #94A3B8; margin-bottom: 16px; line-height: 1.6;">
        Synthesized from <strong style="color: #CBD5E1;">${scanSummary?.totalSignals || 0} signals</strong> across AI & Autonomous Systems, Real Assets & Spatial Economics, and Human Systems & Consciousness Infrastructure
      </div>
      <a href="${FEEDBACK_URL}/feedback?view=dashboard" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #3B82F6, #2563EB); color: white; text-decoration: none; border-radius: 10px; font-size: 15px; font-weight: 700; box-shadow: 0 4px 6px rgba(37,99,235,0.3); margin-bottom: 20px;">
        View Dashboard →
      </a>
      <div style="font-size: 11px; color: #64748B; margin-top: 16px;">
        Foresight Engine — Strategic Intelligence for the Wealth Architect<br>
        <span style="color: #475569;">Powered by Claude Sonnet 4 | P&F Management Group</span>
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
