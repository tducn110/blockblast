import os
import glob
import re

files_to_move = {
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

src_dir = os.path.abspath('src')

def get_new_path(old_abs_path):
    for src, dst in files_to_move.items():
        src_abs = os.path.abspath(src)
        src_no_ext = os.path.splitext(src_abs)[0]
        if old_abs_path == src_abs or old_abs_path == src_no_ext:
            return os.path.abspath(dst)
    return old_abs_path

def to_alias(abs_path):
    rel = os.path.relpath(abs_path, src_dir)
    rel = os.path.splitext(rel)[0]
    return f"@/{rel}"

import_pattern = re.compile(r'(import\s+.*?from\s+[\'"])(.*?)([\'"])', re.DOTALL)
import_side_effect_pattern = re.compile(r'(import\s+[\'"])(.*?)([\'"])', re.DOTALL)

file_contents = {}

for filepath in glob.glob('src/**/*.ts*', recursive=True):
    abs_path = os.path.abspath(filepath)
    with open(abs_path, 'r') as f:
        content = f.read()
    
    def replacer(match):
        prefix = match.group(1)
        import_str = match.group(2)
        suffix = match.group(3)
        
        if import_str.startswith('@/'):
            target_old_abs = os.path.normpath(os.path.join(src_dir, import_str[2:]))
        elif import_str.startswith('.'):
            old_dir = os.path.dirname(abs_path)
            target_old_abs = os.path.normpath(os.path.join(old_dir, import_str))
        else:
            return match.group(0)
        
        if import_str.endswith('.css') or import_str.endswith('.svg') or import_str.endswith('.png') or import_str.endswith('.jpg') or import_str.endswith('.webp'):
            return match.group(0)
            
        target_new_abs = get_new_path(target_old_abs)
        new_alias = to_alias(target_new_abs)
        return f"{prefix}{new_alias}{suffix}"

    new_content = import_pattern.sub(replacer, content)
    new_content = import_side_effect_pattern.sub(replacer, new_content)
    file_contents[abs_path] = new_content

# Move the files
for src, dst in files_to_move.items():
    if os.path.exists(src):
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        os.rename(src, dst)

# Write contents
for old_abs_path, content in file_contents.items():
    new_path = get_new_path(old_abs_path)
    with open(new_path, 'w') as f:
        f.write(content)

print("Moved and imports updated!")
