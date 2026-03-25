# Security & Sandbox Architecture

## Overview

The Foresight Engine implements a comprehensive security sandbox to control autonomous agent access and execution. This prevents agents from having unrestricted system access while still enabling powerful automation.

## Sandbox Modes

Configure via `AGENT_SANDBOX_MODE` environment variable:

### `strict` (Recommended for Production)
- **Research agents**: Browser only, no bash/file editing
- **Data gathering agents**: Browser + text editor (sandbox directory only)
- **Monitoring agents**: Browser only
- **Trading agents**: NO TOOLS (planning/analysis only, all actions require approval)
- **General agents**: Browser only

### `moderate`
- Relaxed file system restrictions
- Some bash commands allowed (read-only)
- Still enforces approval for dangerous actions

### `permissive`
- Most tools available
- Minimal restrictions (for testing only)
- **WARNING**: Should only be used in isolated development environments

### `disabled`
- No sandbox enforced
- Full tool access
- **DANGEROUS**: Never use in production

## Agent Type Permissions

### Research Agent
**Allowed**: Browser navigation
**Blocked**: Bash, file editing, downloads without approval
**Use Case**: Web research, competitive analysis, market research

```javascript
{
  browserEnabled: true,
  bashEnabled: false,
  fileEditingEnabled: false,
  maxBrowserTabs: 5,
  maxNavigations: 50
}
```

### Data Gathering Agent
**Allowed**: Browser + text editor (sandbox directories only)
**Blocked**: Bash, system file access
**Use Case**: Scraping data, creating reports, organizing information

```javascript
{
  browserEnabled: true,
  bashEnabled: false,
  fileEditingEnabled: true,  // Sandbox only
  maxBrowserTabs: 10,
  maxNavigations: 100
}
```

### Monitoring Agent
**Allowed**: Browser navigation
**Blocked**: Bash, file editing
**Use Case**: Tracking prices, monitoring news, observing metrics

```javascript
{
  browserEnabled: true,
  bashEnabled: false,
  fileEditingEnabled: false,
  maxBrowserTabs: 3,
  maxNavigations: 20
}
```

### Trading Agent
**Allowed**: NONE by default
**Blocked**: ALL TOOLS (must be explicitly enabled)
**Always Dry-Run**: Yes
**Approval Required**: All actions

Trading agents are heavily restricted because they can affect financial assets. They operate in planning mode only, preparing detailed execution plans that require manual approval before execution.

```javascript
{
  browserEnabled: false,  // Can enable manually
  bashEnabled: false,
  fileEditingEnabled: false,
  requireApprovalFor: ['*'],  // Everything
  alwaysDryRun: true
}
```

## Bash Command Restrictions

### Whitelist (Allowed Commands)
Read-only operations only:
- `ls`, `cat`, `head`, `tail`, `grep`, `find`, `pwd`
- `curl`, `wget` (for web fetching)
- `jq`, `sed`, `awk`, `sort`, `uniq` (data processing)
- `git log`, `git status`, `git show` (read-only git)

### Blacklist (Forbidden Commands)
Destructive or dangerous operations:
- `rm`, `rmdir`, `dd` (file deletion)
- `chmod`, `chown`, `sudo` (permission changes)
- `kill`, `shutdown`, `reboot` (process/system control)
- `apt`, `yum`, `brew install` (package management)
- `eval`, `exec`, `source` (dangerous scripting)
- `scp`, `rsync`, `ftp` (file transfer)

## File System Access Control

### Allowed Read Paths
- `/tmp/agent-sandbox`
- `/Users/pfmanagementgroup/projects/foresight-engine/data/agent-workspace`

### Allowed Write Paths
- `/tmp/agent-sandbox`
- `/Users/pfmanagementgroup/projects/foresight-engine/data/agent-workspace`

### Forbidden Paths (Never Accessible)
- `/etc`, `/var`, `/usr`, `/bin`, `/sbin` (system directories)
- `/System`, `/Library` (macOS system)
- `~/.ssh`, `~/.aws`, `~/.config` (credentials and config)
- `.env` files (environment secrets)

### File Size Limits
- Maximum file read/write: 10MB
- Large file writes require approval

## Network Access Control

### Allowed Domains
Public, reputable websites for research:
- google.com, bing.com, wikipedia.org
- sec.gov, finviz.com, yahoo.com
- marketwatch.com, bloomberg.com, reuters.com
- github.com, stackoverflow.com

