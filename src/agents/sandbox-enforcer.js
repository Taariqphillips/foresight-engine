/**
 * Agent Sandbox Enforcer
 *
 * Validates and enforces security boundaries for agent actions.
 * Intercepts tool calls and ensures they comply with sandbox rules.
 */

import { getSandboxConfig, isSandboxEnabled, BASH_BLACKLIST, BASH_WHITELIST } from './sandbox-config.js';
import { updateInsightAction } from '../config/database.js';

/**
 * Validate agent prompt before execution
 */
export function validateAgentPrompt(prompt, agentType, insightId) {
  if (!isSandboxEnabled()) {
    return { valid: true };
  }

  const config = getSandboxConfig(agentType);

  // Add sandbox constraints to prompt
  const sandboxedPrompt = injectSandboxConstraints(prompt, config);

  console.log(`[sandbox-enforcer] Sandbox mode: ${config.sandboxMode}`);
  console.log(`[sandbox-enforcer] Agent type: ${agentType}`);
  console.log(`[sandbox-enforcer] Allowed tools: ${config.permissions.allowedTools.join(', ')}`);

  return {
    valid: true,
    sandboxedPrompt,
    config
  };
}

/**
 * Inject sandbox constraints into agent prompt
 */
function injectSandboxConstraints(prompt, config) {
  const constraints = buildConstraintsSection(config);

  return `${prompt}

═══════════════════════════════════════════════════════
SECURITY SANDBOX CONSTRAINTS
═══════════════════════════════════════════════════════

${constraints}

CRITICAL: You MUST operate within these constraints. Attempting to bypass
sandbox restrictions will result in immediate termination of your session
and notification to the user.

═══════════════════════════════════════════════════════
`;
}

/**
 * Build constraints section based on config
 */
function buildConstraintsSection(config) {
  const sections = [];

  // Tool restrictions
  if (config.permissions.allowedTools.length > 0) {
    sections.push(`ALLOWED TOOLS:
${config.permissions.allowedTools.map(tool => `- ${tool}`).join('\n')}

RESTRICTED TOOLS: All tools not listed above are DISABLED.`);
  } else {
    sections.push(`TOOL ACCESS: You have NO tool access. This is a planning/analysis-only agent.
You should prepare detailed recommendations but NOT execute any actions.`);
  }

  // Browser restrictions
  if (config.permissions.browserEnabled) {
    sections.push(`BROWSER ACCESS:
- Maximum tabs: ${config.permissions.maxBrowserTabs}
- Maximum navigations: ${config.permissions.maxNavigations}
- Only navigate to trusted, public websites
- Do NOT access internal/localhost URLs
- Do NOT submit forms without explicit user approval
- Do NOT download files without explicit user approval`);
  }

  // Bash restrictions
  if (config.permissions.bashEnabled) {
    sections.push(`BASH COMMAND RESTRICTIONS:
ALLOWED commands only: ${BASH_WHITELIST.join(', ')}
FORBIDDEN commands (NEVER use): ${BASH_BLACKLIST.join(', ')}

- Only use whitelisted commands
- No destructive operations (rm, dd, etc.)
- No system modifications (sudo, chmod, etc.)
- No network attacks or scanning
- Read-only operations preferred`);
  } else {
    sections.push(`BASH ACCESS: DISABLED
You do NOT have bash/shell access. Do not attempt to execute any commands.`);
  }

  // File system restrictions
  if (config.permissions.fileEditingEnabled) {
    sections.push(`FILE SYSTEM ACCESS:
ALLOWED READ PATHS:
${config.filesystemRules.allowedReadPaths.map(path => `- ${path}`).join('\n')}

ALLOWED WRITE PATHS:
${config.filesystemRules.allowedWritePaths.map(path => `- ${path}`).join('\n')}

FORBIDDEN PATHS (never access):
${config.filesystemRules.forbiddenPaths.slice(0, 10).map(path => `- ${path}`).join('\n')}

- Maximum file size: ${(config.globalLimits.maxFileSize / 1024 / 1024).toFixed(0)}MB
- Only create files in designated sandbox directories
- Do NOT access system files, credentials, or sensitive data`);
  } else {
    sections.push(`FILE EDITING: DISABLED
You cannot create, modify, or delete files. Read-only access only.`);
  }

  // Approval requirements
  if (config.permissions.requireApprovalFor.length > 0) {
    if (config.permissions.requireApprovalFor.includes('*')) {
      sections.push(`APPROVAL REQUIRED: ALL ACTIONS
Every action you take requires manual user approval. Prepare action plans
but do NOT execute without explicit confirmation.`);
    } else {
      sections.push(`APPROVAL REQUIRED FOR:
${config.permissions.requireApprovalFor.map(action => `- ${action}`).join('\n')}

For these actions, prepare the details but request user approval before executing.`);
    }
  }

  // Dry-run mode
  if (config.permissions.alwaysDryRun || config.dryRun.enabled) {
    sections.push(`DRY-RUN MODE: ENABLED
You are operating in simulation mode. Log what actions you WOULD take,
but do NOT actually execute them. Provide a detailed execution plan instead.`);
  }

  // Network restrictions
  sections.push(`NETWORK ACCESS:
ALLOWED domains: ${config.globalLimits.allowedNetworkDomains.slice(0, 8).join(', ')}, and similar public resources
BLOCKED: localhost, internal networks, admin panels, private IPs

- Only access public, reputable websites
- Do NOT attempt to access internal services
- Do NOT perform network scanning or attacks`);

  // Time limits
  sections.push(`EXECUTION LIMITS:
- Maximum execution time: ${config.globalLimits.maxExecutionTime / 1000} seconds
- Maximum tokens: ${config.globalLimits.maxTokens}
- Be efficient and focused in your execution`);

  return sections.join('\n\n');
}

