import { Music, Settings as SettingsIcon, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface SettingsProps {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  onMusicChange: (enabled: boolean) => void;
  onSfxChange: (enabled: boolean) => void;
  onBack: () => void;
}

export function SettingsScreen({ musicEnabled, sfxEnabled, onMusicChange, onSfxChange, onBack }: SettingsProps) {
  return (
    <div
      className="bg-[#fdf6ea] rounded-[24px] p-[32px_24px] border-[2px] border-[#8a7d65]/15 shadow-[0_14px_40px_rgba(42,36,24,0.18),0_2px_0_rgba(255,255,255,0.6)_inset] flex flex-col gap-[24px] relative w-full box-border"
    >
      <div className="flex items-center justify-center gap-3">
        <SettingsIcon size={28} className="text-[#2a2418]" />
        <h1 className="font-['Be_Vietnam_Pro',sans-serif] font-extrabold text-[clamp(24px,5vw,28px)] text-[#2a2418] m-0 leading-[1.2]">
          Cài Đặt
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center p-4 bg-[#8a7d65]/10 rounded-[16px]">
          <div className="font-semibold text-[#2a2418] flex items-center gap-2">
            {musicEnabled ? <Music size={20} /> : <VolumeX size={20} />}
            Nhạc nền
          </div>
          <Button 
            variant={musicEnabled ? "primary" : "secondary"} 
            size="sm" 
            onClick={() => onMusicChange(!musicEnabled)}
          >
            {musicEnabled ? "Bật" : "Tắt"}
          </Button>
        </div>

        <div className="flex justify-between items-center p-4 bg-[#8a7d65]/10 rounded-[16px]">
          <div className="font-semibold text-[#2a2418] flex items-center gap-2">
            {sfxEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            Hiệu ứng âm thanh
          </div>
          <Button 
            variant={sfxEnabled ? "primary" : "secondary"} 
            size="sm" 
            onClick={() => onSfxChange(!sfxEnabled)}
          >
            {sfxEnabled ? "Bật" : "Tắt"}
          </Button>
        </div>
      </div>

      <Button onClick={onBack} size="md" variant="secondary" className="mt-2">
        ← Quay lại
      </Button>
    </div>
  );
}
