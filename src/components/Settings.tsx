import React, { useState, useEffect } from 'react';
import { useSettings } from '../lib/settings-store';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Slider } from './ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { User, LogOut } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from './ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './ui/tabs';
import { Separator } from './ui/separator';
import { useVoice } from '../contexts/VoiceContext';

export function Settings() {
  // Add Account button functionality
  const handleAccountClick = () => {
    // Open account settings or profile page
    console.log('Account button clicked');
  };
  const { settings, updateOfficerName, updateOfficerRank, updateOfficerCodename, updateVoicePreferences, updateOfflineMode, updateCommandContext } = useSettings();
  const { speak } = useVoice();
  const [localName, setLocalName] = useState(settings.officerName);
  const [localRank, setLocalRank] = useState(settings.officerRank || 'Officer');
  const [localCodename, setLocalCodename] = useState(settings.officerCodename || '');

  // Test voice settings with current configuration
  const testVoiceSettings = async () => {
    const greeting = settings.officerName 
      ? `Hello ${settings.officerName}, this is how I will sound with the current settings.`
      : 'This is how I will sound with the current settings.';
    await speak(greeting);
  };

  // Save officer profile when input is complete
  const handleProfileSave = () => {
    // Trim values to remove extra spaces
    const trimmedName = localName.trim();
    const trimmedRank = localRank.trim();
    const trimmedCodename = localCodename.trim();
    
    // Update state with trimmed values
    updateOfficerName(trimmedName);
    updateOfficerRank(trimmedRank);
    updateOfficerCodename(trimmedCodename);
    
    // Store to localStorage with trimmed values for redundancy
    localStorage.setItem('lark-officer-name', trimmedName);
    localStorage.setItem('lark-officer-rank', trimmedRank);
    localStorage.setItem('lark-officer-codename', trimmedCodename);
    
    // Construct appropriate greeting using rank and name or codename
    let greeting = '';
    let displayName = '';
    
    if (trimmedCodename) {
      // Codename takes priority when set
      displayName = trimmedCodename;
      greeting = `Thank you, I'll remember to call you ${displayName}.`;
    } else if (trimmedName) {
      // When no codename, use rank and name
      displayName = `${trimmedRank} ${trimmedName}`;
      greeting = `Thank you, I'll address you as ${displayName}.`;
    } else {
      greeting = 'Profile updated successfully.';
    }
    
    // Display confirmation to user
    speak(greeting);
    
    // Update local state with trimmed values
    setLocalName(trimmedName);
    setLocalRank(trimmedRank);
    setLocalCodename(trimmedCodename);
    
    // Notify other components about the profile update
    document.dispatchEvent(new CustomEvent('officerProfileUpdated', { 
      detail: { 
        name: trimmedName,
        rank: trimmedRank,
        codename: trimmedCodename,
        displayName: displayName || trimmedRank // Fallback to rank if nothing else
      } 
    }));
  };
  
  // Load profile from localStorage on component mount
  useEffect(() => {
    // Load name
    const savedName = localStorage.getItem('lark-officer-name');
    if (savedName && savedName !== settings.officerName) {
      setLocalName(savedName);
      updateOfficerName(savedName);
    }
    
    // Load rank
    const savedRank = localStorage.getItem('lark-officer-rank');
    if (savedRank && savedRank !== settings.officerRank) {
      setLocalRank(savedRank);
      updateOfficerRank(savedRank);
    }
    
    // Load codename
    const savedCodename = localStorage.getItem('lark-officer-codename');
    if (savedCodename && savedCodename !== settings.officerCodename) {
      setLocalCodename(savedCodename);
      updateOfficerCodename(savedCodename);
    }
  }, []);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Settings</h2>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 rounded-full border-border/30 shadow-sm hover:bg-secondary/20"
          onClick={() => window.open('/account', '_blank')}
        >
          <User size={16} />
          <span>Account</span>
        </Button>
      </div>
      
      <Tabs defaultValue="profile" className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="voice">Voice</TabsTrigger>
          <TabsTrigger value="offline">Offline Mode</TabsTrigger>
          <TabsTrigger value="commands">Command Context</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Officer Profile</CardTitle>
              <CardDescription>
                Configure how LARK addresses you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="officerRank">Rank</Label>
                  <Select
                    value={localRank}
                    onValueChange={setLocalRank}
                  >
                    <SelectTrigger id="officerRank" className="w-full">
                      <SelectValue placeholder="Select your rank" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Officer">Officer</SelectItem>
                      <SelectItem value="Deputy">Deputy</SelectItem>
                      <SelectItem value="Sergeant">Sergeant</SelectItem>
                      <SelectItem value="Corporal">Corporal</SelectItem>
                      <SelectItem value="Detective">Detective</SelectItem>
                      <SelectItem value="Lieutenant">Lieutenant</SelectItem>
                      <SelectItem value="Captain">Captain</SelectItem>
                      <SelectItem value="Chief">Chief</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="officerName">Last Name</Label>
                  <Input
                    id="officerName"
                    placeholder="Enter your last name"
                    value={localName}
                    onChange={(e) => setLocalName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="officerCodename">
                    Codename (Optional)
                    <span className="text-xs text-muted-foreground block mt-1">
                      If provided, LARK will call you this instead of your rank and name
                    </span>
                  </Label>
                  <Input
                    id="officerCodename"
                    placeholder="Enter a preferred name"
                    value={localCodename}
                    onChange={(e) => setLocalCodename(e.target.value)}
                  />
                </div>
                
                <Button onClick={handleProfileSave} className="mt-2 w-full">
                  Save Profile
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="voice">
          <Card>
            <CardHeader>
              <CardTitle>Voice Settings</CardTitle>
              <CardDescription>
                Customize LARK's voice behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Volume</Label>
                <Slider
                  value={[settings.voicePreferences.volume * 100]}
                  onValueChange={(value) => 
                    updateVoicePreferences({ volume: value[0] / 100 })
                  }
                  max={100}
                  step={1}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Speed</Label>
                <Slider
                  value={[settings.voicePreferences.speed * 100]}
                  onValueChange={(value) => 
                    updateVoicePreferences({ speed: value[0] / 100 })
                  }
                  max={200}
                  step={1}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Urgency Levels</Label>
                <Switch
                  checked={settings.voicePreferences.urgencyLevels}
                  onCheckedChange={(checked) =>
                    updateVoicePreferences({ urgencyLevels: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Adaptive Speed</Label>
                <Switch
                  checked={settings.voicePreferences.adaptiveSpeed}
                  onCheckedChange={(checked) =>
                    updateVoicePreferences({ adaptiveSpeed: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Audio Feedback</Label>
                <Switch
                  checked={settings.voicePreferences.audioFeedback}
                  onCheckedChange={(checked) =>
                    updateVoicePreferences({ audioFeedback: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Voice Synthesis Method</Label>
                <Select
                  value={settings.voicePreferences.synthesisMethod}
                  onValueChange={(value: 'livekit' | 'browser' | 'auto') =>
                    updateVoicePreferences({ synthesisMethod: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select voice synthesis method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="livekit">LiveKit (Requires Microphone)</SelectItem>
                    <SelectItem value="browser">Browser Speech Synthesis</SelectItem>
                    <SelectItem value="auto">Auto (Fallback to Browser)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  LiveKit provides higher quality voices but requires microphone access. Browser synthesis works without permissions.
                </p>
              </div>

              <Button onClick={testVoiceSettings} className="mb-6">
                Test Voice Settings
              </Button>
              
              {/* LiveKit Voice Test section has been removed as requested */}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offline">
          <Card>
            <CardHeader>
              <CardTitle>Offline Mode</CardTitle>
              <CardDescription>
                Configure offline capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Cache</Label>
                <Switch
                  checked={settings.offlineMode.enableCache}
                  onCheckedChange={(checked) =>
                    updateOfflineMode({ enableCache: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Cache Statutes</Label>
                <Switch
                  checked={settings.offlineMode.cacheStatutes}
                  onCheckedChange={(checked) =>
                    updateOfflineMode({ cacheStatutes: checked })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Cache Miranda Rights</Label>
                <Switch
                  checked={settings.offlineMode.cacheMiranda}
                  onCheckedChange={(checked) =>
                    updateOfflineMode({ cacheMiranda: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Max Cache Size (MB)</Label>
                <Input
                  type="number"
                  value={settings.offlineMode.maxCacheSize}
                  onChange={(e) =>
                    updateOfflineMode({ maxCacheSize: parseInt(e.target.value) || 100 })
                  }
                  min={50}
                  max={1000}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commands">
          <Card>
            <CardHeader>
              <CardTitle>Command Context</CardTitle>
              <CardDescription>
                Configure how LARK maintains conversation context
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Enable Command Chaining</Label>
                <Switch
                  checked={settings.commandContext.enableChaining}
                  onCheckedChange={(checked) =>
                    updateCommandContext({ enableChaining: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Context Timeout (seconds)</Label>
                <Input
                  type="number"
                  value={settings.commandContext.contextTimeout}
                  onChange={(e) =>
                    updateCommandContext({ contextTimeout: parseInt(e.target.value) || 300 })
                  }
                  min={60}
                  max={3600}
                />
              </div>

              <div className="space-y-2">
                <Label>Max Context Length</Label>
                <Input
                  type="number"
                  value={settings.commandContext.maxContextLength}
                  onChange={(e) =>
                    updateCommandContext({ maxContextLength: parseInt(e.target.value) || 5 })
                  }
                  min={1}
                  max={10}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
