import nodemailer from 'nodemailer';

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
};

const FEEDBACK_URL = process.env.FEEDBACK_URL || 'http://localhost:3000';

/**
 * Send agent execution report email
 */
export async function sendAgentReport(insight, agentOutput, agentType = 'general') {
  const timestamp = new Date().toISOString();
  console.log(`[agent-report-email][${timestamp}] Sending agent report for insight ${insight.id}`);

  try {
    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    const emailHTML = buildAgentReportHTML(insight, agentOutput, agentType);

    const mailOptions = {
      from: `"Foresight Engine AI" <${process.env.SMTP_USER}>`,
      to: process.env.DELIVERY_EMAIL,
      subject: `🤖 Agent Report: ${insight.title}`,
      html: emailHTML
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[agent-report-email] Agent report sent successfully. Message ID: ${info.messageId}`);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[agent-report-email] Failed to send agent report:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Build HTML for agent report email
 */
function buildAgentReportHTML(insight, agentOutput, agentType) {
  const agentTypeStyles = {
    trading: { icon: '💹', color: '#DC2626', gradient: 'linear-gradient(135deg, #DC2626, #EF4444)' },
    research: { icon: '🔍', color: '#2563EB', gradient: 'linear-gradient(135deg, #2563EB, #3B82F6)' },
    monitoring: { icon: '📊', color: '#059669', gradient: 'linear-gradient(135deg, #059669, #10B981)' },
    data_gathering: { icon: '📈', color: '#7C3AED', gradient: 'linear-gradient(135deg, #7C3AED, #8B5CF6)' },
    general: { icon: '🤖', color: '#6366F1', gradient: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }
  };

  const style = agentTypeStyles[agentType] || agentTypeStyles.general;

  // Format agent output for display
  const formattedOutput = agentOutput
    .replace(/\n/g, '<br>')
    .replace(/#{2,3}\s+(.+)/g, '<strong style="color: #1F2937; display: block; margin: 16px 0 8px 0;">$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color: #2563EB;">$1</a>');

  const execution = Array.isArray(insight.execution) ? insight.execution : [];

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Execution Report</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #F9FAFB; margin: 0; padding: 20px;">

  <div style="max-width: 700px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background: ${style.gradient}; padding: 32px 24px; color: white; text-align: center;">
      <div style="font-size: 56px; margin-bottom: 12px; line-height: 1;">${style.icon}</div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 600; letter-spacing: -0.5px;">Agent Mission Complete</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">
        ${agentType.replace('_', ' ')} Agent
      </p>
    </div>

    <!-- Mission Summary -->
    <div style="padding: 28px 24px; border-bottom: 1px solid #E5E7EB;">
      <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; border-left: 4px solid ${style.color};">
        <h2 style="color: #1F2937; font-size: 16px; margin: 0 0 8px 0; font-weight: 600;">Mission</h2>
        <p style="color: #374151; margin: 0; font-size: 15px; line-height: 1.6;">${insight.title}</p>
      </div>

      ${execution.length > 0 ? `
      <div style="margin-top: 20px;">
        <h3 style="color: #6B7280; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0;">Original Tasks</h3>
        <ul style="margin: 0; padding-left: 20px; color: #4B5563; font-size: 14px; line-height: 1.8;">
          ${execution.map(step => `<li>${step}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
    </div>

    <!-- Agent Execution Report -->
    <div style="padding: 28px 24px;">
      <h2 style="color: #1F2937; font-size: 18px; margin: 0 0 16px 0; font-weight: 600;">Execution Report</h2>

      <div style="background: #F9FAFB; padding: 20px; border-radius: 8px; border: 1px solid #E5E7EB;">
        <div style="color: #374151; font-size: 14px; line-height: 1.8; font-family: 'Monaco', 'Menlo', monospace;">
          ${formattedOutput}
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div style="padding: 24px; background: #F9FAFB; border-top: 1px solid #E5E7EB; text-align: center;">
      <div style="margin-bottom: 16px;">
        <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=completed"
           style="display: inline-block; background: #10B981; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; margin-right: 8px; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);">
          ✓ Mark Complete
        </a>
        <a href="${FEEDBACK_URL}/feedback?view=dashboard"
           style="display: inline-block; background: #6366F1; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; box-shadow: 0 2px 8px rgba(99, 102, 241, 0.3);">
          View Dashboard
        </a>
      </div>

      <!-- Rating -->
      <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #E5E7EB;">
        <p style="color: #6B7280; font-size: 13px; margin: 0 0 10px 0;">How useful was this agent execution?</p>
        <div style="display: flex; gap: 6px; justify-content: center;">
          ${[1, 2, 3, 4, 5].map(rating => `
            <a href="${FEEDBACK_URL}/feedback?id=${insight.id}&rating=${rating}"
               style="display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; background: ${rating >= 4 ? '#10B981' : '#F3F4F6'}; color: ${rating >= 4 ? 'white' : '#6B7280'}; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; transition: all 0.2s;">
              ${rating}
            </a>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 24px; background: #1F2937; color: #9CA3AF; text-align: center;">
      <p style="margin: 0; font-size: 12px;">
        Autonomous execution powered by Claude AI<br>
        <span style="color: #6B7280;">Foresight Engine • Strategic Intelligence System</span>
      </p>
    </div>

  </div>

</body>
</html>`;
}

/**
 * Send agent error notification
 */
export async function sendAgentErrorNotification(insight, error, agentType = 'general') {
  const timestamp = new Date().toISOString();
  console.log(`[agent-report-email][${timestamp}] Sending agent error notification for insight ${insight.id}`);

  try {
    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    const emailHTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F9FAFB; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">

    <div style="background: linear-gradient(135deg, #DC2626, #EF4444); padding: 32px 24px; color: white; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
      <h1 style="margin: 0; font-size: 22px;">Agent Execution Error</h1>
    </div>

    <div style="padding: 28px 24px;">
      <h2 style="color: #1F2937; font-size: 16px; margin: 0 0 12px 0;">Mission</h2>
      <p style="color: #374151; margin: 0 0 20px 0; font-weight: 600;">${insight.title}</p>

      <div style="background: #FEF2F2; border-left: 4px solid #DC2626; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <h3 style="color: #991B1B; font-size: 14px; margin: 0 0 8px 0;">Error Details</h3>
        <p style="color: #7F1D1D; margin: 0; font-size: 13px; font-family: monospace;">${error}</p>
      </div>

      <p style="color: #6B7280; font-size: 14px; line-height: 1.6;">
        The agent encountered an error and could not complete the mission. Manual intervention may be required.
      </p>

      <div style="text-align: center; margin-top: 24px;">
        <a href="${FEEDBACK_URL}/action?id=${insight.id}&status=in_progress"
           style="display: inline-block; background: #6366F1; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600;">
          Review & Retry Manually
        </a>
      </div>
    </div>

  </div>
</body>
</html>`;

    const mailOptions = {
      from: `"Foresight Engine AI" <${process.env.SMTP_USER}>`,
      to: process.env.DELIVERY_EMAIL,
      subject: `⚠️ Agent Error: ${insight.title}`,
      html: emailHTML
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[agent-report-email] Error notification sent. Message ID: ${info.messageId}`);

    return { success: true, messageId: info.messageId };
  } catch (emailError) {
    console.error('[agent-report-email] Failed to send error notification:', emailError);
    return { success: false, error: emailError.message };
  }
}
