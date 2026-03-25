/**
 * Test script for sandbox agent execution
 * Tests a safe research agent with strict sandbox constraints
 */

import 'dotenv/config';
import { initializeDatabase, insertInsight, getInsightById } from './src/config/database.js';
import { delegateToAgent } from './src/agents/agent-orchestrator.js';

// Initialize database
initializeDatabase();

// Create a test research insight
const testInsight = {
  domain: 'AI-PROD',
  insightType: 'signal',
  title: 'OpenAI GPT-5 Capabilities Research',
  situation: 'OpenAI has announced preliminary details about GPT-5, expected to launch in Q2 2026. Early reports suggest major improvements in reasoning, multimodal capabilities, and reduced hallucinations. This represents a potential paradigm shift in AI capabilities.',
  implication: 'If GPT-5 delivers on promises, it could accelerate AI adoption across enterprise sectors and create new opportunities for AI-native businesses. Companies not adapting risk competitive disadvantage within 12-18 months.',
  execution: [
    'Research official OpenAI announcements and technical papers about GPT-5',
    'Analyze competitor responses (Anthropic Claude, Google Gemini, Meta Llama)',
    'Identify specific capability improvements over GPT-4',
    'Assess potential business applications and use cases',
    'Compile findings into structured report with sources'
  ],
  resources: [
    'OpenAI official blog and research papers',
    'Tech news sources (TechCrunch, The Verge, ArsTechnica)',
    'Industry analyst reports',
    'Academic AI research databases'
  ],
  timeline: 'This week',
  relevanceScore: 88
};

console.log('═══════════════════════════════════════════════════════');
console.log('SANDBOX AGENT TEST');
console.log('═══════════════════════════════════════════════════════');
console.log('\n📝 Creating test insight...\n');

// Insert test insight
const insightId = insertInsight(testInsight);
console.log(`✅ Test insight created: ${insightId}`);

// Retrieve the insight (to get full database record)
const insight = getInsightById(insightId);

console.log('\n📋 Insight Details:');
console.log(`   Title: ${insight.title}`);
console.log(`   Type: ${insight.insight_type}`);
console.log(`   Domain: ${insight.domain}`);
console.log(`   Score: ${insight.relevance_score}/100`);

console.log('\n🔒 Sandbox Configuration:');
console.log(`   Mode: ${process.env.AGENT_SANDBOX_MODE || 'strict'}`);
console.log(`   Dry Run: ${process.env.AGENT_DRY_RUN || 'false'}`);

console.log('\n🤖 Delegating to research agent...');
console.log('   Expected Agent Type: research');
console.log('   Allowed Tools: web_search_20260209, web_fetch_20260309');
console.log('   Blocked Tools: Bash, file editing');
console.log('   Max Searches: 20');
console.log('   Max Fetches: 50');

console.log('\n⏳ Agent is executing (this may take 1-3 minutes)...\n');

// Delegate to agent
delegateToAgent(insight).then(result => {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('AGENT EXECUTION COMPLETE');
  console.log('═══════════════════════════════════════════════════════\n');

  if (result.success) {
    console.log('✅ Status: SUCCESS\n');
    console.log(`📊 Tokens Used: ${result.tokensUsed}`);
    console.log(`📝 Output Length: ${result.output.length} characters`);

    if (result.sandboxStatus) {
      console.log('\n🔒 Sandbox Status:');
      console.log(`   Enabled: ${result.sandboxStatus.enabled}`);
      console.log(`   Mode: ${result.sandboxStatus.mode}`);
      console.log(`   Agent Type: ${result.sandboxStatus.agentType}`);
      console.log(`   Tools Available: ${result.sandboxStatus.toolsAvailable.length}`);
      console.log(`   Permissions:`, result.sandboxStatus.permissions);
    }

    console.log('\n📄 Agent Output (first 1000 chars):');
    console.log('─'.repeat(60));
    console.log(result.output.substring(0, 1000));
    console.log('─'.repeat(60));

    console.log('\n✉️  Check your email for the full agent report!');
    console.log(`📂 Workspace: /data/agent-workspace/${insightId}/`);

  } else {
    console.log('❌ Status: FAILED\n');
    console.log(`Error: ${result.error}`);
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`View full results: http://localhost:3000/feedback?view=dashboard`);
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(result.success ? 0 : 1);

}).catch(error => {
  console.error('\n❌ FATAL ERROR:', error);
  console.error(error.stack);
  process.exit(1);
});
