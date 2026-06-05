from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field

class PhaseOutput(BaseModel):
    summary: str
    deliverables: Dict[str, Any]
    risks: List[str]
    next_required_inputs: List[str]

class ProjectCreate(BaseModel):
    name: str = Field(min_length=3)
    client_goal: str = Field(min_length=10)
    budget: Optional[str] = None

class ProjectState(BaseModel):
    id: str
    name: str
    client_goal: str
    budget: Optional[str] = None
    status: Literal["created", "running", "waiting_approval", "waiting_intervention", "completed", "failed"] = "created"
    current_phase: str = "ceo"
    phases: Dict[str, Dict[str, Any]]
    artifacts: List[Dict[str, Any]] = Field(default_factory=list)
    logs: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: str
    updated_at: str

class ApprovalRequest(BaseModel):
    approved: bool
    founder_note: Optional[str] = None

class ToolApprovalDecision(BaseModel):
    approved: bool
    note: Optional[str] = None
    decided_by: str = "founder"

class ChatMessage(BaseModel):
    message: str

class VoiceSynthesisRequest(BaseModel):
    agent_id: str
    text: str = Field(..., min_length=1, max_length=240)
    sexo: str = "no_especificado"
    language: str = "es"

class CompanySettings(BaseModel):
    company_name: str
    company_subtitle: str = ""
    company_description: str = ""
    contact_email: str = ""
    contact_phone: str = ""
    contact_social: str = ""
    logo_brand: str = ""
    founder: str = ""
    collaborators: List[str] = Field(default_factory=list)
    theme: str = "dark"
    language: str = "en"
    tool_policy_mode: Literal["approval_required", "full_access"] = "approval_required"
    voice_conversations_enabled: bool = False
    system_prompt_mcp_instructions: Optional[str] = None

class McpServerUpdate(BaseModel):
    enabled: Optional[bool] = None
    kind: Optional[str] = None
    category: Optional[str] = None
    display_name: Optional[str] = None
    description: Optional[str] = None
    icon_url: Optional[str] = None
    url: Optional[str] = None
    docs_url: Optional[str] = None
    command: Optional[str] = None
    args: Optional[List[str]] = None
    env: Optional[Dict[str, str]] = None
    env_keys: Optional[List[str]] = None
    required_for: Optional[List[str]] = None
    install_hint: Optional[str] = None
    library_ids: Optional[List[str]] = None

class AgentUpdate(BaseModel):
    display_name: Optional[str] = None
    name: Optional[str] = None
    sexo: Optional[str] = None
    avatar_url: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    fallback_model: Optional[str] = None
    image_provider: Optional[str] = None
    image_model: Optional[str] = None
    responsibilities: Optional[List[str]] = None
    skills: Optional[List[str]] = None
    tools: Optional[List[str]] = None
    deliverables: Optional[List[str]] = None
    department_id: Optional[str] = None
    reports_to: Optional[str] = None

class AgentCreate(BaseModel):
    agent_id: str = Field(..., min_length=3)
    display_name: str
    name: str
    sexo: str = "no_especificado"
    avatar_url: Optional[str] = None
    provider: str
    model: str
    fallback_model: Optional[str] = None
    responsibilities: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list)
    tools: List[str] = Field(default_factory=list)
    deliverables: List[str] = Field(default_factory=list)
    department_id: Optional[str] = None
    reports_to: Optional[str] = None

class DepartmentCreate(BaseModel):
    id: str = Field(..., min_length=2)
    title: str
    description: str = ""
    parent_id: Optional[str] = None
    tone: str = "bg-surface-strong text-surface"
    icon_name: str = "Building2"

class DepartmentUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[str] = None
    tone: Optional[str] = None
    icon_name: Optional[str] = None

class SkillCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: str = ""

class SkillUpdate(BaseModel):
    old_name: str
    name: str = Field(..., min_length=2)
    description: str = ""

class DeliverableCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: str = ""
    code: str = Field(..., min_length=2)

class DeliverableUpdate(BaseModel):
    old_code: str
    name: str = Field(..., min_length=2)
    description: str = ""
    code: str = Field(..., min_length=2)

class SecretUpdate(BaseModel):
    value: str = Field(min_length=1)

class WorkspaceFileContent(BaseModel):
    content: str
