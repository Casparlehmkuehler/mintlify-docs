# HashiCorp Vault Integration for Environment Variables Management

## Overview

This document outlines the implementation plan for integrating HashiCorp Vault with the dashboard to allow users to securely declare and manage environment variables for their execution jobs.

## Architecture Design

### Components

1. **Vault Server**: HashiCorp Vault instance (self-hosted or Vault Cloud)
2. **Backend API**: New endpoints for env var CRUD operations
3. **Dashboard UI**: New pages/components for env var management
4. **Execution Engine**: Modified to inject env vars from Vault

### Data Flow

```
User Dashboard → Backend API → Vault Server → Execution Environment
```

## Implementation Plan

### Phase 1: Infrastructure Setup

#### 1.1 Vault Server Setup

**Option A: Self-Hosted Vault**
```bash
# Install Vault
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
sudo apt-get update && sudo apt-get install vault

# Configure Vault
vault server -config=/etc/vault/config.hcl
vault operator init
vault operator unseal
```

**Option B: HashiCorp Vault Cloud (HCP)**
- Sign up for HCP Vault
- Create cluster
- Configure access policies

#### 1.2 Vault Configuration

**Authentication Methods:**
- **AppRole**: For backend service authentication
- **OIDC/JWT**: For user authentication (if direct user access needed)

**Policies:**
```hcl
# User policy for managing their own env vars
path "secret/data/users/{{identity.entity.id}}/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}

# Service policy for backend to read all user env vars
path "secret/data/users/+/*" {
  capabilities = ["read", "list"]
}
```

**Secrets Engine:**
```bash
vault secrets enable -path=secret kv-v2
```

### Phase 2: Backend Implementation

#### 2.1 New API Endpoints

```typescript
// Environment Variables API
GET    /api/v2/user/env-vars           // List user's env vars
POST   /api/v2/user/env-vars           // Create new env var
GET    /api/v2/user/env-vars/{id}      // Get specific env var
PUT    /api/v2/user/env-vars/{id}      // Update env var
DELETE /api/v2/user/env-vars/{id}      // Delete env var

// Execution Integration
POST   /api/v2/execution              // Modified to accept env_var_ids
```

#### 2.2 Backend Services

```typescript
// vault-service.ts
class VaultService {
  async storeSecret(userId: string, key: string, value: string): Promise<void>
  async getSecret(userId: string, key: string): Promise<string>
  async listSecrets(userId: string): Promise<string[]>
  async deleteSecret(userId: string, key: string): Promise<void>
  async getSecretsForExecution(userId: string, envVarIds: string[]): Promise<Record<string, string>>
}

// env-vars-controller.ts
class EnvVarsController {
  async createEnvVar(req: CreateEnvVarRequest): Promise<EnvVar>
  async listEnvVars(userId: string): Promise<EnvVar[]>
  async updateEnvVar(id: string, updates: Partial<EnvVar>): Promise<EnvVar>
  async deleteEnvVar(id: string): Promise<void>
}
```

#### 2.3 Database Schema

```sql
-- Environment variables metadata
CREATE TABLE env_vars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vault_path VARCHAR(512) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Execution environment variables (junction table)
CREATE TABLE execution_env_vars (
  execution_id UUID REFERENCES executions(id),
  env_var_id UUID REFERENCES env_vars(id),
  PRIMARY KEY (execution_id, env_var_id)
);
```

### Phase 3: Frontend Implementation

#### 3.1 New Pages/Components

```typescript
// Pages
- /dashboard/env-vars          // Environment variables management
- /dashboard/env-vars/new      // Create new env var
- /dashboard/env-vars/{id}     // Edit env var

// Components
- EnvVarsPage.tsx             // Main env vars management
- EnvVarForm.tsx              // Create/edit form
- EnvVarsList.tsx             // List with CRUD actions
- EnvVarSelector.tsx          // Multi-select for execution
- SecretInput.tsx             // Masked input for sensitive values
```

#### 3.2 UI Features

**Environment Variables List Page:**
- Searchable/filterable table
- Name, description, created date
- Edit/delete actions
- Create new button

**Create/Edit Form:**
- Name (required, unique per user)
- Description (optional)
- Value (masked input)
- Save/cancel actions

**Execution Integration:**
- Env vars selector in job creation form
- Shows available env vars as checkboxes
- Preview selected env vars (names only)

#### 3.3 Security Considerations for Frontend

- Never display actual secret values in UI
- Show only masked values (••••••••)
- Confirm before deletion
- Clear sensitive form data on unmount

### Phase 4: Execution Engine Integration

#### 4.1 Execution Flow Modification

