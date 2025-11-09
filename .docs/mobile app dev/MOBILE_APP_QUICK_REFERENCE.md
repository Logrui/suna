# Kortix Mobile App - Quick Reference

## 🎯 Quick Navigation

### Key Files to Know

| File | Purpose |
|------|---------|
| `apps/mobile/hooks/useChat.ts` | MAIN HOOK - all chat functionality (854 lines) |
| `apps/mobile/api/types.ts` | All TypeScript types (559 lines) |
| `apps/mobile/api/config.ts` | Backend URL & auth token management |
| `apps/mobile/lib/chat/hooks.ts` | React Query hooks for API |
| `apps/mobile/components/pages/HomePage.tsx` | Main chat UI |
| `apps/mobile/app/_layout.tsx` | Root layout & auth protection |
| `apps/mobile/contexts/` | Auth, Agent, Billing state |

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────┐
│  Screens (app/*.tsx)                │
│  - auth, home, billing, etc.        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Components (components/*)          │
│  - pages, chat, agents, etc.        │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Hooks (hooks/*)                    │
│  - useChat (MAIN)                   │
│  - useAuth, useAgentStream          │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Libraries (lib/*)                  │
│  - React Query hooks                │
│  - API client                       │
│  - File upload, transcription       │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  API Layer (api/*)                  │
│  - Supabase client                  │
│  - Config & types                   │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Backend API                        │
│  http://localhost:8000/api          │
└─────────────────────────────────────┘
```

---

## 💡 Common Tasks

### Start Dev Server
```bash
cd apps/mobile
npm run dev
```

### Run on Device
```bash
npm run ios      # Simulator
npm run android  # Emulator
npm run web      # Browser
```

### Build for Production
```bash
eas build --profile production --platform ios
```

### Add New API Endpoint

1. Add types to `api/types.ts`
2. Add React Query hook to `lib/chat/hooks.ts`
3. Use in component via `useHook()`

### Add New Screen

1. Create component in `app/screen-name.tsx` or `app/folder/screen.tsx`
2. Add to `app/_layout.tsx` if needed
3. Route via `router.push()` or `Link`

### Add Component

1. Create in `components/feature/`
2. Use in pages or other components
3. Style with NativeWind (Tailwind classes)

---

## 🔌 useChat Hook API

### Initialization
```typescript
const chat = useChat();
```

### Thread Management
```typescript
chat.loadThread(threadId)        // Load existing thread
chat.startNewChat()              // Create new thread
chat.updateThreadTitle(title)    // Update title
chat.activeThread                // Current thread
chat.threads                      // All threads list
```

### Messaging
```typescript
chat.sendMessage(content, agentId, agentName)  // Send message
chat.messages                    // All messages
chat.isStreaming                 // Is message streaming?
chat.streamingContent            // Streaming text
chat.streamingToolCall           // Tool call being executed
```

### Attachments
```typescript
chat.attachments                 // Current attachments
chat.addAttachment(file)         // Add file
chat.removeAttachment(index)     // Remove file
chat.handleTakePicture()         // Camera
chat.handleChooseImages()        // Photo library
chat.handleChooseFiles()         // Documents
```

### Audio
```typescript
chat.transcribeAndAddToInput(uri)  // Record & transcribe
chat.isTranscribing              // Transcription in progress
```

### Quick Actions
```typescript
chat.selectedQuickAction         // Selected action ID
chat.handleQuickAction(id)       // Select action
chat.clearQuickAction()          // Deselect
chat.getPlaceholder()            // Input placeholder
```

### Control
```typescript
chat.stopAgent()                 // Stop running agent
chat.isAgentRunning              // Agent running?
chat.refreshMessages()           // Refresh message list
```

### UI State
```typescript
chat.inputValue                  // Input text
chat.setInputValue(text)         // Update input
chat.isLoading                   // Loading?
chat.isAttachmentDrawerVisible   // Drawer open?
chat.openAttachmentDrawer()      // Open
chat.closeAttachmentDrawer()     // Close
```

---

## 📦 API Types Reference

### Message Types
```typescript
interface UnifiedMessage {
  message_id: string | null
  thread_id: string
  type: 'user' | 'assistant' | 'tool' | 'system' | 'status' | ...
  is_llm_message: boolean
  content: string              // JSON string
  metadata: string             // JSON string
  created_at: string
  updated_at: string
}
```

### Thread
```typescript
interface Thread {
  thread_id: string
  project_id: string
  account_id: string
  agent_id?: string
  title?: string
  is_public: boolean
  project: Project
  created_at: string
  updated_at: string
}
```

### Agent
```typescript
interface Agent {
  id: string
  name: string
  description: string
  instructions: string
  model: string
  version: AgentVersion
  is_public: boolean
  tools: {
    enabled: string[]
    access_level: 'all' | 'specific'
  }
  memory_type: 'short_term' | 'long_term'
  triggers?: Trigger[]
}
```

---

## 🎨 NativeWind Styling

```tsx
// All standard Tailwind classes work
<View className="flex-1 bg-background p-4 rounded-lg">
  <Text className="text-lg font-semibold text-foreground">
    Hello
  </Text>
</View>

// Responsive
<View className="p-2 md:p-4 lg:p-8">

// Dark mode
<View className="bg-background dark:bg-slate-900">

// States
<Pressable className="active:opacity-80">
```

---

## 🧩 React Query Usage

### Query (fetch data)
```typescript
const { data, isLoading, error } = useThreads(projectId);

// Manual refetch
const { refetch } = useThreads();
await refetch();
```

### Mutation (send data)
```typescript
const sendMessage = useSendMessage({
  onSuccess: () => {
    console.log('Sent!');
  },
  onError: (error) => {
    console.error('Failed:', error);
  },
});

sendMessage.mutate({
  threadId: 'id',
  message: 'Hello',
  agent_id: 'agent-id',
});
```

---

## 🔐 Authentication Flow

```
User opens app
       ↓
Check Supabase session
       ↓
Session found?
   ├─→ YES: Load app (HomeScreen)
   └─→ NO: Redirect to Auth
       ↓
   Auth screen (login/signup)
       ↓
   Supabase authenticates
       ↓
   Session stored
       ↓
   App loads
```

---

## 📡 API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/threads` | GET | List threads |
| `/threads` | POST | Create thread |
| `/threads/{id}` | GET | Get thread |
| `/threads/{id}` | PATCH | Update thread |
| `/threads/{id}` | DELETE | Delete thread |
| `/threads/{id}/messages` | GET | Get messages |
| `/messages/send` | POST | Send message |
| `/agent-runs/start` | POST | Start agent |
| `/agent-runs/{id}/stop` | POST | Stop agent |
| `/agent-runs/active` | GET | Check active runs |
| `/agents` | GET | List agents |
| `/files/upload` | POST | Upload files |
| `/triggers` | GET | List triggers |

---

## ⚙️ Environment Variables

```bash
# .env (local development)
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000/api
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_DEV_HOST=localhost
EXPO_PUBLIC_FRONTEND_URL=https://kortix.example.com
```

---

## 🐛 Debugging

### React Query DevTools
```typescript
// Already configured, accessible in web version
```

### Console Logs
```typescript
console.log('📡 Message sent');  // Network operations
console.log('🤖 Agent started'); // Agent operations
console.log('🎯 Screen navigated'); // Navigation
```

### Check Authentication
```typescript
const { session, user } = await supabase.auth.getSession();
console.log(session, user);
```

### Network Issues
1. Check `EXPO_PUBLIC_BACKEND_URL` is correct
2. For physical device: Set `EXPO_PUBLIC_DEV_HOST=your-machine-ip`
3. For Android emulator: Uses `10.0.2.2` automatically
4. For iOS simulator: Uses `localhost` automatically

---

## 📚 Component Examples

### Using useChat in a Component
```tsx
function MyChatComponent() {
  const chat = useChat();
  
  if (!chat.activeThread) {
    return <Text>No thread loaded</Text>;
  }
  
  return (
    <View>
      <Text>{chat.activeThread.title}</Text>
      <Text>Messages: {chat.messages.length}</Text>
      <Button 
        onPress={() => chat.startNewChat()}
        title="New Chat"
      />
    </View>
  );
}
```

### Using React Query Hook
```tsx
function ThreadList() {
  const { data: threads, isLoading } = useThreads();
  
  if (isLoading) return <Text>Loading...</Text>;
  
  return (
    <FlatList
      data={threads}
      renderItem={({ item }) => (
        <Text>{item.title}</Text>
      )}
    />
  );
}
```

### Styled Component
```tsx
<View className="flex-1 bg-background p-4">
  <Text className="text-2xl font-bold text-foreground mb-4">
    Title
  </Text>
  <Pressable className="bg-primary p-3 rounded-lg active:opacity-80">
    <Text className="text-primary-foreground text-center">
      Button
    </Text>
  </Pressable>
</View>
```

---

## 🎯 Development Checklist

- [ ] Dependencies installed (`npm install`)
- [ ] Environment variables set (`.env`)
- [ ] Backend running (`http://localhost:8000/api`)
- [ ] Supabase configured
- [ ] Dev server started (`npm run dev`)
- [ ] Can log in
- [ ] Can send message
- [ ] Can upload file
- [ ] Can record audio
- [ ] Can select agent

---

## 🚨 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| `Backend URL not configured` | Set `EXPO_PUBLIC_BACKEND_URL` in `.env` |
| `Cannot connect from device` | Set `EXPO_PUBLIC_DEV_HOST` to machine IP |
| `Blank white screen` | Check logs, ensure fonts loaded |
| `Auth not working` | Check Supabase credentials in env vars |
| `Message not sending` | Check backend is running, token valid |
| `Hot reload not working` | Run `npm run clean` then restart |
| `File upload fails` | Check file size, MIME type |

---

## 📖 Documentation Files

- **Full Review:** `MOBILE_APP_REVIEW.md` (this directory)
- **README:** `apps/mobile/README.md`
- **Build Guide:** `apps/mobile/BUILD_GUIDE.md`
- **Type Definitions:** `apps/mobile/api/types.ts`

---

**Last Updated:** November 1, 2025  
**Branch:** `feature/ollama`  
**Status:** ✅ Production Ready
