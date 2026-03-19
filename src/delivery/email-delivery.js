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
 * Get color for insight type
 */
function getInsightTypeColor(type) {
  const colors = {
    action_trigger: { bg: '#FEE2E2', border: '#EF4444', text: '#991B1B', label: 'ACTION REQUIRED' },
    cross_domain: { bg: '#F3E8FF', border: '#A855F7', text: '#6B21A8', label: 'CROSS-DOMAIN' },
    pattern: { bg: '#D1FAE5', border: '#10B981', text: '#065F46', label: 'PATTERN' },
    signal: { bg: '#DBEAFE', border: '#3B82F6', text: '#1E40AF', label: 'SIGNAL' }
  };

  return colors[type] || colors.signal;
}

/**
 * Generate HTML email for daily brief
 */
function generateBriefHTML(insights, scanSummary) {
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

  // Limit to maxBriefSignals
  const briefInsights = sortedInsights.slice(0, feedbackWeights.maxBriefSignals);

  // Count by type
  const actionCount = briefInsights.filter(i => i.insight_type === 'action_trigger').length;
  const crossDomainCount = briefInsights.filter(i => i.insight_type === 'cross_domain').length;
  const patternCount = briefInsights.filter(i => i.insight_type === 'pattern').length;

  const insightsHTML = briefInsights.map(insight => {
    const typeStyle = getInsightTypeColor(insight.insight_type);

    return `
      <div style="margin-bottom: 24px; border-left: 4px solid ${typeStyle.border}; padding: 16px; background: #FFFFFF; border-radius: 8px;">
        <!-- Type Badge and Domain -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <span style="display: inline-block; background: ${typeStyle.bg}; color: ${typeStyle.text}; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; letter-spacing: 0.5px;">
            ${typeStyle.label}
          </span>
          <span style="font-size: 12px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">
            ${insight.domain}
          </span>
        </div>

        <!-- Score -->
        <div style="margin-bottom: 8px;">
          <span style="font-size: 12px; color: #9CA3AF; font-weight: 500;">Relevance: ${insight.relevance_score}/100</span>
        </div>

        <!-- Title -->
        <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 700; color: #111827; line-height: 1.4;">
          ${insight.title}
        </h3>

        <!-- Analysis -->
        <p style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: #374151;">
          ${insight.analysis}
        </p>

        <!-- Action Recommendation -->
        <div style="background: #F0FDF4; border-left: 3px solid #10B981; padding: 12px; margin-bottom: 16px; border-radius: 4px;">
          <div style="font-size: 11px; font-weight: 600; color: #065F46; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
            ACTION THIS WEEK
          </div>
          <div style="font-size: 14px; color: #065F46; line-height: 1.5;">
            ${insight.action_recommendation}
          </div>
        </div>

        <!-- Feedback Buttons -->
        <div style="border-top: 1px solid #E5E7EB; padding-top: 12px;">
          <div style="margin-bottom: 8px;">
            <span style="font-size: 12px; color: #6B7280; margin-right: 8px;">Rate this insight:</span>
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=1" style="display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; background: #F3F4F6; color: #6B7280; text-decoration: none; margin-right: 4px; font-size: 12px;">1</a>
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=2" style="display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; background: #F3F4F6; color: #6B7280; text-decoration: none; margin-right: 4px; font-size: 12px;">2</a>
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=3" style="display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; background: #F3F4F6; color: #6B7280; text-decoration: none; margin-right: 4px; font-size: 12px;">3</a>
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=4" style="display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; background: #F3F4F6; color: #6B7280; text-decoration: none; margin-right: 4px; font-size: 12px;">4</a>
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=5" style="display: inline-block; width: 24px; height: 24px; line-height: 24px; text-align: center; border-radius: 50%; background: #F3F4F6; color: #6B7280; text-decoration: none; font-size: 12px;">5</a>
          </div>
          <div>
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&action=acted_on" style="display: inline-block; padding: 6px 12px; background: #10B981; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; margin-right: 6px;">Acted On</a>
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&action=saved" style="display: inline-block; padding: 6px 12px; background: #3B82F6; color: white; text-decoration: none; border-radius: 4px; font-size: 12px; margin-right: 6px;">Save</a>
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&action=irrelevant" style="display: inline-block; padding: 6px 12px; background: #6B7280; color: white; text-decoration: none; border-radius: 4px; font-size: 12px;">Irrelevant</a>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Strategic Intelligence Brief</title>
</head>
<body style="margin: 0; padding: 0; background: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 680px; margin: 0 auto; padding: 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #1F2937 0%, #111827 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 12px; color: #9CA3AF; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px;">
        ${date}
      </div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">
        STRATEGIC INTELLIGENCE BRIEF
      </h1>
      <div style="margin-top: 12px; font-size: 14px; color: #D1D5DB;">
        Your Daily Reconnaissance for Generational Wealth
      </div>
    </div>

    <!-- Quick Stats -->
    <div style="background: #FFFFFF; padding: 20px; border-bottom: 1px solid #E5E7EB;">
      <div style="display: flex; justify-content: space-around; text-align: center;">
        <div>
          <div style="font-size: 24px; font-weight: 700; color: #111827;">${briefInsights.length}</div>
          <div style="font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Total Insights</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: 700; color: #EF4444;">${actionCount}</div>
          <div style="font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Action Required</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: 700; color: #A855F7;">${crossDomainCount}</div>
          <div style="font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Cross-Domain</div>
        </div>
        <div>
          <div style="font-size: 24px; font-weight: 700; color: #10B981;">${patternCount}</div>
          <div style="font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px;">Patterns</div>
        </div>
      </div>
    </div>

    <!-- Insights -->
    <div style="background: #F3F4F6; padding: 24px;">
      ${insightsHTML}
    </div>

    <!-- Footer -->
    <div style="background: #1F2937; padding: 24px; border-radius: 0 0 12px 12px; text-align: center;">
      <div style="font-size: 13px; color: #9CA3AF; margin-bottom: 12px;">
        Synthesized from ${scanSummary?.totalSignals || 0} signals across all domains
      </div>
      <a href="${FEEDBACK_URL}/feedback?view=dashboard" style="display: inline-block; padding: 10px 24px; background: #3B82F6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: 600;">
        View Dashboard
      </a>
      <div style="margin-top: 16px; font-size: 12px; color: #6B7280;">
        Foresight Engine by P&F Management Group
      </div>
    </div>

  </div>
</body>
</html>
  `;
}

/**
 * Generate plain text version of brief
 */
function generateBriefText(insights, scanSummary) {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let text = `STRATEGIC INTELLIGENCE BRIEF\n${date}\n\n`;
  text += `Total Insights: ${insights.length}\n`;
  text += `Signals Analyzed: ${scanSummary?.totalSignals || 0}\n\n`;
  text += `${'='.repeat(60)}\n\n`;

  for (const insight of insights) {
    text += `[${insight.insight_type.toUpperCase()}] ${insight.domain.toUpperCase()}\n`;
    text += `${insight.title}\n`;
    text += `Score: ${insight.relevance_score}/100\n\n`;
    text += `${insight.analysis}\n\n`;
    text += `ACTION THIS WEEK:\n${insight.action_recommendation}\n\n`;
    text += `Rate: ${FEEDBACK_URL}/feedback?id=${insight.id}&rating=5\n`;
    text += `${'='.repeat(60)}\n\n`;
  }

  text += `Dashboard: ${FEEDBACK_URL}/feedback?view=dashboard\n`;
  text += `Foresight Engine by P&F Management Group\n`;

  return text;
}

/**
 * Send daily strategic brief
 */
export async function sendDailyBrief(insights, scanSummary) {
  const timestamp = new Date().toISOString();
  console.log(`[email-delivery][${timestamp}] Preparing daily brief`);

  if (!insights || insights.length === 0) {
    console.log('[email-delivery] No insights to deliver');
    return { success: false, reason: 'no_insights' };
  }

  const htmlContent = generateBriefHTML(insights, scanSummary);
  const textContent = generateBriefText(insights, scanSummary);

  const mailOptions = {
    from: `Foresight Engine <${process.env.SMTP_USER}>`,
    to: process.env.DELIVERY_EMAIL,
    subject: `Strategic Intelligence Brief — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    text: textContent,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[email-delivery] Brief delivered successfully:`, info.messageId);

    // Log brief delivery
    const insightIds = insights.map(i => i.id);
    const briefDate = new Date().toISOString().split('T')[0];
    insertBriefLog(briefDate, insightIds, 'success');

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[email-delivery] Failed to send brief:', error.message);

    // Log failed delivery
    const insightIds = insights.map(i => i.id);
    const briefDate = new Date().toISOString().split('T')[0];
    insertBriefLog(briefDate, insightIds, 'failed');

    return { success: false, error: error.message };
  }
}

/**
 * Send real-time alert for high-priority signal
 */
export async function sendAlert(insight) {
  const timestamp = new Date().toISOString();
  console.log(`[email-delivery][${timestamp}] Sending alert for insight:`, insight.title);

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>URGENT: Strategic Alert</title>
</head>
<body style="margin: 0; padding: 0; background: #F9FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">

    <div style="background: #FEE2E2; border: 3px solid #EF4444; border-radius: 12px; padding: 24px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <div style="font-size: 40px; margin-bottom: 8px;">🚨</div>
        <h1 style="margin: 0; font-size: 24px; font-weight: 700; color: #991B1B;">
          URGENT STRATEGIC ALERT
        </h1>
        <div style="font-size: 12px; color: #991B1B; margin-top: 4px;">
          High-Priority Signal Detected
        </div>
      </div>

      <div style="background: white; padding: 20px; border-radius: 8px; margin-bottom: 16px;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #111827;">
          ${insight.title}
        </h2>
        <p style="margin: 0 0 16px 0; font-size: 15px; line-height: 1.6; color: #374151;">
          ${insight.analysis}
        </p>
        <div style="background: #FEF3C7; border-left: 3px solid #F59E0B; padding: 14px; border-radius: 4px;">
          <div style="font-size: 11px; font-weight: 600; color: #92400E; text-transform: uppercase; margin-bottom: 6px;">
            IMMEDIATE ACTION REQUIRED
          </div>
          <div style="font-size: 15px; color: #92400E; font-weight: 500;">
            ${insight.action_recommendation}
          </div>
        </div>
      </div>

      <div style="text-align: center;">
        <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=5" style="display: inline-block; padding: 12px 32px; background: #EF4444; color: white; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: 600;">
          View Full Details
        </a>
      </div>
    </div>

  </div>
</body>
</html>
  `;

  const textContent = `URGENT STRATEGIC ALERT\n\n${insight.title}\n\nScore: ${insight.relevance_score}/100\n\n${insight.analysis}\n\nACTION REQUIRED:\n${insight.action_recommendation}\n\nView: ${FEEDBACK_URL}/feedback?id=${insight.id}`;

  const mailOptions = {
    from: `Foresight Engine ALERT <${process.env.SMTP_USER}>`,
    to: process.env.DELIVERY_EMAIL,
    subject: `🚨 ALERT: ${insight.title}`,
    text: textContent,
    html: htmlContent
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`[email-delivery] Alert sent successfully:`, info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[email-delivery] Failed to send alert:', error.message);
    return { success: false, error: error.message };
  }
}
