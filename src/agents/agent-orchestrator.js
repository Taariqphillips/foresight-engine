import Anthropic from '@anthropic-ai/sdk';
import { updateInsightAction, getInsightById } from '../config/database.js';
import {
  validateAgentPrompt,
  createSandboxWorkspace,
  cleanupSandboxWorkspace,
  getSandboxStatus,
  logSecurityEvent
} from './sandbox-enforcer.js';
import { getAllowedTools, isSandboxEnabled } from './sandbox-config.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Model with computer use capabilities
const AGENT_MODEL = 'claude-3-5-sonnet-20241022';
const MAX_AGENT_TOKENS = 8000;

/**
 * Delegate an insight's execution to an autonomous Claude agent
 */
export async function delegateToAgent(insight) {
  const timestamp = new Date().toISOString();
  console.log(`[agent-orchestrator][${timestamp}] Delegating insight ${insight.id} to agent`);

  // Update status to delegated
  updateInsightAction(insight.id, 'delegated', 'Agent spawned, initializing execution...');

  try {
    // Determine agent type based on insight content
    const agentType = determineAgentType(insight);
    console.log(`[agent-orchestrator] Agent type: ${agentType}`);

    // Build agent prompt with OPORD context
    const agentPrompt = buildAgentPrompt(insight, agentType);

    // Spawn agent with computer use capabilities
    const agentResult = await spawnAgent(agentPrompt, insight.id, agentType);

    return agentResult;
  } catch (error) {
    console.error(`[agent-orchestrator] Error delegating to agent:`, error);
    updateInsightAction(insight.id, 'in_progress', `Agent error: ${error.message}`);

    return {
      success: false,
      error: error.message,
      insightId: insight.id
    };
  }
}

/**
 * Determine which type of agent to spawn based on insight content
 */
function determineAgentType(insight) {
  const executionText = JSON.stringify(insight.execution || []).toLowerCase();
  const title = (insight.title || '').toLowerCase();
  const situation = (insight.situation || '').toLowerCase();

  const allText = `${executionText} ${title} ${situation}`;

  // Trading signals
  if (allText.match(/\b(buy|sell|trade|invest|purchase|allocate|position)\b/)) {
    return 'trading';
  }

  // Research signals
  if (allText.match(/\b(research|analyze|investigate|study|review|compare)\b/)) {
    return 'research';
  }

  // Monitoring signals
  if (allText.match(/\b(monitor|track|watch|observe|follow)\b/)) {
    return 'monitoring';
  }

  // Data gathering signals
  if (allText.match(/\b(gather|collect|compile|scrape|extract)\b/)) {
    return 'data_gathering';
  }

  return 'general';
}

/**
 * Build agent prompt using OPORD structure
 */
function buildAgentPrompt(insight, agentType) {
  const execution = Array.isArray(insight.execution) ? insight.execution : [];
  const resources = Array.isArray(insight.resources) ? insight.resources : [];

  return `You are an autonomous investment intelligence agent executing on behalf of Taariq Phillips, a strategic investor building generational wealth.

═══════════════════════════════════════════════════════
MISSION BRIEF
═══════════════════════════════════════════════════════

TITLE: ${insight.title}
TYPE: ${insight.insight_type}
PRIORITY: ${insight.relevance_score}/100
AGENT MODE: ${agentType.toUpperCase()}

═══════════════════════════════════════════════════════
SITUATION
═══════════════════════════════════════════════════════

${insight.situation || 'Context not provided'}

═══════════════════════════════════════════════════════
IMPLICATION
═══════════════════════════════════════════════════════

${insight.implication || 'Strategic implications require analysis'}

═══════════════════════════════════════════════════════
EXECUTION TASKS
═══════════════════════════════════════════════════════

${execution.length > 0 ? execution.map((step, i) => `${i + 1}. ${step}`).join('\n') : 'No specific tasks defined'}

═══════════════════════════════════════════════════════
RESOURCES AVAILABLE
═══════════════════════════════════════════════════════

${resources.length > 0 ? resources.join('\n') : 'Standard web research capabilities'}

═══════════════════════════════════════════════════════
TIMELINE
═══════════════════════════════════════════════════════

${insight.timeline || 'Execute as soon as feasible'}

═══════════════════════════════════════════════════════
AGENT CAPABILITIES & CONSTRAINTS
═══════════════════════════════════════════════════════

YOU HAVE ACCESS TO:
- Web browsing and navigation
- Web search (Google, Bing, specialized databases)
- Data extraction and analysis
- Document reading and summarization
- Screenshot capture
- Text editing and file creation

${getAgentSpecificInstructions(agentType)}

EXECUTION CONSTRAINTS:
1. Verify all data from multiple sources before reporting
2. For financial actions over $10,000, prepare details but DO NOT execute - request manual approval
3. Document all steps taken with clear reasoning
4. If you encounter errors or blocks, attempt alternative approaches
5. Prioritize accuracy over speed
6. Maintain operational security - do not expose credentials or sensitive data
7. Provide a clear, structured final report

═══════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════

At the end of your execution, provide a structured report in this format:

## MISSION SUMMARY
[One paragraph summarizing what you accomplished]

## EXECUTION LOG
[Bullet points of key steps taken]

## FINDINGS & DATA
[Detailed findings, data points, analysis results]

## RECOMMENDATIONS
[Next steps or follow-up actions needed]

## BLOCKERS & ISSUES
[Any problems encountered or items requiring manual intervention]

═══════════════════════════════════════════════════════

BEGIN EXECUTION NOW.`;
}

