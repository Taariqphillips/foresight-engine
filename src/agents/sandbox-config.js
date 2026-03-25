/**
 * Agent Sandbox Configuration
 *
 * Defines security boundaries and permissions for autonomous agents
 * to prevent unrestricted system access and ensure safe execution.
 */

// Sandbox modes
export const SANDBOX_MODE = process.env.AGENT_SANDBOX_MODE || 'strict'; // 'strict', 'moderate', 'permissive', 'disabled'

// Global sandbox settings
export const GLOBAL_LIMITS = {
  maxExecutionTime: 300000,        // 5 minutes max per agent
  maxTokens: 8000,                 // Token limit per agent
  maxFileSize: 10485760,           // 10MB max file read/write
  allowedNetworkDomains: [
    'google.com',
    'bing.com',
    'wikipedia.org',
    'sec.gov',
    'finviz.com',
    'yahoo.com',
    'marketwatch.com',
    'bloomberg.com',
    'reuters.com',
    'anthropic.com',
    'github.com',
    'stackoverflow.com'
  ],
  blockedNetworkDomains: [
    'localhost',
    '127.0.0.1',
    '0.0.0.0',
    '192.168.*',
    '10.*',
    'internal',
    'admin'
  ]
};

// Bash command whitelist (commands that are ALLOWED)
export const BASH_WHITELIST = [
  // Read-only operations
  'ls', 'cat', 'head', 'tail', 'grep', 'find', 'which', 'whereis',
  'pwd', 'whoami', 'date', 'uname', 'df', 'du',

  // Web operations (read-only)
  'curl', 'wget',

  // Data processing
  'jq', 'sed', 'awk', 'sort', 'uniq', 'wc', 'diff',

  // Safe git operations (read-only)
  'git log', 'git status', 'git show', 'git diff', 'git branch',

  // Python/Node (read-only execution)
  'python', 'node', 'npm'
];

// Bash command blacklist (commands that are NEVER allowed)
export const BASH_BLACKLIST = [
  // Destructive operations
  'rm', 'rmdir', 'dd', 'shred', 'wipe',

  // System modification
  'chmod', 'chown', 'chgrp', 'sudo', 'su',

  // Process control
  'kill', 'killall', 'pkill',

  // Network attacks
  'nmap', 'netcat', 'nc',

  // System control
  'shutdown', 'reboot', 'halt', 'init',

  // Package management
  'apt', 'yum', 'brew install', 'npm install -g', 'pip install',

  // Dangerous scripting
  'eval', 'exec', 'source',

  // File transfer
  'scp', 'rsync', 'ftp', 'sftp',

  // Compilation
  'gcc', 'g++', 'make', 'cmake'
];

// File system access controls
export const FILESYSTEM_RULES = {
  // Directories that can be READ
  allowedReadPaths: [
    '/tmp/agent-sandbox',
    '/Users/pfmanagementgroup/projects/foresight-engine/data/agent-workspace'
  ],

  // Directories that can be WRITTEN
  allowedWritePaths: [
    '/tmp/agent-sandbox',
    '/Users/pfmanagementgroup/projects/foresight-engine/data/agent-workspace'
  ],

  // Directories that are FORBIDDEN (never accessible)
  forbiddenPaths: [
    '/etc',
    '/var',
    '/usr',
    '/bin',
    '/sbin',
    '/System',
    '/Library',
    '~/.ssh',
    '~/.aws',
    '~/.config',
    process.env.HOME + '/.ssh',
    process.env.HOME + '/.aws',
    process.env.HOME + '/.env'
  ]
};