### Blocked Domains
- localhost, 127.0.0.1, 0.0.0.0
- 192.168.*, 10.* (private networks)
- internal, admin (internal services)

## Approval Workflows

### Actions Requiring Manual Approval
- Execute trades or financial transactions
- Submit payments
- Delete data
- Send emails (except agent reports)
- Post to social media
- Create accounts or change passwords
- Access financial accounts
- Sign documents
- Make purchases

### Approval Process
1. Agent prepares action details
2. User receives approval request via email
3. User reviews and approves/denies
4. Agent executes if approved

## Dry-Run Mode

Enable via `AGENT_DRY_RUN=true` for global simulation mode.

### What Happens in Dry-Run
- Agents log what actions they WOULD take
- No actual execution occurs
- Provides detailed execution plans
- Safe for testing agent behavior

### Use Cases
- Testing new agent types
- Validating prompts
- Reviewing agent logic before production
- Training and demonstrations

## Security Event Logging

All agent actions are logged with:
- Timestamp
- Agent type
- Insight ID
- Event type (spawned, completed, failed, security violation)
- Details (tokens used, tools accessed, errors encountered)

### Log Events
- `AGENT_SPAWNED`: Agent creation with permissions
- `AGENT_COMPLETED`: Successful execution
- `AGENT_FAILED`: Errors or failures
- `SECURITY_VIOLATION`: Attempted sandbox breach

## Sandbox Workspace

Each agent gets an isolated workspace directory:
```
/data/agent-workspace/{insightId}/
```

### Workspace Lifecycle
1. **Created** at agent spawn
2. **Used** by agent for file operations
3. **Kept** after completion (for review)
4. **Cleaned** on error (or manually)

### Benefits
- Isolated file operations
- Easy cleanup
- Audit trail of agent artifacts
- No system file pollution

## Best Practices

### For Production
1. **Always use `strict` sandbox mode**
2. **Never use `permissive` or `disabled` modes**
3. **Enable logging and monitoring**
4. **Review agent artifacts regularly**
5. **Limit trading agents to planning mode**
6. **Require approval for financial actions**

### For Development
1. **Use `moderate` mode for testing**
2. **Enable dry-run mode initially**
3. **Test with research agents first**
4. **Gradually enable permissions**
5. **Review logs after each test**

### For Trading Agents
1. **Start with paper trading only**
2. **Test extensively before live trading**
3. **Set strict position size limits**
4. **Require multi-step approval**
5. **Implement daily trade limits**

## Security Threat Model

### Threats Mitigated
✅ Unauthorized file system access
✅ Execution of destructive commands
✅ Access to credentials and secrets
✅ Network attacks or scanning
✅ Privilege escalation
✅ Resource exhaustion
✅ Data exfiltration

### Threats NOT Fully Mitigated
⚠️ Social engineering via browser (agent could be tricked)
⚠️ API key leakage if agent has access to config
⚠️ Excessive API costs (token limits help)

### Additional Safeguards Needed For:
- Multi-user environments (add user-level isolation)
- Highly sensitive data (add encryption)
- Regulatory compliance (add audit logging)

## Environment Variables

```bash
# Sandbox mode (strict, moderate, permissive, disabled)
AGENT_SANDBOX_MODE=strict

# Global dry-run mode (true/false)
AGENT_DRY_RUN=false
```

## Architecture Files

- `src/agents/sandbox-config.js` - Permission definitions
- `src/agents/sandbox-enforcer.js` - Runtime enforcement
- `src/agents/agent-orchestrator.js` - Integration point

## Future Enhancements

- [ ] Docker container isolation
- [ ] Network traffic monitoring
- [ ] Real-time security dashboards
- [ ] Automated security audits
- [ ] Multi-tenancy support
- [ ] Role-based access control (RBAC)
- [ ] Integration with credential vaults (1Password CLI)

## Incident Response

If a security violation occurs:

1. **Agent is immediately terminated**
2. **Security event is logged**
3. **User is notified via email**
4. **Workspace is preserved for review**
5. **Incident is added to insight notes**

## Contact

For security concerns or questions:
- Email: support@axioncollective.com
- GitHub Issues: https://github.com/Taariqphillips/foresight-engine/issues

**Please report security vulnerabilities privately before public disclosure.**
