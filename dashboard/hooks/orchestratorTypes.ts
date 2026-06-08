export type PhaseStatus = "pending" | "running" | "completed" | "failed";

export type ProjectState = {
  id: string;
  name: string;
  client_goal: string;
  budget?: string | null;
  status: "created" | "running" | "waiting_approval" | "waiting_intervention" | "completed" | "failed";
  current_phase: string;
  phases: Record<
    string,
    {
      id: string;
      agent: string;
      depends_on: string[];
      status: PhaseStatus;
      started_at?: string | null;
      completed_at?: string | null;
      error?: string | null;
    }
  >;
  artifacts: ProjectArtifact[];
  logs: Array<{
    id: string;
    agent: string;
    phase: string;
    message: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
};

export type ProjectArtifact = {
  id: string;
  type: string;
  agent: string;
  title: string;
  content: Record<string, unknown>;
  uri?: string | null;
  created_at: string;
};

export type AgentTrace = {
  id: string;
  phase: string;
  agent: string;
  event_type: string;
  model?: string | null;
  provider?: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  estimated_cost_usd: number;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UsageBucket = {
  events: number;
  prompt_tokens: number;
  completion_tokens: number;
  cached_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
};

export type ProjectUsageSummary = {
  project_id: string;
  totals: UsageBucket;
  budget: {
    max_project_cost_usd: number;
    remaining_usd?: number | null;
    usage_ratio: number;
    is_exceeded: boolean;
  };
  by_phase: Array<UsageBucket & { phase: string }>;
  by_agent: Array<UsageBucket & { agent: string }>;
  by_model: Array<UsageBucket & { provider?: string | null; model?: string | null }>;
  context_economy?: {
    memory_events: number;
    memory_chunks: number;
    semantic_cache_events: number;
    semantic_cache_items: number;
    context_tokens_sent: number;
    candidate_tokens_seen: number;
    tokens_avoided_estimate: number;
    citations_available: number;
    citations_used: number;
    prompt_tokens_observed: number;
    retrieval_eval_count: number;
    retrieval_eval_score: number;
    retrieval_eval_statuses: Record<string, number>;
    failed_retrieval_phases: string[];
    quality_eval_count: number;
    quality_eval_score: number;
    quality_eval_statuses: Record<string, number>;
    quality_failed_phases: string[];
    side_effect_warnings: number;
    contract_eval_count: number;
    contract_valid_count: number;
    contract_autofix_count: number;
    contract_issue_count: number;
    idempotency_records: number;
    idempotency_hits: number;
    idempotency_replays_prevented: number;
    poor_retrieval_phases: string[];
  };
};

export type ToolApproval = {
  id: string;
  project_id?: string | null;
  phase_id?: string | null;
  agent_name?: string | null;
  tool_name: string;
  category: string;
  risk: "low" | "medium" | "high";
  reason: string;
  fingerprint: string;
  status: "pending" | "approved" | "denied";
  created_at: string;
  requested_at?: string | null;
  decided_at?: string | null;
  decided_by?: string | null;
  decision_note?: string | null;
  arguments?: Record<string, unknown>;
};

export type McpCatalog = {
  servers: Record<
    string,
    {
      enabled?: boolean;
      kind?: string;
      category?: string;
      display_name?: string;
      description?: string;
      icon_url?: string;
      url?: string;
      docs_url?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      env_keys?: string[];
      required_for?: string[];
      install_hint?: string;
      library_ids?: string[];
    }
  >;
};

export type McpSecretState = {
  key: string;
  configured: boolean;
  masked: string;
  source: "local_store" | "runtime_env" | "missing";
};

export type McpSecretsResponse = {
  secrets: Record<string, McpSecretState>;
  storage?: {
    path?: string;
    encrypted?: boolean;
    gitignored?: boolean;
    note?: string;
  };
};

export type Skill = {
  name: string;
  description: string;
};

export type Deliverable = {
  code: string;
  name: string;
  description: string;
};

export type AgentRegistry = {
  agents: Record<
    string,
    {
      display_name?: string;
      name?: string;
      sexo?: "femenino" | "masculino" | "no_especificado" | string;
      avatar_url?: string;
      provider?: string;
      model?: string;
      fallback_model?: string;
      reasoning_effort?: string;
      image_provider?: string;
      image_model?: string;
      responsibilities?: string[];
      skills?: string[];
      tools?: string[];
      deliverables?: string[];
      department_id?: string;
      reports_to?: string;
    }
  >;
};

export type Department = {
  id: string;
  title: string;
  description: string;
  parent_id?: string | null;
  tone: string;
  icon_name: string;
};

export type DepartmentRegistry = {
  departments: Record<string, Department>;
};

export type CompanySettings = {
  company_name: string;
  company_subtitle?: string | null;
  company_description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_social?: string | null;
  logo_brand?: string | null;
  founder?: string | null;
  collaborators?: string[];
  theme?: "light" | "dark";
  language?: "en" | "es";
  tool_policy_mode?: "approval_required" | "full_access";
  voice_conversations_enabled?: boolean;
  system_prompt_mcp_instructions?: string | null;
};