// Agent type-specific permissions
export const AGENT_PERMISSIONS = {
  research: {
    allowedTools: ['web_search_20260209', 'web_fetch_20260309'],  // Web search + fetch
    bashEnabled: false,
    fileEditingEnabled: false,
    webSearchEnabled: true,
    webFetchEnabled: true,
    requireApprovalFor: ['download_file'],
    maxSearches: 20,
    maxFetches: 50
  },

  data_gathering: {
    allowedTools: ['web_search_20260209', 'web_fetch_20260309', 'text_editor_20250728'],  // Web + text editor
    bashEnabled: false,
    fileEditingEnabled: true,  // Can create data files in sandbox
    webSearchEnabled: true,
    webFetchEnabled: true,
    requireApprovalFor: ['download_file', 'large_file_write'],  // Files > 1MB
    maxSearches: 30,
    maxFetches: 100
  },

  monitoring: {
    allowedTools: ['web_search_20260209', 'web_fetch_20260309'],  // Web search + fetch
    bashEnabled: false,
    fileEditingEnabled: false,
    webSearchEnabled: true,
    webFetchEnabled: true,
    requireApprovalFor: ['download_file'],
    maxSearches: 10,
    maxFetches: 20
  },

  trading: {
    allowedTools: [],  // NO TOOLS by default - trading is human-in-the-loop only
    bashEnabled: false,
    fileEditingEnabled: false,
    webSearchEnabled: false,
    webFetchEnabled: false,
    requireApprovalFor: ['*'],  // Everything requires approval
    maxSearches: 5,
    maxFetches: 10,
    alwaysDryRun: true  // Trading agents always run in dry-run mode
  },

  general: {
    allowedTools: ['web_search_20260209', 'web_fetch_20260309'],  // Web search + fetch
    bashEnabled: false,
    fileEditingEnabled: false,
    webSearchEnabled: true,
    webFetchEnabled: true,
    requireApprovalFor: ['download_file'],
    maxSearches: 15,
    maxFetches: 30
  }
};

// Actions that require manual approval (across all agent types)
export const APPROVAL_REQUIRED_ACTIONS = [
  'execute_trade',
  'submit_payment',
  'delete_data',
  'send_email',
  'post_to_social_media',
  'create_account',
  'change_password',
  'access_financial_account',
  'sign_document',
  'make_purchase'
];

// Dry-run mode settings
export const DRY_RUN_CONFIG = {
  enabled: process.env.AGENT_DRY_RUN === 'true',  // Set to 'true' to enable globally
  logActions: true,
  simulateDelay: true,  // Simulate action delays for realism
  returnMockData: true
};

/**
 * Get sandbox configuration for a specific agent type
 */
export function getSandboxConfig(agentType) {
  const permissions = AGENT_PERMISSIONS[agentType] || AGENT_PERMISSIONS.general;

  return {
    agentType,
    sandboxMode: SANDBOX_MODE,
    permissions,
    globalLimits: GLOBAL_LIMITS,
    bashWhitelist: BASH_WHITELIST,
    bashBlacklist: BASH_BLACKLIST,
    filesystemRules: FILESYSTEM_RULES,
    approvalRequired: APPROVAL_REQUIRED_ACTIONS,
    dryRun: DRY_RUN_CONFIG
  };
}

/**
 * Check if sandbox is enabled
 */
export function isSandboxEnabled() {
  return SANDBOX_MODE !== 'disabled';
}

/**
 * Get tools allowed for agent type
 */
export function getAllowedTools(agentType) {
  const permissions = AGENT_PERMISSIONS[agentType] || AGENT_PERMISSIONS.general;

  if (SANDBOX_MODE === 'disabled') {
    // Full access when sandbox disabled
    return [
      { type: 'web_search_20260209' },
      { type: 'web_fetch_20260309' },
      { type: 'text_editor_20250728' },
      { type: 'bash_20250124' }
    ];
  }

  const tools = [];

  // Add web search if enabled
  if (permissions.webSearchEnabled && permissions.allowedTools.includes('web_search_20260209')) {
    tools.push({
      type: 'web_search_20260209',
      name: 'web_search',
      allowed_callers: ['direct']  // Required for Sonnet 4
    });
  }

  // Add web fetch if enabled
  if (permissions.webFetchEnabled && permissions.allowedTools.includes('web_fetch_20260309')) {
    tools.push({
      type: 'web_fetch_20260309',
      name: 'web_fetch',
      allowed_callers: ['direct']  // Required for Sonnet 4
    });
  }

  // Add text editor if enabled
  if (permissions.fileEditingEnabled && permissions.allowedTools.includes('text_editor_20250728')) {
    tools.push({
      type: 'text_editor_20250728',
      name: 'str_replace_editor'
    });
  }

  // Add bash if enabled (with restrictions)
  if (permissions.bashEnabled && permissions.allowedTools.includes('bash_20250124')) {
    tools.push({
      type: 'bash_20250124',
      name: 'bash'
    });
  }

  return tools;
}
