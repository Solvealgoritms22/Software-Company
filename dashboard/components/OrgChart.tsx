"use client";

import { useMemo } from "react";
import { Building2, Cpu, GitBranch, ShieldCheck, Palette, Code2, Database, TestTube2, FileText, Landmark } from "lucide-react";
import type { AgentRegistry, DepartmentRegistry, Department } from "../hooks/useOrchestrator";

type Props = {
  registry: AgentRegistry | null;
  departmentRegistry?: DepartmentRegistry | null;
};

export function OrgChart({ registry, departmentRegistry }: Props) {
  const agents = registry?.agents || {};
  const departments = departmentRegistry?.departments || {};

  // Build hierarchy
  const { rootAgents, childrenMap } = useMemo(() => {
    const roots: string[] = [];
    const children: Record<string, string[]> = {};

    Object.keys(agents).forEach(id => {
      const agent = agents[id];
      const managerId = agent.reports_to;
      
      if (!managerId || !agents[managerId]) {
        roots.push(id);
      } else {
        if (!children[managerId]) children[managerId] = [];
        children[managerId].push(id);
      }
    });

    return { rootAgents: roots, childrenMap: children };
  }, [agents]);

  return (
    <section className="h-full overflow-auto p-6 bg-surface/30">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-text-strong">Organigrama DevFoundry</h2>
            <p className="mt-1 text-sm text-text-muted">
              Estructura organizativa y cadena de reporte de los agentes IA.
            </p>
          </div>
          <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-muted shadow-sm">
            {Object.keys(agents).length} agentes en {Object.keys(departments).length} departamentos
          </div>
        </div>

        <div className="bg-surface border border-line rounded-xl p-8 shadow-sm">
          {rootAgents.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>No hay agentes configurados para mostrar en el organigrama.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {rootAgents.map(rootId => (
                <AgentNode 
                  key={rootId} 
                  agentId={rootId} 
                  agents={agents} 
                  departments={departments} 
                  childrenMap={childrenMap} 
                  level={0} 
                  isLast={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function AgentNode({ 
  agentId, 
  agents, 
  departments, 
  childrenMap, 
  level,
  isLast
}: { 
  agentId: string; 
  agents: Record<string, any>; 
  departments: Record<string, Department>;
  childrenMap: Record<string, string[]>;
  level: number;
  isLast: boolean;
}) {
  const agent = agents[agentId];
  if (!agent) return null;

  const subs = childrenMap[agentId] || [];
  const agentName = agent.name || agentId.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
  const roleName = agent.display_name || "Agente";
  const avatarUrl = agent.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agentName}`;
  const dep = agent.department_id ? departments[agent.department_id] : null;

  return (
    <div className="relative">
      {/* Línea conectora vertical desde el padre (si no es root) */}
      {level > 0 && (
        <div className={`absolute -left-6 top-0 w-px border-l-2 border-line ${isLast ? 'h-8' : 'h-full'}`}></div>
      )}
      
      {/* Línea conectora horizontal hacia el nodo */}
      {level > 0 && (
        <div className="absolute -left-6 top-8 w-6 border-b-2 border-line"></div>
      )}

      <div className={`relative flex items-start gap-4 ${level > 0 ? 'ml-0' : ''} mb-4`}>
        <div className="flex-1 max-w-[360px]">
          <article className="quiet-card relative overflow-hidden p-4 group transition-all duration-300 hover:border-brand hover:shadow-md">
            {/* Tira de color del departamento */}
            {dep && (
              <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-brand opacity-80"></div>
            )}
            
            <div className="flex items-center gap-3">
              <img 
                src={avatarUrl} 
                className="w-12 h-12 rounded-full border border-line bg-surface object-cover shadow-sm group-hover:scale-105 transition-transform" 
                alt={agentName}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold text-text-strong truncate">{agentName}</div>
                <div className="text-xs text-text-muted font-medium truncate mt-0.5">{roleName}</div>
                {dep ? (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-muted border border-line text-[10px] font-semibold text-text-strong">
                    <Building2 className="w-3 h-3 text-brand" />
                    {dep.title}
                  </div>
                ) : (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-muted border border-line text-[10px] font-semibold text-text-muted">
                    <Cpu className="w-3 h-3" />
                    Sin departamento
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-3 flex flex-wrap gap-1">
              {agent.provider && (
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[9px] font-medium text-text-muted uppercase tracking-wider">
                  {agent.provider}
                </span>
              )}
              {agent.model && (
                <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[9px] font-medium text-text-muted uppercase tracking-wider">
                  {agent.model}
                </span>
              )}
            </div>
          </article>
        </div>
      </div>

      {/* Subordinados */}
      {subs.length > 0 && (
        <div className="ml-12 relative">
          {subs.map((subId, index) => (
            <AgentNode 
              key={subId} 
              agentId={subId} 
              agents={agents} 
              departments={departments} 
              childrenMap={childrenMap} 
              level={level + 1}
              isLast={index === subs.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
