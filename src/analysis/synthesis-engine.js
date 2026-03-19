import Anthropic from '@anthropic-ai/sdk';
import { domains, strategicContext } from '../config/domains.js';
import {
  getUnprocessedSignals,
  markSignalsProcessed,
  insertInsight,
  getAllFeedbackStats
} from '../config/database.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4000;

/**
 * Cluster signals by domain and identify cross-domain signals
 */
function clusterSignals(signals) {
  const byDomain = {};
  const crossDomain = [];

  for (const signal of signals) {
    // Initialize domain cluster if needed
    if (!byDomain[signal.domain]) {
      byDomain[signal.domain] = [];
    }

    // Add to domain cluster
    byDomain[signal.domain].push(signal);

    // Identify cross-domain signals
    if (signal.crossDomainConnections && signal.crossDomainConnections.length > 0) {
      crossDomain.push(signal);
    }
  }

  return { byDomain, crossDomain };
}

/**
 * Format signals for Claude
 */
function formatSignalsForClaude(signals) {
  return signals.map((signal, index) => {
    return `[${index}] ${signal.title}
Source: ${signal.source} | Score: ${signal.relevanceScore} | Urgency: ${signal.urgencyLevel}
${signal.summary || '(No summary available)'}
Link: ${signal.link || 'N/A'}
${signal.crossDomainConnections?.length > 0 ? `Cross-domain connections: ${signal.crossDomainConnections.join(', ')}` : ''}
`;
  }).join('\n---\n');
}

/**
 * Call Claude to synthesize insights from a cluster of signals
 */
