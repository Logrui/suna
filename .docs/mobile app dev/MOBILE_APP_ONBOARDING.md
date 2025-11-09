# 🚀 Kortix Mobile App - Developer Onboarding Guide

**Welcome!** This guide will get you up to speed on the Kortix mobile app in 15 minutes.

---

## ⚡ 5-Minute Overview

### What is This?
A React Native mobile app (iOS, Android, Web) that lets users chat with AI agents. Think ChatGPT, but with file uploads, real-time streaming, and integration with custom AI agents.

### Tech Stack (You Need to Know These)
- **React Native** - Mobile framework
- **Expo** - Build & deployment platform
- **TypeScript** - Language
- **React Query** - Data fetching
- **Supabase** - Authentication & database
- **NativeWind** - Styling (Tailwind for React Native)

### Where Is Everything?
```
apps/mobile/
├── hooks/useChat.ts          ← EVERYTHING HAPPENS HERE
├── components/               ← UI screens
├── lib/chat/                 ← API hooks
├── api/                      ← Backend config & types
└── contexts/                 ← App state (auth, billing, etc.)
```

---

## 📱 The Main Hook: `useChat`

95% of the app's logic lives in one hook. Memorize this:

```typescript
import { useChat } from '@/hooks';

function MyChatComponent() {
  const chat = useChat();
  
  // Everything you need:
  chat.messages              // List of messages
  chat.activeThread          // Current conversation
  chat.sendMessage(...)      // Send a message
  chat.addAttachment(file)   // Attach a file
  chat.stopAgent()           // Stop running agent
  chat.streamingContent      // Real-time text appearing
}
```

That's 80% of what you need to know.

---

## 🎯 10-Minute Task: Send Your First Message

### Step 1: Start the app
```bash
cd apps/mobile
npm install
npm run dev
```

### Step 2: Look at the main screen
```tsx
// apps/mobile/components/pages/HomePage.tsx
export const HomePage = React.forwardRef<...>((props) => {
  const chat = useChat();  // ← THERE IT IS
  
  return (
    <View>
      {/* Messages display */}
      {chat.messages.map((msg) => (
        <MessageItem key={msg.message_id} message={msg} />
      ))}
      
      {/* Input section */}
      <ChatInputSection
        value={chat.inputValue}
        onChangeText={chat.setInputValue}
        onSendMessage={(content, agentId) => 
          chat.sendMessage(content, agentId, agentName)
        }
      />
    </View>
  );
});
```

### Step 3: Trace the message flow
1. User types: `chat.setInputValue(text)`
2. User taps Send: `chat.sendMessage(content, agentId, agentName)`
3. In `useChat.ts`:
   - Upload files (if any)
   - Call API with `useSendMessage()` mutation
   - Stream responses with `useAgentStream()`
   - Update `chat.messages`