/**
 * Validate a bash command before execution
 */
export function validateBashCommand(command, agentType) {
  const config = getSandboxConfig(agentType);

  if (!config.permissions.bashEnabled) {
    return {
      allowed: false,
      reason: 'Bash access is disabled for this agent type',
      sanitizedCommand: null
    };
  }

  // Check against blacklist
  for (const blocked of BASH_BLACKLIST) {
    if (command.toLowerCase().includes(blocked.toLowerCase())) {
      return {
        allowed: false,
        reason: `Command contains blacklisted operation: ${blocked}`,
        sanitizedCommand: null
      };
    }
  }

  // Check against whitelist
  const commandBase = command.trim().split(' ')[0];
  const isWhitelisted = BASH_WHITELIST.some(allowed =>
    commandBase === allowed || command.startsWith(allowed + ' ')
  );

  if (!isWhitelisted) {
    return {
      allowed: false,
      reason: `Command '${commandBase}' is not in whitelist`,
      sanitizedCommand: null
    };
  }

  return {
    allowed: true,
    reason: 'Command approved',
    sanitizedCommand: command
  };
}

/**
 * Validate file access
 */
export function validateFileAccess(filePath, operation, agentType) {
  const config = getSandboxConfig(agentType);

  // Check if file editing is enabled
  if (operation === 'write' && !config.permissions.fileEditingEnabled) {
    return {
      allowed: false,
      reason: 'File editing is disabled for this agent type'
    };
  }

  // Check against forbidden paths
  for (const forbidden of config.filesystemRules.forbiddenPaths) {
    if (filePath.startsWith(forbidden) || filePath.includes(forbidden)) {
      return {
        allowed: false,
        reason: `Access to ${forbidden} is forbidden`
      };
    }
  }

  // Check if path is in allowed list
  const allowedPaths = operation === 'write'
    ? config.filesystemRules.allowedWritePaths
    : config.filesystemRules.allowedReadPaths;

  const isAllowed = allowedPaths.some(allowed =>
    filePath.startsWith(allowed)
  );

  if (!isAllowed) {
    return {
      allowed: false,
      reason: `Path ${filePath} is not in allowed ${operation} paths`
    };
  }

  return {
    allowed: true,
    reason: 'File access approved'
  };
}

/**
 * Log security event
 */
export function logSecurityEvent(event, agentType, insightId, details) {
  const timestamp = new Date().toISOString();

  console.log(`[SECURITY][${timestamp}] ${event}`, {
    agentType,
    insightId,
    ...details
  });

  // Update insight with security event
  if (insightId) {
    const message = `[SECURITY] ${event}: ${JSON.stringify(details)}`;
    updateInsightAction(insightId, 'in_progress', message);
  }
}

/**
 * Create sandbox workspace directory
 */
export async function createSandboxWorkspace(insightId) {
  const { mkdir } = await import('fs/promises');
  const { join } = await import('path');

  const workspacePath = join(process.cwd(), 'data', 'agent-workspace', insightId);

  try {
    await mkdir(workspacePath, { recursive: true });
    console.log(`[sandbox-enforcer] Created workspace: ${workspacePath}`);
    return { success: true, workspacePath };
  } catch (error) {
    console.error('[sandbox-enforcer] Failed to create workspace:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Cleanup sandbox workspace
 */
export async function cleanupSandboxWorkspace(insightId, keepFiles = false) {
  if (keepFiles) {
    console.log(`[sandbox-enforcer] Keeping workspace files for insight ${insightId}`);
    return { success: true };
  }

  const { rm } = await import('fs/promises');
  const { join } = await import('path');

  const workspacePath = join(process.cwd(), 'data', 'agent-workspace', insightId);

  try {
    await rm(workspacePath, { recursive: true, force: true });
    console.log(`[sandbox-enforcer] Cleaned up workspace: ${workspacePath}`);
    return { success: true };
  } catch (error) {
    console.error('[sandbox-enforcer] Failed to cleanup workspace:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get sandbox status summary
 */
export function getSandboxStatus(agentType) {
  const config = getSandboxConfig(agentType);

  return {
    enabled: isSandboxEnabled(),
    mode: config.sandboxMode,
    agentType,
    permissions: {
      browser: config.permissions.browserEnabled,
      bash: config.permissions.bashEnabled,
      fileEditing: config.permissions.fileEditingEnabled
    },
    toolsAvailable: config.permissions.allowedTools,
    approvalRequired: config.permissions.requireApprovalFor,
    dryRun: config.permissions.alwaysDryRun || config.dryRun.enabled
  };
}