async function synthesizeDomainCluster(domain, signals, feedbackHistory) {
  const domainConfig = domains[domain];

  const prompt = `${strategicContext}

DOMAIN CONTEXT:
You are analyzing signals from the "${domainConfig.name}" domain.
Domain code: ${domainConfig.shortCode}
Priority level: ${domainConfig.priority}

${feedbackHistory ? `FEEDBACK HISTORY FOR THIS DOMAIN:\nAverage rating: ${feedbackHistory.avg_rating?.toFixed(2) || 'No data yet'}\nTotal feedback: ${feedbackHistory.total_feedback || 0}\nActed on: ${feedbackHistory.acted_on_count || 0}\nMarked irrelevant: ${feedbackHistory.irrelevant_count || 0}\n\n` : ''}

SIGNALS TO ANALYZE:
${formatSignalsForClaude(signals)}

INSTRUCTIONS:
Produce 2-5 high-quality insights from these signals. Each insight must be:
- SPECIFIC: Not generic advice, but tied to the wealth architect's actual position
- ACTIONABLE: Include a concrete next step for THIS WEEK
- DUAL-LENS: Address both individual AND collective wealth creation when applicable

Return your analysis as a JSON array. Each insight object must have:
- title: Specific, punchy insight title (not generic)
- analysis: 2-3 sentences connecting signal to strategic advantage, second-order effects
- actionRecommendation: Concrete next step for THIS WEEK
- insightType: "signal" (new information), "pattern" (trend/theme), or "action_trigger" (time-sensitive opportunity)
- relevanceScore: 1-100 based on strategic fit, timing urgency, and moat potential
- supportingSignalIndices: Array of signal indices [0, 1, 2, etc.] that support this insight

Return ONLY the JSON array, no other text.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;

    // Parse JSON response (strip markdown backticks if present)
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const insights = JSON.parse(jsonText);

    // Store insights in database
    const insightIds = [];
    for (const insight of insights) {
      const supportingSignalIds = (insight.supportingSignalIndices || [])
        .map(idx => signals[idx]?.id)
        .filter(Boolean);

      const insightId = insertInsight({
        domain,
        insightType: insight.insightType,
        title: insight.title,
        analysis: insight.analysis,
        actionRecommendation: insight.actionRecommendation,
        relevanceScore: insight.relevanceScore,
        supportingSignalIds
      });

      insightIds.push(insightId);
    }

    return { success: true, insightCount: insights.length, insightIds };
  } catch (error) {
    console.error(`[synthesis-engine] Failed to synthesize domain ${domain}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Call Claude to synthesize cross-domain connections
 */
async function synthesizeCrossDomainConnections(crossDomainSignals) {
  if (crossDomainSignals.length === 0) return { success: true, insightCount: 0, insightIds: [] };

  const prompt = `${strategicContext}

CROSS-DOMAIN ANALYSIS:
You are analyzing signals that bridge multiple domains. These are the HIGHEST-VALUE signals because they reveal non-obvious connections and compounding effects.

CROSS-DOMAIN SIGNALS:
${formatSignalsForClaude(crossDomainSignals)}

INSTRUCTIONS:
Identify 1-3 powerful cross-domain insights. Focus on:
- How domains REINFORCE each other (e.g., AI + real estate, consciousness + business strategy)
- COMPOUNDING EFFECTS: Where advantage in one domain amplifies advantage in another
- TIMING WINDOWS: Opportunities that exist precisely because two trends are converging NOW
- ARBITRAGE: Information from one domain that creates advantage in another

Each insight must:
- Show clear mechanism for how domains connect
- Explain why this connection matters for BOTH individual and collective wealth
- Provide specific action that exploits the cross-domain advantage

Return your analysis as a JSON array. Each insight object must have:
- title: Specific title highlighting the cross-domain connection
- analysis: 2-3 sentences on mechanism, compounding effects, and strategic importance
- actionRecommendation: Concrete next step to capture the cross-domain advantage
- insightType: MUST be "cross_domain"
- relevanceScore: 1-100 (cross-domain insights should score higher)
- supportingSignalIndices: Array of signal indices

Return ONLY the JSON array, no other text.`;

  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0.7,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    const jsonText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const insights = JSON.parse(jsonText);

    const insightIds = [];
    for (const insight of insights) {
      const supportingSignalIds = (insight.supportingSignalIndices || [])
        .map(idx => crossDomainSignals[idx]?.id)
        .filter(Boolean);

      const insightId = insertInsight({
        domain: 'cross_domain',
        insightType: 'cross_domain',
        title: insight.title,
        analysis: insight.analysis,
        actionRecommendation: insight.actionRecommendation,
        relevanceScore: insight.relevanceScore,
        supportingSignalIds
      });

      insightIds.push(insightId);
    }

    return { success: true, insightCount: insights.length, insightIds };
  } catch (error) {
    console.error('[synthesis-engine] Failed to synthesize cross-domain connections:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main synthesis function: analyze unprocessed signals and generate insights
 */
export async function synthesizeInsights() {
  const timestamp = new Date().toISOString();
  console.log(`[synthesis-engine][${timestamp}] Starting synthesis`);

  // Get unprocessed signals (limit 60 to avoid token overflow)
  const signals = getUnprocessedSignals(60);

  if (signals.length === 0) {
    console.log('[synthesis-engine] No unprocessed signals to synthesize');
    return {
      totalInsights: 0,
      byDomain: {},
      errors: []
    };
  }

  console.log(`[synthesis-engine] Synthesizing ${signals.length} signals`);

  // Cluster signals
  const { byDomain, crossDomain } = clusterSignals(signals);

  // Get feedback history
  const feedbackStats = getAllFeedbackStats();
  const feedbackByDomain = {};
  for (const stat of feedbackStats) {
    feedbackByDomain[stat.domain] = stat;
  }

  const results = {
    totalInsights: 0,
    byDomain: {},
    errors: []
  };

  // Synthesize each domain cluster
  for (const [domain, domainSignals] of Object.entries(byDomain)) {
    if (domainSignals.length === 0) continue;

    console.log(`[synthesis-engine] Synthesizing ${domainSignals.length} signals for domain: ${domain}`);

    const result = await synthesizeDomainCluster(
      domain,
      domainSignals,
      feedbackByDomain[domain]
    );

    if (result.success) {
      results.byDomain[domain] = result.insightCount;
      results.totalInsights += result.insightCount;
    } else {
      results.errors.push({
        domain,
        error: result.error
      });
    }

    // Rate limiting: pause between Claude API calls
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Synthesize cross-domain connections
  if (crossDomain.length > 0) {
    console.log(`[synthesis-engine] Synthesizing ${crossDomain.length} cross-domain signals`);

    const result = await synthesizeCrossDomainConnections(crossDomain);

    if (result.success) {
      results.byDomain.cross_domain = result.insightCount;
      results.totalInsights += result.insightCount;
    } else {
      results.errors.push({
        domain: 'cross_domain',
        error: result.error
      });
    }
  }

  // Mark all signals as processed
  const signalIds = signals.map(s => s.id);
  markSignalsProcessed(signalIds);

  const endTimestamp = new Date().toISOString();
  console.log(`[synthesis-engine][${endTimestamp}] Synthesis complete:`, {
    totalInsights: results.totalInsights,
    byDomain: results.byDomain,
    errorCount: results.errors.length
  });

  return results;
}