### Step 4: Check the API
```typescript
// apps/mobile/lib/chat/hooks.ts
export function useSendMessage(...) {
  return useMutation({
    mutationFn: async (input) => {
      const headers = await getAuthHeaders();  // Get token
      const res = await fetch(`${API_URL}/messages/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(input),
      });
      return res.json();
    },
  });
}
```

Done! You now understand message sending. 🎉

---

## 🔑 Key Concepts

### 1. The useChat Hook (854 lines)
**Where:** `hooks/useChat.ts`  
**What:** Main hook managing all chat state and operations  
**Usage:** `const chat = useChat()`

**Main Methods:**
- `chat.sendMessage(content, agentId, agentName)` - Send message
- `chat.loadThread(threadId)` - Load conversation
- `chat.startNewChat()` - Create new conversation
- `chat.addAttachment(file)` - Add file
- `chat.stopAgent()` - Stop AI execution

**Main State:**
- `chat.messages` - All messages
- `chat.activeThread` - Current conversation
- `chat.isStreaming` - AI is responding?
- `chat.streamingContent` - AI text appearing
- `chat.attachments` - Uploaded files

### 2. React Query (Server State)
**Where:** `lib/chat/hooks.ts`  
**What:** Fetches data from backend, caches it  
**Pattern:**
```typescript
const { data, isLoading } = useThreads();
const mutation = useSendMessage();
```

**Key Queries:**
- `useThreads()` - Get all conversations
- `useMessages(threadId)` - Get messages
- `useAgents()` - Get AI agents

### 3. Supabase (Auth & Database)
**Where:** `api/supabase.ts`  
**What:** Handles login, session, token storage  
**Pattern:**
```typescript
const { data: { session } } = await supabase.auth.getSession();
// Token automatically included in API requests
```

### 4. Streaming (Real-Time Updates)
**Where:** `hooks/useAgentStream.ts`  
**What:** Listens to server for live messages  
**Pattern:**
```typescript
const { streamContent } = useAgentStream(threadId);
// streamContent updates as AI responds
```

### 5. API Types (Type Safety)
**Where:** `api/types.ts` (559 lines)  
**What:** All TypeScript interfaces for the API  
**Key Types:**
- `Thread` - A conversation
- `UnifiedMessage` - A message from user/AI
- `Agent` - An AI agent
- `Project` - A workspace

---

## 🗂️ File Organization Cheat Sheet

```
apps/mobile/
│
├── api/                        ← BACKEND INTEGRATION
│   ├── config.ts              # Backend URL, auth tokens
│   ├── supabase.ts            # Login/auth
│   ├── types.ts               # TypeScript interfaces
│   └── index.ts               # Exports
│
├── hooks/                      ← BUSINESS LOGIC
│   ├── useChat.ts             # MAIN HOOK (854 lines)
│   ├── useAgentStream.ts      # Real-time streaming
│   ├── useAuth.ts             # Login flow
│   └── useNavigation.ts       # Screen navigation
│
├── lib/                        ← UTILITIES & API CALLS
│   ├── chat/
│   │   ├── api.ts             # API functions
│   │   ├── hooks.ts           # React Query hooks (502 lines)
│   │   └── transcription.ts   # Audio to text
│   ├── files/                 # File upload logic
│   └── utils/                 # Helper functions
│
├── components/                 ← UI SCREENS & PARTS
│   ├── pages/
│   │   ├── HomePage.tsx       # Main chat screen
│   │   ├── ThreadPage.tsx     # Thread view
│   │   └── MenuPage.tsx       # Drawer menu
│   ├── chat/                  # Message display
│   ├── agents/                # Agent picker
│   ├── settings/              # Settings screens
│   └── ui/                    # Reusable components
│
├── contexts/                   ← APP STATE
│   ├── AuthContext.tsx        # Login state
│   ├── AgentContext.tsx       # Selected agent
│   ├── BillingContext.tsx     # Credits
│   └── LanguageContext.tsx    # Language setting
│
├── app/                        ← EXPO ROUTER SCREENS
│   ├── _layout.tsx            # Root layout
│   ├── home.tsx               # Main app
│   ├── auth/index.tsx         # Login screen
│   └── billing/index.tsx      # Billing
│
├── locales/                    ← TRANSLATIONS
│   ├── en.json
│   ├── es.json
│   └── ...
│
└── assets/                     ← IMAGES & FONTS
    ├── images/
    └── fonts/
```

**Rule of Thumb:**
- Questions about messages? → `hooks/useChat.ts`
- Questions about API? → `lib/chat/hooks.ts` or `api/types.ts`
- Questions about styling? → `components/`
- Questions about auth? → `contexts/AuthContext.tsx`

---

## 💻 Common Developer Tasks

### Add a New Button
```tsx
// components/MyComponent.tsx
import { Pressable, Text, View } from 'react-native';

export function MyButton() {
  return (
    <Pressable 
      className="bg-primary p-3 rounded-lg active:opacity-80"
      onPress={() => console.log('Pressed!')}
    >
      <Text className="text-white font-semibold text-center">
        Click Me
      </Text>
    </Pressable>
  );
}
```

### Display Messages
```tsx
// Use useChat hook
const chat = useChat();

return (
  <FlatList
    data={chat.messages}
    renderItem={({ item }) => (
      <View className="p-2">
        <Text>{item.content}</Text>
      </View>
    )}
  />
);
```

### Make an API Call
```tsx
// Use React Query hook from lib/chat/hooks.ts
import { useThreads } from '@/lib/chat';

const { data: threads, isLoading } = useThreads();

if (isLoading) return <Text>Loading...</Text>;
return <ThreadList threads={threads} />;
```

### Add a New Context
```tsx
// contexts/MyContext.tsx
const MyContext = createContext<MyContextType>(null);

export function MyProvider({ children }) {
  const [state, setState] = useState(initialValue);
  
  return (
    <MyContext.Provider value={{ state, setState }}>
      {children}
    </MyContext.Provider>
  );
}

export function useMyContext() {
  const ctx = useContext(MyContext);
  if (!ctx) throw new Error('Must be inside MyProvider');
  return ctx;
}
```

### Handle Errors
```tsx
// Get error from hook
const { data, isError, error } = useThreads();

