CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    client_goal TEXT NOT NULL,
    budget TEXT,
    status TEXT NOT NULL DEFAULT 'created',
    current_phase TEXT NOT NULL DEFAULT 'ceo',
    state_dump JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE projects ADD COLUMN IF NOT EXISTS state_dump JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    agent TEXT NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    uri TEXT,
    embedding vector(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    source_artifact_id UUID REFERENCES artifacts(id) ON DELETE CASCADE,
    target_artifact_id UUID REFERENCES artifacts(id) ON DELETE CASCADE,
    relation_type TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    context TEXT NOT NULL,
    options_evaluated JSONB NOT NULL DEFAULT '[]'::jsonb,
    decision TEXT NOT NULL,
    justification TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phase_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    agent TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error TEXT,
    output JSONB NOT NULL DEFAULT '{}'::jsonb,
    usage JSONB NOT NULL DEFAULT '{}'::jsonb,
    cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
    UNIQUE(project_id, phase)
);

ALTER TABLE phase_runs ADD COLUMN IF NOT EXISTS usage JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE phase_runs ADD COLUMN IF NOT EXISTS cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    agent TEXT NOT NULL,
    phase TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_traces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    agent TEXT NOT NULL,
    event_type TEXT NOT NULL,
    model TEXT,
    provider TEXT,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    cached_tokens INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifact_memory_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    artifact_id UUID REFERENCES artifacts(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    artifact_type TEXT NOT NULL,
    agent TEXT NOT NULL,
    title TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    search_text TEXT NOT NULL,
    token_estimate INTEGER NOT NULL DEFAULT 0,
    embedding vector(768),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(artifact_id, chunk_index)
);

CREATE TABLE IF NOT EXISTS semantic_phase_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    agent TEXT NOT NULL,
    signature_hash TEXT NOT NULL UNIQUE,
    query_text TEXT NOT NULL,
    output_summary TEXT NOT NULL DEFAULT '',
    output JSONB NOT NULL DEFAULT '{}'::jsonb,
    citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    token_estimate INTEGER NOT NULL DEFAULT 0,
    embedding vector(768),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS retrieval_evals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    agent TEXT NOT NULL,
    available_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    used_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    matched_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_citations JSONB NOT NULL DEFAULT '[]'::jsonb,
    context_tokens_sent INTEGER NOT NULL DEFAULT 0,
    candidate_tokens_seen INTEGER NOT NULL DEFAULT 0,
    score NUMERIC(5, 4) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unknown',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phase_quality_evals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    agent TEXT NOT NULL,
    score NUMERIC(5, 4) NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unknown',
    checks JSONB NOT NULL DEFAULT '{}'::jsonb,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    tool_calls_count INTEGER NOT NULL DEFAULT 0,
    risky_tool_calls_count INTEGER NOT NULL DEFAULT 0,
    duplicate_tool_calls_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS phase_contract_evals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    phase TEXT NOT NULL,
    agent TEXT NOT NULL,
    schema_name TEXT NOT NULL DEFAULT 'phase_output_contract',
    valid BOOLEAN NOT NULL DEFAULT FALSE,
    strict BOOLEAN NOT NULL DEFAULT TRUE,
    autofixed BOOLEAN NOT NULL DEFAULT FALSE,
    expected_deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
    extra_deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
    issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    corrections JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_idempotency_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    phase TEXT,
    agent TEXT,
    tool_name TEXT NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    arguments JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'running',
    result TEXT,
    result_hash TEXT,
    error TEXT,
    attempt_count INTEGER NOT NULL DEFAULT 1,
    hit_count INTEGER NOT NULL DEFAULT 0,
    last_hit_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artifacts_project_type ON artifacts(project_id, type);
CREATE INDEX IF NOT EXISTS idx_phase_runs_project_status ON phase_runs(project_id, status);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_created ON activity_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_traces_project_created ON agent_traces(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_memory_project_created ON artifact_memory_chunks(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_artifact_memory_artifact_hash ON artifact_memory_chunks(artifact_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_artifact_memory_project_type ON artifact_memory_chunks(project_id, artifact_type);
CREATE INDEX IF NOT EXISTS idx_semantic_cache_project_phase ON semantic_phase_cache(project_id, phase, agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_retrieval_evals_project_phase ON retrieval_evals(project_id, phase, agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase_quality_evals_project_phase ON phase_quality_evals(project_id, phase, agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase_contract_evals_project_phase ON phase_contract_evals(project_id, phase, agent, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_idempotency_project_phase ON tool_idempotency_records(project_id, phase, agent, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_idempotency_tool_status ON tool_idempotency_records(tool_name, status, updated_at DESC);
