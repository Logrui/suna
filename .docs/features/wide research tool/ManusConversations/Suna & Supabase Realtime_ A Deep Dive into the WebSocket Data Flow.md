# Suna & Supabase Realtime: A Deep Dive into the WebSocket Data Flow

You are correct. While the reverse proxy is the immediate cause of the error, understanding the end-to-end data flow is crucial for proper debugging and development. Let's trace the complete journey of a real-time update in the Suna application, from a backend action to a frontend UI update.

## The Core Concept: Decoupled Real-Time Updates

The key architectural pattern here is that the **FastAPI backend does not directly communicate with the Next.js frontend**. Instead, they are decoupled, with the Supabase database and its Realtime service acting as the central message bus.

-   **Backend**: Writes state changes to the database.
-   **Frontend**: Listens for state changes from the database.

This is a robust and scalable pattern. The WebSocket connection is not between the frontend and your FastAPI backend; it's between the **frontend and the Supabase Realtime server**.

## Network and Data Flow Diagram

This diagram illustrates the complete sequence for the `useProjectRealtime` hook:

![Supabase Realtime Data Flow in Suna](https://private-us-east-1.manuscdn.com/sessionFile/gErdg7aLkJKZQHCIEyzqxt/sandbox/VUCrCqmoYHcThgsP4iWfeB-images_1762389332159_na1fn_L2hvbWUvdWJ1bnR1L3JlYWx0aW1lX2Zsb3c.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvZ0VyZGc3YUxrSktaUUhDSUV5enF4dC9zYW5kYm94L1ZVQ3JDcW1vWUhjVGhnc1A0aVdmZUItaW1hZ2VzXzE3NjIzODkzMzIxNTlfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwzSmxZV3gwYVcxbFgyWnNiM2MucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=A6Go5nZR2KX9j2bXv3vgcXuOL9yv82jHv9QH--rrfb02wxE0U~C-dT1IrmP7wpk0OWOUOhe82Mv5uG5xTI~lD8oX~fobGsKy5zZUfFxeVl8QiqLEZi3GZJHiIhIdryosYHzs8k5b89l-XDlewUNZfXtug1CLRDm7wHdhZUXjJpMwf5FELMbzWJulrQIhtLs9iMXdpwEJmiwAbQdBLaTrEBs2s0ygfaU555FNmHipJ2jNwpi-2FWp~t65oWygAd2NK2umKgmKJIxhr5WEvHynqZMBWU9hIGyLdXOzCP2tWt2HOVUmlTDFmi7jux3OIwkWIKVgICwHOGsZgE~SJkZYTA__)

## Step-by-Step Code and Network Trace

Here is the detailed breakdown of the files involved and the sequence of events:

### 1. Frontend: Initializing the Connection

This is the part of the flow that directly relates to your WebSocket error.

| File | Role | Code Snippet |
| :--- | :--- | :--- |
| `frontend/src/components/thread/ThreadComponent.tsx` | **UI Component** | `useProjectRealtime(projectId);` |
| `frontend/src/hooks/useProjectRealtime.ts` | **React Hook** | `const supabase = createClient();` <br> `channel = supabase.channel(...)` <br> `.on('postgres_changes', ...)` |
| `frontend/src/lib/supabase/client.ts` | **Supabase Client Factory** | `createBrowserClient(...)` |

**Sequence:**

1.  **`ThreadComponent.tsx` Mounts**: When you navigate to a project's thread page, this React component is rendered.
2.  **Hook Invocation**: Inside the component, the `useProjectRealtime(projectId)` hook is called. This is the starting point of the real-time logic.
3.  **Client Creation**: The hook calls `createClient()` from `client.ts`. This function reads your `.env` variables (`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and creates an instance of the Supabase JavaScript client.
4.  **WebSocket Handshake (The Point of Failure)**: The moment the Supabase client is initialized and a subscription is attempted, it tries to open a WebSocket connection to the URL you provided: `wss://kortix.syhc.dev/realtime/v1/websocket`. Your reverse proxy is intercepting this request and failing to upgrade it from a standard HTTP request to a WebSocket connection, causing the error.
5.  **Subscription**: If the connection were successful, the `.on('postgres_changes', ...)` part of the hook would send a message over the WebSocket, telling the Supabase Realtime server, "I want to be notified of all changes to the `projects` table where the `project_id` matches."

### 2. Backend: Triggering the Update

This part of the flow happens independently, whenever an agent's action causes a state change.

| File | Role | Action |
| :--- | :--- | :--- |
| `backend/api.py` (or similar) | **FastAPI Endpoint** | An agent performs a task that modifies the project's state. |
| `backend/core/db/projects.py` (example) | **Database Logic** | The backend code executes a standard SQL `UPDATE` statement against the PostgreSQL database. |

**Sequence:**

1.  **Agent Action**: A user asks the agent to do something. The agent runs a tool in its sandbox.
2.  **State Change**: The result of the tool run (e.g., new files created, command output) needs to be reflected in the UI.
3.  **Database Update**: The FastAPI backend updates the corresponding row in the `projects` table in your Supabase PostgreSQL database. It might update a JSONB field called `sandbox` with the new state. **The backend has no knowledge of the WebSocket connection.** It simply performs a standard database transaction.

### 3. Supabase: The Magic in the Middle

This is where the decoupling happens. Supabase's infrastructure connects the backend's action to the frontend's listener.

| Component | Role | Action |
| :--- | :--- | :--- |
| **Supabase (PostgreSQL)** | **Database** | The `UPDATE` from the backend modifies the `projects` table. |
| **Postgres Logical Replication** | **Notification System** | PostgreSQL has a built-in feature that writes all database changes to a special log (the Write-Ahead Log or WAL). |
| **Supabase (Realtime Server)** | **WebSocket Broadcaster** | This is a separate Elixir-based server that is subscribed to the PostgreSQL replication log. |

**Sequence:**

1.  **Database Write**: The `UPDATE` query from the FastAPI backend commits to the `projects` table.
2.  **Replication Log**: PostgreSQL writes this change to its replication stream.
3.  **Realtime Server Notification**: The Supabase Realtime server, which is constantly monitoring this stream, sees the change.
4.  **Broadcast**: The Realtime server checks which connected WebSocket clients are subscribed to changes on that specific table and row. It finds the subscription from your `useProjectRealtime` hook and pushes the new data (the `payload`) down the persistent WebSocket connection to your browser.

### 4. Frontend: Receiving the Update and Rerendering

Finally, the data arrives back at the browser.

| File | Role | Code Snippet |
| :--- | :--- | :--- |
| `frontend/src/hooks/useProjectRealtime.ts` | **React Hook** | `(payload) => { queryClient.invalidateQueries(...) }` |
| `@tanstack/react-query` | **Data Fetching Library** | Automatically refetches the project data. |
| `frontend/src/components/thread/ThreadComponent.tsx` | **UI Component** | Re-renders with the new data, showing the updated sandbox state. |

**Sequence:**

1.  **Payload Received**: The callback function inside the `.on()` method in `useProjectRealtime.ts` is executed with the new data from the database.
2.  **Cache Invalidation**: The hook calls `queryClient.invalidateQueries()`. This tells React Query, "The data we have for this project is now stale. You need to refetch it."
3.  **Data Refetch**: React Query automatically makes a new HTTP request to your FastAPI backend to get the latest, complete project data.
4.  **UI Update**: Once the fresh data is fetched, the `ThreadComponent.tsx` re-renders, and the user sees the updated sandbox information without ever having to press a refresh button.

## Summary

As you can see, the WebSocket connection is a **persistent, one-way communication channel from the Supabase Realtime server to the frontend client**. It is initiated by the frontend and is completely independent of your FastAPI backend's logic. The backend's only job is to write to the database, which then triggers this entire real-time event chain.

Your error occurs at the very beginning of this process (Step 1.4), preventing the entire real-time architecture from functioning.
