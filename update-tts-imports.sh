#!/bin/bash

# Update all imports to use the .tsx version of useSimulatedTTS
find /Users/bscott/Downloads/L.A.R.K/src -type f -name "*.tsx" -exec sed -i '' "s|from '../hooks/useSimulatedTTS';|from '../hooks/useSimulatedTTS.tsx';|g" {} \;
find /Users/bscott/Downloads/L.A.R.K/src -type f -name "*.ts" -exec sed -i '' "s|from '../hooks/useSimulatedTTS';|from '../hooks/useSimulatedTTS.tsx';|g" {} \;
find /Users/bscott/Downloads/L.A.R.K/src -type f -name "*.tsx" -exec sed -i '' "s|from '../../hooks/useSimulatedTTS';|from '../../hooks/useSimulatedTTS.tsx';|g" {} \;
find /Users/bscott/Downloads/L.A.R.K/src -type f -name "*.ts" -exec sed -i '' "s|from '../../hooks/useSimulatedTTS';|from '../../hooks/useSimulatedTTS.tsx';|g" {} \;

echo "Updated all imports to use ElevenLabs Josh voice implementation"
