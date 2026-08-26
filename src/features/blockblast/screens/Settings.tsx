import { Globe, Music, Settings as SettingsIcon, Volume2, VolumeX, Vibrate, VibrateOff } from "lucide-react";
import { Button } from "@/components/shared/Button";
import { useTranslation } from "react-i18next";

interface SettingsProps {
  musicEnabled: boolean;
  sfxEnabled: boolean;
  shakeEnabled: boolean;
  onMusicChange: (enabled: boolean) => void;
  onSfxChange: (enabled: boolean) => void;
  onShakeChange: (enabled: boolean) => void;
  onBack: () => void;
}

export function SettingsScreen({ musicEnabled, sfxEnabled, shakeEnabled, onMusicChange, onSfxChange, onShakeChange, onBack }: SettingsProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.resolvedLanguage?.startsWith("en") ? "en" : "vi";
  const nextLanguage = currentLanguage === "vi" ? "en" : "vi";

  return (
    <div
      className="bg-[#fdf6ea] rounded-[24px] p-[32px_24px] border-[2px] border-[#8a7d65]/15 shadow-[0_14px_40px_rgba(42,36,24,0.18),0_2px_0_rgba(255,255,255,0.6)_inset] flex flex-col gap-[24px] relative w-full box-border"
    >
      <div className="flex items-center justify-center gap-3">
        <SettingsIcon size={28} className="text-[#2a2418]" />
        <h1 className="font-['Be_Vietnam_Pro',sans-serif] font-extrabold text-[clamp(24px,5vw,28px)] text-[#2a2418] m-0 leading-[1.2]">
          {t('SETTINGS_TITLE')}
        </h1>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center p-4 bg-[#8a7d65]/10 rounded-[16px]">
          <div className="font-semibold text-[#2a2418] flex items-center gap-2">
            <Globe size={20} />
            {t('LANGUAGE')}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void i18n.changeLanguage(nextLanguage)}
            aria-label={t('LANGUAGE')}
          >
            {nextLanguage.toUpperCase()}
          </Button>
        </div>

        <div className="flex justify-between items-center p-4 bg-[#8a7d65]/10 rounded-[16px]">
          <div className="font-semibold text-[#2a2418] flex items-center gap-2">
            {musicEnabled ? <Music size={20} /> : <VolumeX size={20} />}
            {t('MUSIC')}
          </div>
          <Button 
            variant={musicEnabled ? "primary" : "secondary"} 
            size="sm" 
            onClick={() => onMusicChange(!musicEnabled)}
          >
            {musicEnabled ? t('ON') : t('OFF')}
          </Button>
        </div>

        <div className="flex justify-between items-center p-4 bg-[#8a7d65]/10 rounded-[16px]">
          <div className="font-semibold text-[#2a2418] flex items-center gap-2">
            {sfxEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            {t('SFX_FULL')}
          </div>
          <Button 
            variant={sfxEnabled ? "primary" : "secondary"} 
            size="sm" 
            onClick={() => onSfxChange(!sfxEnabled)}
          >
            {sfxEnabled ? t('ON') : t('OFF')}
          </Button>
        </div>

        <div className="flex justify-between items-center p-4 bg-[#8a7d65]/10 rounded-[16px]">
          <div className="font-semibold text-[#2a2418] flex items-center gap-2">
            {shakeEnabled ? <Vibrate size={20} /> : <VibrateOff size={20} />}
            {t('SHAKE_SCREEN')}
          </div>
          <Button 
            variant={shakeEnabled ? "primary" : "secondary"} 
            size="sm" 
            onClick={() => onShakeChange(!shakeEnabled)}
          >
            {shakeEnabled ? t('ON') : t('OFF')}
          </Button>
        </div>
      </div>

      <Button onClick={onBack} size="md" variant="secondary" className="mt-2">
        {t('BACK')}
      </Button>
    </div>
  );
}