if (isError) {
  return (
    <Alert 
      title="Error" 
      message={error?.message || 'Something went wrong'}
    />
  );
}
```

---

## 🧪 How the Chat Works (Under the Hood)

### 1. User sends message
```
chat.sendMessage("Hello", "agent-123", "Claude")
         ↓
   useSendMessage mutation
         ↓
   POST /api/messages/send
         ↓
```

### 2. Backend processes
```
Backend receives message
         ↓
   Loads agent
         ↓
   Calls Claude API (or other LLM)
         ↓
```

### 3. Response streams back
```
Backend sends SSE events
         ↓
   useAgentStream listener
         ↓
   Chat.streamingContent += text
         ↓
   UI updates in real-time
         ↓
```

### 4. Message saved
```
Stream complete
         ↓
   useChat invalidates cache
         ↓
   React Query refetches
         ↓
   chat.messages updated
```

---

## 🔒 Authentication Flow

### Sign In
```
User enters email/password
         ↓
   supabase.auth.signInWithPassword()
         ↓
   Token returned
         ↓
   Stored in AsyncStorage
         ↓
   Auto-refreshed on app focus
         ↓
   Included in all API requests
```

### Sign Out
```
User taps Sign Out
         ↓
   supabase.auth.signOut()
         ↓
   Token cleared
         ↓
   Redirected to /auth
```

---

## 📊 Data Models to Know

### Message
```typescript
{
  message_id: "msg-123",
  thread_id: "thread-456",
  type: "user" | "assistant" | "tool" | ...,
  content: "Hello world",  // JSON string
  created_at: "2025-01-01T12:00:00Z",
}
```

### Thread (Conversation)
```typescript
{
  thread_id: "thread-456",
  project_id: "proj-789",
  title: "My Chat",
  created_at: "2025-01-01T12:00:00Z",
}
```

### Agent (AI Bot)
```typescript
{
  id: "agent-123",
  name: "Claude",
  description: "AI assistant",
  model: "claude-3-5-sonnet",
  tools: { enabled: ["web_search", "file_upload"] },
}
```

---

## 🐛 Debugging Tips

### See console logs
```bash
# In dev mode, check terminal output
npm run dev
```

### Check network requests (Web)
```bash
# Run on web to use browser dev tools
npm run web
```

### Inspect app state
```typescript
// Add to component
import { useChat } from '@/hooks';

const chat = useChat();
console.log('Chat state:', {
  messages: chat.messages,
  activeThread: chat.activeThread,
  isStreaming: chat.isStreaming,
});
```

### Check authentication
```typescript
import { supabase } from '@/api/supabase';

const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
```

---

## 🚀 Next Steps

1. **Run the app locally**
   ```bash
   cd apps/mobile
   npm install
   npm run dev
   ```

2. **Read the main hook** (`hooks/useChat.ts`)
   - Understand the message flow
   - See all available methods

3. **Explore API types** (`api/types.ts`)
   - Understand data structures

4. **Make a small change**
   - Add a button
   - Change a color
   - Add a console log

5. **Read the full review** (`MOBILE_APP_REVIEW.md`)
   - For deeper architecture understanding

---

## 📚 Key Files to Read (In Order)

1. **`api/types.ts`** (10 min read) - Understand data types
2. **`hooks/useChat.ts`** (30 min read) - Main logic
3. **`components/pages/HomePage.tsx`** (10 min read) - UI structure
4. **`lib/chat/hooks.ts`** (20 min read) - API integration
5. **`app/_layout.tsx`** (10 min read) - App structure

---

## ✅ You're Ready!

You now know:
- ✅ Where to find things
- ✅ How the chat works
- ✅ Where to make changes
- ✅ How to debug

**Go build something awesome!** 🚀

---

## Quick Reference Card

```
MAIN HOOK:
  const chat = useChat()
  ├── chat.messages
  ├── chat.sendMessage(...)
  ├── chat.addAttachment(...)
  └── chat.streamingContent

QUERIES:
  useThreads()
  useMessages(threadId)
  useAgents()

STYLING:
  className="flex-1 bg-background p-4"

API TYPES:
  Thread, UnifiedMessage, Agent

CONTEXTS:
  useAuthContext()
  useBillingContext()
  useLanguage()
```

---

*Next: Read `MOBILE_APP_REVIEW.md` for deep-dive architecture info*

**Questions? Check these files:**
- Problems with chat? → `hooks/useChat.ts`
- Problems with styling? → `components/`
- Problems with data? → `lib/chat/hooks.ts`
- Problems with types? → `api/types.ts`
