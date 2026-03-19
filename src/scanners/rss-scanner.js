import Parser from 'rss-parser';
import { domains, feedbackWeights } from '../config/domains.js';
import { insertSignal, getLearnedWeight } from '../config/database.js';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'ForesightEngine/1.0'
  }
});

/**
 * Calculate relevance score for a signal based on keywords, cross-domain connections,
 * and learned weights from user feedback
 */
function calculateRelevanceScore(item, domain, domainConfig) {
  const text = `${item.title || ''} ${item.contentSnippet || ''} ${item.summary || ''}`.toLowerCase();

  // Base score for RSS signals
  let score = 30;

  // Boost for domain-specific keywords (with diminishing returns)
  let keywordMatches = 0;
  for (const keyword of domainConfig.boostKeywords) {
    if (text.includes(keyword.toLowerCase())) {
      keywordMatches++;
      // Diminishing returns: 8 points for first 3, 4 points for next 2, 2 points after
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
    if (otherDomainKey === domain) continue; // Skip same domain

    for (const trigger of otherDomain.connectionTriggers) {
      if (text.includes(trigger.toLowerCase())) {
        crossDomainConnections.push(otherDomain.shortCode);
        score += feedbackWeights.crossDomainBonus;
        break; // One bonus per domain
      }
    }
  }

  // Apply learned weight adjustments
  const domainWeight = getLearnedWeight('domain', domain);
  score += domainWeight * 10; // Scale the learned weight

  return {
    score: Math.max(0, Math.round(score)), // Ensure non-negative
    crossDomainConnections: [...new Set(crossDomainConnections)] // Remove duplicates
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
 * Scan a single RSS feed
 */
async function scanFeed(feedUrl, domain, domainConfig) {
  try {
    const feed = await parser.parseURL(feedUrl);
    const signals = [];

    for (const item of feed.items) {
      // Skip signals older than 48 hours
      const publishedDate = item.pubDate ? new Date(item.pubDate) : new Date();
      const hoursOld = (Date.now() - publishedDate.getTime()) / (1000 * 60 * 60);
      if (hoursOld > 48) continue;

      // Calculate relevance
      const { score, crossDomainConnections } = calculateRelevanceScore(item, domain, domainConfig);

      // Only store signals with meaningful relevance
      if (score < 25) continue;

      const urgencyLevel = determineUrgency(score);

      const signal = {
        domain,
        source: feedUrl,
        sourceType: 'rss',
        title: item.title || 'Untitled',
        link: item.link,
        summary: item.contentSnippet || item.summary || '',
        publishedAt: publishedDate.toISOString(),
        relevanceScore: score,
        urgencyLevel,
        crossDomainConnections
      };

      insertSignal(signal);
      signals.push(signal);
    }

    return { success: true, signalsCount: signals.length, feedUrl };
  } catch (error) {
    console.error(`[rss-scanner] Failed to scan ${feedUrl}:`, error.message);
    return { success: false, error: error.message, feedUrl };
  }
}

/**
 * Scan all RSS feeds across all domains
 */
export async function scanAllFeeds() {
  const timestamp = new Date().toISOString();
  console.log(`[rss-scanner][${timestamp}] Starting RSS scan across all domains`);

  const results = {
    totalSignals: 0,
    byDomain: {},
    errors: []
  };

  for (const [domainKey, domainConfig] of Object.entries(domains)) {
    console.log(`[rss-scanner] Scanning domain: ${domainConfig.name}`);
    results.byDomain[domainKey] = 0;

    for (const feedUrl of domainConfig.rssFeeds) {
      const result = await scanFeed(feedUrl, domainKey, domainConfig);

      if (result.success) {
        results.byDomain[domainKey] += result.signalsCount;
        results.totalSignals += result.signalsCount;
      } else {
        results.errors.push({
          feed: result.feedUrl,
          error: result.error
        });
      }

      // Rate limiting: small delay between feeds
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const endTimestamp = new Date().toISOString();
  console.log(`[rss-scanner][${endTimestamp}] RSS scan complete:`, {
    totalSignals: results.totalSignals,
    byDomain: results.byDomain,
    errorCount: results.errors.length
  });

  return results;
}
