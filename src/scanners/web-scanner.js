import { domains, feedbackWeights } from '../config/domains.js';
import { insertSignal, getLearnedWeight } from '../config/database.js';

/**
 * Calculate relevance score for web search results
 * Similar to RSS scanner but with slightly higher base score since these are actively searched
 */
function calculateRelevanceScore(result, domain, domainConfig, query) {
  const text = `${result.title || ''} ${result.description || ''}`.toLowerCase();

  // Base score for web search signals (slightly higher than RSS)
  let score = 35;

  // Boost for domain-specific keywords
  let keywordMatches = 0;
  for (const keyword of domainConfig.boostKeywords) {
    if (text.includes(keyword.toLowerCase())) {
      keywordMatches++;
      if (keywordMatches <= 3) {
        score += 8;
      } else if (keywordMatches <= 5) {
        score += 4;
      } else {
        score += 2;
      }
    }
  }

  // Check for cross-domain connections
  const crossDomainConnections = [];
  for (const [otherDomainKey, otherDomain] of Object.entries(domains)) {
    if (otherDomainKey === domain) continue;

    for (const trigger of otherDomain.connectionTriggers) {
      if (text.includes(trigger.toLowerCase())) {
        crossDomainConnections.push(otherDomain.shortCode);
        score += feedbackWeights.crossDomainBonus;
        break;
      }
    }
  }

  // Apply learned weights
  const domainWeight = getLearnedWeight('domain', domain);
  score += domainWeight * 10;

  return {
    score: Math.max(0, Math.round(score)),
    crossDomainConnections: [...new Set(crossDomainConnections)]
  };
}

/**
 * Determine urgency level based on relevance score
 */
function determineUrgency(score) {
  if (score >= 85) return 'act_now';
  if (score >= 65) return 'this_week';
  if (score >= 45) return 'monitor';
  return 'background';
}

/**
 * Execute a web search using NewsAPI (if configured)
 */
async function searchNewsAPI(query, domain, domainConfig) {
  const apiKey = process.env.NEWSAPI_KEY;

  if (!apiKey || apiKey === 'optional_key_here') {
    // NewsAPI not configured - create placeholder signal for synthesis layer
    return {
      success: false,
      reason: 'newsapi_not_configured',
      query
    };
  }

  try {
    const url = new URL('https://newsapi.org/v2/everything');
    url.searchParams.append('q', query);
    url.searchParams.append('language', 'en');
    url.searchParams.append('sortBy', 'relevancy');
    url.searchParams.append('pageSize', '5'); // Top 5 results per query
    url.searchParams.append('apiKey', apiKey);

    // Only get articles from last 48 hours
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    url.searchParams.append('from', twoDaysAgo);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'ok') {
      throw new Error(data.message || 'NewsAPI request failed');
    }

    const signals = [];

    for (const article of data.articles || []) {
      const { score, crossDomainConnections } = calculateRelevanceScore(
        { title: article.title, description: article.description },
        domain,
        domainConfig,
        query
      );

      // Only store high-relevance web signals
      if (score < 30) continue;

      const urgencyLevel = determineUrgency(score);

      const signal = {
        domain,
        source: article.source?.name || 'NewsAPI',
        sourceType: 'web',
        title: article.title,
        link: article.url,
        summary: article.description || '',
        publishedAt: article.publishedAt,
        relevanceScore: score,
        urgencyLevel,
        crossDomainConnections
      };

      insertSignal(signal);
      signals.push(signal);
    }

    return { success: true, signalsCount: signals.length, query };
  } catch (error) {
    console.error(`[web-scanner] NewsAPI search failed for "${query}":`, error.message);
    return { success: false, error: error.message, query };
  }
}

/**
 * Select which queries to run for a domain based on rotation
 * Uses day-of-year + hour as seed so we cycle through queries
 */
function selectQueries(searchQueries, count = 3) {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  const seed = dayOfYear * 24 + now.getHours();

  // Rotate through queries deterministically
  const selectedQueries = [];
  for (let i = 0; i < count && i < searchQueries.length; i++) {
    const index = (seed + i) % searchQueries.length;
    selectedQueries.push(searchQueries[index]);
  }

  return selectedQueries;
}

/**
 * Run web searches across all domains
 */
export async function runWebSearches() {
  const timestamp = new Date().toISOString();
  console.log(`[web-scanner][${timestamp}] Starting web search scan`);

  const results = {
    totalSignals: 0,
    byDomain: {},
    errors: []
  };

  for (const [domainKey, domainConfig] of Object.entries(domains)) {
    console.log(`[web-scanner] Searching domain: ${domainConfig.name}`);
    results.byDomain[domainKey] = 0;

    // Select 2-3 queries for this domain based on rotation
    const queriesToRun = selectQueries(domainConfig.searchQueries, 3);

    for (const query of queriesToRun) {
      const result = await searchNewsAPI(query, domainKey, domainConfig);

      if (result.success) {
        results.byDomain[domainKey] += result.signalsCount;
        results.totalSignals += result.signalsCount;
      } else if (result.reason === 'newsapi_not_configured') {
        // Silent skip - NewsAPI is optional
        continue;
      } else {
        results.errors.push({
          query: result.query,
          error: result.error
        });
      }

      // Rate limiting: delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  const endTimestamp = new Date().toISOString();
  console.log(`[web-scanner][${endTimestamp}] Web search complete:`, {
    totalSignals: results.totalSignals,
    byDomain: results.byDomain,
    errorCount: results.errors.length
  });

  return results;
}
