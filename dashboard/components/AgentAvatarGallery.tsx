import { MaterialIcon } from "./MaterialIcon";
import { avatarPresets } from "./agentSettingsData";

type Props = {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onSelect: (url: string) => void;
};

export function AgentAvatarGallery({ open, title, subtitle, onClose, onSelect }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface rounded-xl border border-line shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col scale-in">
        <div className="flex items-center justify-between border-b border-line bg-surface-muted px-6 py-4 rounded-t-xl">
          <div>
            <h3 className="text-base font-bold text-text-strong">{title}</h3>
            <p className="text-[10px] text-text-muted font-medium">{subtitle}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-line bg-surface text-text-muted hover:text-danger transition">
            <MaterialIcon name="close" className="w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-4">
            {avatarPresets.map((preset, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onSelect(preset.url);
                  onClose();
                }}
                className="flex flex-col items-center gap-2 p-2.5 rounded-xl border border-line hover:border-brand bg-surface hover:bg-surface-muted transition group"
              >
                <img src={preset.url} className="avatar-image w-12 h-12 rounded-full border border-line object-fill transition group-hover:scale-105" alt="" />
                <span className="text-[10px] text-text-muted font-semibold truncate max-w-full capitalize group-hover:text-text-strong transition">{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