/**
 * Get agent-specific instructions based on type
 */
function getAgentSpecificInstructions(agentType) {
  switch (agentType) {
    case 'trading':
      return `
TRADING AGENT INSTRUCTIONS:
- DO NOT execute any trades without explicit approval
- Research the identified securities thoroughly (financials, news, analyst ratings)
- Gather current pricing, volume, and technical indicators
- Compare recommendations against investment criteria
- Prepare detailed trade specifications (ticker, quantity, order type, limit price)
- Calculate position sizing based on portfolio allocation rules
- Identify risks and provide risk assessment
- For trades >$10K, prepare order details and request approval
- For trades <$10K, still prepare details but flag for review`;

    case 'research':
      return `
RESEARCH AGENT INSTRUCTIONS:
- Conduct comprehensive research across multiple authoritative sources
- Verify claims and data points through cross-referencing
- Synthesize information into clear, actionable insights
- Identify key metrics, trends, and data points
- Highlight areas of uncertainty or conflicting information
- Provide source citations for all major claims
- Focus on strategic implications for wealth building`;

    case 'monitoring':
      return `
MONITORING AGENT INSTRUCTIONS:
- Track specified metrics, securities, or market conditions
- Set up alerts or bookmarks for ongoing observation
- Gather current state vs. historical context
- Identify notable changes, anomalies, or trends
- Provide regular status updates
- Flag urgent developments immediately`;

    case 'data_gathering':
      return `
DATA GATHERING AGENT INSTRUCTIONS:
- Systematically collect requested data points
- Organize data in structured formats (tables, lists, JSON)
- Ensure data completeness and accuracy
- Note any missing or unavailable data
- Provide data sources and collection timestamps
- Clean and validate data before reporting`;

    default:
      return `
GENERAL AGENT INSTRUCTIONS:
- Adapt your approach based on the specific tasks
- Use best judgment to interpret and execute directives
- Prioritize high-value actions
- Be resourceful in finding information
- Document your decision-making process`;
  }
}

/**
 * Spawn Claude agent with computer use capabilities (sandboxed)
 */
async function spawnAgent(prompt, insightId, agentType) {
  const timestamp = new Date().toISOString();
  console.log(`[agent-orchestrator][${timestamp}] Spawning ${agentType} agent for insight ${insightId}`);

  try {
    // Create sandbox workspace
    const workspace = await createSandboxWorkspace(insightId);
    if (!workspace.success) {
      throw new Error(`Failed to create sandbox workspace: ${workspace.error}`);
    }

    // Validate prompt and apply sandbox constraints
    const validation = validateAgentPrompt(prompt, agentType, insightId);
    if (!validation.valid) {
      throw new Error('Prompt validation failed');
    }

    const sandboxedPrompt = validation.sandboxedPrompt || prompt;

    // Get allowed tools for this agent type
    const allowedTools = getAllowedTools(agentType);

    // Log sandbox status
    const sandboxStatus = getSandboxStatus(agentType);
    console.log(`[agent-orchestrator] Sandbox status:`, sandboxStatus);
    logSecurityEvent('AGENT_SPAWNED', agentType, insightId, {
      sandboxEnabled: sandboxStatus.enabled,
      mode: sandboxStatus.mode,
      toolsAvailable: allowedTools.length,
      permissions: sandboxStatus.permissions
    });

    // Create message with sandbox-restricted tools
    const response = await anthropic.messages.create({
      model: AGENT_MODEL,
      max_tokens: MAX_AGENT_TOKENS,
      messages: [{
        role: 'user',
        content: sandboxedPrompt
      }],
      tools: allowedTools.length > 0 ? allowedTools : undefined
    });

    // Extract agent output
    const agentOutput = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n\n');

    const endTimestamp = new Date().toISOString();
    console.log(`[agent-orchestrator][${endTimestamp}] Agent completed for insight ${insightId}`);
    console.log(`[agent-orchestrator] Output length: ${agentOutput.length} characters`);

    // Update insight with completion status and truncated output
    const truncatedOutput = agentOutput.length > 1000
      ? agentOutput.substring(0, 1000) + '... (truncated, see email for full report)'
      : agentOutput;

    updateInsightAction(
      insightId,
      'completed',
      `Agent execution complete. ${truncatedOutput}`
    );

    // Log successful completion
    logSecurityEvent('AGENT_COMPLETED', agentType, insightId, {
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      outputLength: agentOutput.length
    });

    // Cleanup sandbox workspace (keep files for review)
    await cleanupSandboxWorkspace(insightId, true);

    return {
      success: true,
      output: agentOutput,
      insightId,
      agentType,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      sandboxStatus
    };

  } catch (error) {
    const errorTimestamp = new Date().toISOString();
    console.error(`[agent-orchestrator][${errorTimestamp}] Agent failed for insight ${insightId}:`, error);

    // Log security event for failure
    logSecurityEvent('AGENT_FAILED', agentType, insightId, {
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    updateInsightAction(
      insightId,
      'in_progress',
      `Agent encountered error: ${error.message}. Manual review required.`
    );

    // Cleanup sandbox workspace on error
    await cleanupSandboxWorkspace(insightId, false);

    return {
      success: false,
      error: error.message,
      insightId,
      agentType
    };
  }
}

/**
 * Get agent execution history for an insight
 */
export function getAgentExecutionLog(insightId) {
  const insight = getInsightById(insightId);

  if (!insight) {
    return null;
  }

  return {
    insightId: insight.id,
    status: insight.action_status,
    notes: insight.action_notes,
    lastUpdated: insight.action_updated_at
  };
}