```typescript
// Modified execution creation
async function createExecution(request: ExecutionRequest) {
  // 1. Validate env_var_ids belong to user
  // 2. Fetch secrets from Vault
  // 3. Pass as environment variables to execution engine
  
  const envVars = await vaultService.getSecretsForExecution(
    request.userId, 
    request.env_var_ids
  );
  
  // Pass to execution engine
  await executionEngine.run({
    ...request,
    environment: envVars
  });
}
```

#### 4.2 Container/Process Environment

Inject environment variables at runtime:
- Docker: `--env-file` or `-e` flags
- Python: `os.environ` updates
- Kubernetes: Pod environment variables

## Security Best Practices

### 4.1 Vault Security

- **Transit encryption**: All data encrypted in transit (TLS)
- **Storage encryption**: All data encrypted at rest
- **Access control**: Fine-grained policies per user
- **Audit logging**: All access logged for compliance
- **Token rotation**: Regular token refresh
- **Least privilege**: Minimal required permissions

### 4.2 Application Security

- **No caching**: Never cache secrets in memory/disk
- **Secure transmission**: HTTPS only for all API calls
- **Input validation**: Sanitize all env var names/values
- **Rate limiting**: Prevent brute force attacks
- **Audit trails**: Log all env var operations

### 4.3 Development Security

- **No secrets in code**: Use environment variables for Vault config
- **Separate environments**: Different Vault instances for dev/staging/prod
- **Secure defaults**: Fail securely if Vault unavailable

## Deployment Strategy

### 5.1 Infrastructure Requirements

**Production:**
- Vault cluster (3+ nodes for HA)
- Load balancer for Vault
- Database backups for metadata
- Monitoring and alerting

**Development:**
- Single Vault instance
- Local development mode

### 5.2 Configuration Management

```yaml
# docker-compose.yml (development)
version: '3.8'
services:
  vault:
    image: vault:latest
    ports:
      - "8200:8200"
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: myroot
      VAULT_DEV_LISTEN_ADDRESS: 0.0.0.0:8200
    cap_add:
      - IPC_LOCK

# Kubernetes (production)
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vault
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: vault
        image: vault:latest
        env:
        - name: VAULT_ADDR
          value: "https://vault.example.com:8200"
```

### 5.3 Migration Strategy

1. **Phase 1**: Deploy Vault infrastructure
2. **Phase 2**: Deploy backend API (feature flagged)
3. **Phase 3**: Deploy frontend components
4. **Phase 4**: Enable feature for beta users
5. **Phase 5**: Full rollout

## Monitoring and Maintenance

### 6.1 Key Metrics

- Vault server health/uptime
- API response times for env var operations
- Number of secrets stored per user
- Failed authentication attempts
- Execution failures due to missing env vars

### 6.2 Alerting

- Vault server down/unreachable
- High error rates on env var APIs
- Unusual access patterns
- Certificate expiration warnings

### 6.3 Backup Strategy

- **Vault data**: Regular snapshots
- **Metadata**: Database backups
- **Configuration**: Infrastructure as code
- **Recovery testing**: Regular DR drills

## Cost Considerations

### 7.1 Vault Cloud Pricing

- HCP Vault: ~$2/hour for development cluster
- Production: ~$6-15/hour depending on size
- Alternative: Self-hosted saves costs but increases ops overhead

### 7.2 Infrastructure Costs

- Additional database storage for metadata
- Network egress for Vault API calls
- Monitoring/logging infrastructure

### 7.3 Development Time Estimate

- **Backend**: 2-3 weeks
- **Frontend**: 2-3 weeks  
- **Integration testing**: 1 week
- **Security review**: 1 week
- **Documentation**: 1 week

**Total: 7-11 weeks**

## Alternative Solutions Considered

### 8.1 AWS Secrets Manager
- **Pros**: Managed service, tight AWS integration
- **Cons**: Vendor lock-in, less flexible policies

### 8.2 Azure Key Vault
- **Pros**: Good for Azure-heavy environments
- **Cons**: Limited cross-cloud support

### 8.3 Database Encryption
- **Pros**: Simple implementation
- **Cons**: Less secure, no fine-grained access control

### 8.4 Environment Variables in Database (Encrypted)
- **Pros**: Minimal infrastructure changes
- **Cons**: Application-level encryption risks, key management complexity

## Conclusion

HashiCorp Vault provides the most comprehensive solution for secure environment variable management with:
- Industry-standard security practices
- Fine-grained access controls
- Audit logging and compliance features
- Scalable architecture
- Strong ecosystem support

The implementation requires significant development effort but provides enterprise-grade security for sensitive environment variables.

## Next Steps

1. **Proof of Concept**: Set up local Vault instance and basic integration
2. **Security Review**: Review architecture with security team
3. **Infrastructure Planning**: Plan production Vault deployment
4. **Development Kickoff**: Begin backend API implementation
5. **User Research**: Validate UI/UX design with target users