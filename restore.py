import os
import shutil

moves = {
    'src/hooks/pixi/usePixiAnimations.ts': 'src/features/blockblast/render/usePixiAnimations.ts',
    'src/hooks/pixi/usePixiApp.ts': 'src/features/blockblast/render/usePixiApp.ts',
    'src/hooks/pixi/usePixiBoard.ts': 'src/features/blockblast/render/usePixiBoard.ts',
    'src/hooks/pixi/usePixiPieces.ts': 'src/features/blockblast/render/usePixiPieces.ts',
    
    'src/utils/blockBlastLogic.ts': 'src/features/blockblast/game/blockBlastLogic.ts',
    'src/utils/localStats.ts': 'src/features/blockblast/game/localStats.ts',
    'src/utils/pixiDrawUtils.ts': 'src/features/blockblast/game/pixiDrawUtils.ts',
    
    'src/components/game/GameHUD.tsx': 'src/features/blockblast/components/GameHUD.tsx',
    'src/components/game/gameThemes.ts': 'src/features/blockblast/components/gameThemes.ts',
    'src/components/game/Game.tsx': 'src/features/blockblast/components/Game.tsx',
    'src/components/game/Mascot.tsx': 'src/features/blockblast/components/Mascot.tsx',
    'src/components/game/PixiBlockBlastCanvas.tsx': 'src/features/blockblast/components/PixiBlockBlastCanvas.tsx',
    
    'src/components/screens/Dashboard.tsx': 'src/features/blockblast/screens/Dashboard.tsx',
    'src/components/screens/Settings.tsx': 'src/features/blockblast/screens/Settings.tsx',
    
    'src/hooks/useBlockBlastGame.ts': 'src/features/blockblast/hooks/useBlockBlastGame.ts',
    'src/hooks/useScoreData.ts': 'src/features/blockblast/hooks/useScoreData.ts',
    
    'src/lib/dashboardHelpers.ts': 'src/features/blockblast/lib/dashboardHelpers.ts',
    'src/lib/localScores.ts': 'src/features/blockblast/lib/localScores.ts',
    
    'src/constants/gameText.ts': 'src/features/blockblast/lib/gameText.ts',
}

# Reverse the moves
for dst, src in moves.items():
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        os.rename(src, dst)

print("Files restored.")
