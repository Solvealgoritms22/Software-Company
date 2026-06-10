"use client";

import { useState } from "react";
import type { Department, DepartmentRegistry } from "../hooks/useOrchestrator";

type Props = {
  departmentRegistry: DepartmentRegistry | null;
  createDepartment: (payload: Department) => Promise<boolean>;
  updateDepartment: (id: string, payload: Partial<Department>) => Promise<boolean>;
  deleteDepartment: (id: string) => Promise<boolean>;
  error: string | null;
  language?: "en" | "es";
};

const translations = {
  en: {
    confirmDelete: "Are you sure you want to delete this department?",
    departmentsTitle: "Departments",
    departmentsDesc: "Configure the company hierarchy.",
    noDepartments: "No departments configured.",
    newDepartment: "New Department",
    createDepartment: "Create Department",
    editDepartment: "Edit Department",
    details: "Details",
    departmentId: "Department ID",
    name: "Name",
    description: "Description",
    parentDepartment: "Parent Department",
    noneTopLevel: "None (Top Level)",
    selectOrCreate: "Select or create a department"
  },
  es: {
    confirmDelete: "¿Estás seguro de eliminar este departamento?",
    departmentsTitle: "Departamentos",
    departmentsDesc: "Configura la jerarquía de la empresa.",
    noDepartments: "No hay departamentos configurados.",
    newDepartment: "Nuevo Departamento",
    createDepartment: "Crear Departamento",
    editDepartment: "Editar Departamento",
    details: "Detalles",
    departmentId: "ID del Departamento",
    name: "Nombre",
    description: "Descripción",
    parentDepartment: "Departamento Padre",
    noneTopLevel: "Ninguno (Nivel Superior)",
    selectOrCreate: "Selecciona o crea un departamento"
  }
};

export function DepartmentSettings({
  departmentRegistry,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  error,
  language = "en"
}: Props) {
  const t = translations[language];
  const departments = departmentRegistry?.departments || {};
  const departmentList = Object.keys(departments).map(id => ({ ...departments[id], id }));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Department>>({});

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsEditing(false);
    setFormData({ ...departments[id], id });
  };

  const handleCreateNew = () => {
    setSelectedId("new");
    setIsEditing(true);
    setFormData({
      id: "",
      title: "",
      description: "",
      parent_id: "",
      tone: "bg-surface-strong text-surface",
      icon_name: "Building2"
    });
  };

  const handleSave = async () => {
    if (!formData.title || (selectedId === "new" && !formData.id)) return;
    
    if (selectedId === "new") {
      const success = await createDepartment(formData as Department);
      if (success) {
        setSelectedId(formData.id!);
        setIsEditing(false);
      }
    } else {
      const success = await updateDepartment(selectedId!, formData);
      if (success) {
        setIsEditing(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t.confirmDelete)) {
      await deleteDepartment(id);
      if (selectedId === id) {
        setSelectedId(null);
      }
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row gap-6 p-6 mx-auto max-w-7xl">
      <div className="w-full md:w-1/3 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-text-strong flex items-center gap-2">
              <span className="material-symbols-outlined w-5 h-5 text-brand">hub</span>
              {t.departmentsTitle}
            </h2>
            <p className="text-sm text-text-muted mt-1">{t.departmentsDesc}</p>
          </div>
          <button
            onClick={handleCreateNew}
            className="p-2 rounded-lg bg-brand text-surface hover:bg-brand-hover transition-colors flex items-center justify-center"
          >
            <span className="material-symbols-outlined w-5 h-5">add</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {departmentList.length === 0 && selectedId !== "new" && (
            <div className="p-4 text-center text-sm text-text-muted bg-surface rounded-lg border border-line border-dashed">
              {t.noDepartments}
            </div>
          )}
          {departmentList.map(dep => (
            <div
              key={dep.id}
              onClick={() => handleSelect(dep.id)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedId === dep.id ? "border-brand bg-brand/5 shadow-sm" : "border-line bg-surface hover:border-brand/50"
              }`}
            >
              <div className="font-medium text-text-strong">{dep.title}</div>
              <div className="text-xs text-text-muted mt-1">{dep.id}</div>
            </div>
          ))}
          {selectedId === "new" && (
            <div className="p-3 rounded-lg border border-brand bg-brand/5 shadow-sm">
              <div className="font-medium text-brand">{t.newDepartment}</div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full md:w-2/3">
        {selectedId ? (
          <div className="quiet-card p-6 h-full border border-line">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-text-strong">
                {selectedId === "new" ? t.createDepartment : isEditing ? t.editDepartment : t.details}
              </h3>
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <button onClick={() => setIsEditing(false)} className="p-2 text-text-muted hover:text-text-strong hover:bg-surface-muted rounded-md transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined w-4 h-4">close</span>
                    </button>
                    <button onClick={handleSave} className="p-2 text-brand hover:bg-brand/10 rounded-md transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined w-4 h-4 animate-bounce-hover">save</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => setIsEditing(true)} className="p-2 text-text-muted hover:text-text-strong hover:bg-surface-muted rounded-md transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined w-4 h-4">edit</span>
                    </button>
                    <button onClick={() => handleDelete(selectedId)} className="p-2 text-danger hover:bg-danger/10 rounded-md transition-colors flex items-center justify-center">
                      <span className="material-symbols-outlined w-4 h-4">delete</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-danger/10 border border-danger/20 text-danger rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">{t.departmentId}</label>
                <input
                  type="text"
                  disabled={selectedId !== "new"}
                  value={formData.id || ""}
                  onChange={e => setFormData({ ...formData, id: e.target.value })}
                  className="w-full bg-surface-muted border border-line rounded-lg px-3 py-2 text-sm text-text-strong disabled:opacity-50"
                  placeholder="ingenieria"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">{t.name}</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={formData.title || ""}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-surface-muted border border-line rounded-lg px-3 py-2 text-sm text-text-strong disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">{t.description}</label>
                <textarea
                  disabled={!isEditing}
                  value={formData.description || ""}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-surface-muted border border-line rounded-lg px-3 py-2 text-sm text-text-strong disabled:opacity-50 h-24 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">{t.parentDepartment}</label>
                <select
                  disabled={!isEditing}
                  value={formData.parent_id || ""}
                  onChange={e => setFormData({ ...formData, parent_id: e.target.value })}
                  className="w-full bg-surface-muted border border-line rounded-lg px-3 py-2 text-sm text-text-strong disabled:opacity-50"
                >
                  <option value="">{t.noneTopLevel}</option>
                  {departmentList.filter(d => d.id !== formData.id).map(dep => (
                    <option key={dep.id} value={dep.id}>{dep.title}</option>
                  ))}
                </select>
              </div>

            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center border border-line border-dashed rounded-xl bg-surface-muted/30">
            <div className="text-center">
              <span className="material-symbols-outlined w-12 h-12 text-text-muted mx-auto mb-3 opacity-50">domain</span>
              <p className="text-text-muted text-sm">{t.selectOrCreate}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
