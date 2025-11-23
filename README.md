<div align="center">

# SYHC Self Hosted Build - Kortix – Open Source Platform to Build, Manage and Train AI Agents

![Kortix Screenshot](frontend/public/banner.png)

<div align="left">

## **Self Hosted Server Build of Kortix AI - Last Updated: <!-- DATE_START -->2025-11-23<!-- DATE_END -->**
**This is a self hosted server build of Kortix AI optimized for self-hosting via Cloudflare Tunnel/Local Docker with some networking fixes and additional features. Networking is the primary issue with self-hosting Kortix AI - see set up instructions below and disclaimers to avoid issues.**

## **Current Implemented Features:**

| Category | Feature/Bugfix | Description |
| :--- | :--- | :--- |
| **Feature** | Dev Mode + New Dev Mode Button Toggle | Fixes and adds a toggle button for the Development Mode. |
| **Feature** | New getAPI module | Updated all network calls to support localhost and cloudflare tunnel configurations. |
| **Feature** | Admin + User based Notifications/Inbox System | Centralized system for notifications and user-specific inboxes. |
| **Feature** | Auto Continue Prompting System (MVP) | Minimal viable product for automatically continuing prompts/conversations. |
| **Feature** | Library Implementation | Allows access to files and resources across different projects. |
| **Feature** | KB Based Slash Commands | Knowledge Base (KB) .prompt.md commands (similar to Github Copilot) and text-based prompts. |
| **Feature** | Left Sidebar with Inbox | Interface change for easy access to the Inbox system. |
| **Feature** | Native Ollama and LMStudio support | Integration with activation, and hot/cold startup capabilities. |
| **Feature** | Extended Model Support | Support for models via OpenRouter, LMStudio, Ollama, Google, and OpenAI. |

## **Planned Features/WIP:**

| Feature Category | Item | Dependencies/Notes |
| :--- | :--- | :--- |
| **Core Workflow** | Restored Workflow/Playbooks System | Currently a Work In Progress (WIP). |
| **Native Tool** | Subagent System | Depends on the Wide Research System being implemented. |
| **Native Tool** | Manus like Wide Research System | Depends on the Subagent System being implemented. |
| **Native Tool** | Gemini ComputerUse + BrowserUse Support | Depends on the Subagent System being implemented. |
| **Data/Files** | RAG System Support/Embeddings/RAG as a Service module support | Likely depends on Google Drive/OneDrive Native File Support and Syncing. |
| **Data/Files** | Google Drive/OneDrive Native File Support and Syncing | Direct integration for cloud file management. |
| **Core Workflow** | Native Support for continuous prompting | For custom budget models. |
| **Core Workflow** | Structured Output Workflows/Playbooks System | Depends on a working Restored Workflow/Playbooks System. |
| **Platform Expansion** | Plugin System | Modularized code architecture for future expansion. |

## **Setup Instructions for Self Hosted: (Recommended only for Experienced Devs/Homelab Users)**

**Note:** Self-hosting Kortix AI can be a bit of a process that requires a good understanding of Docker, Cloudflare Tunnels, and Supabase. If you are not comfortable with these technologies, it is recommended to use the cloud-hosted version of Kortix AI. After going through the setup process personally, I highly recommend using the cloud-hosted version of Kortix AI - its a really good deal compared to Manus. Self hosting w/ Cloudflare has a base cost of $10/mo minimum - Tunnel is free but you need TLS Total

**Is Self Hosting Worth It?**
-Pro: Long term reduced costs - pay API costs for LLM providers
-Pro: Enables custom features and workflows and early access to more 'advanced' features
-Pro: Enables access to local running LLMs via Ollama, LMStudio, and more
-Pro: Customize to your liking and incorporate your own integrations as needed
-Con: Self-hosting requires a good understanding of Docker, Cloudflare Tunnels, and Supabase
-Con: Maintenance and keeping up to date with main can be a bit of a process

**Git Clone + Docker Compose: (Recommended)**
-Clone the repository to your local machine
-From root /suna/
```
docker compose up -d --build
```
## **Configuration Self Hosted Architecture:**
**Cloudflare Tunnels: (Optional, Recommended for Secure Remote Access)** 
```
-Cloudflare Tunnels are recommended for secure remote access to your self-hosted Kortix AI instance
-Required: Automatic HTTPS encryption is also provided by Cloudflare w/ TLS Total + subdomain - Needed for Realtime Websocket Streaming/HTTPS
-SSL/TLS Setting: Flexible
-Your domain: yourdomain.com
-Backend: kong.yourdomain.com ---> supabase-kong
-Frontend: kortix.yourdomain.com ---> suna-frontend
-Supabase: supabase.yourdomain.com ---> supabase-kong
```
**Note:** Ensure your domain and subdomains are covered by Cloudflare TLS Total otherwise you will get errors with realtime streaming/HTTPS

**Docker Container (Suna):**
```
-suna-backend 8000:8000
-suna-frontend 9990:3000
-suna-redis 6380:6379
-suna-worker
```
**Docker Container (Supabase):**
```
-realtime-dev.supabase-realtime 8002:4000
-supabase-db 5434:5432
-supabase-auth 8100:9999
-supabase-kong 8888:8000
```
**Docker Container (Daytona):**
```
-Optional (highly recommend not running Daytona in Docker)
-Have tried this and it is not recommended - difficult to set up docker in docker correctly
-Recommend using Cloud based Daytona even while self hosted
-Even on powerful homelab or compute centers - Cloud Daytona is still much faster and more reliable
```
**Supabase Setup/Configuration:**
```
-WIP - git clone supabase/supabase 
-Ensure to run migrations in Supabase once it is set up correctly
-Will try to add a guide for the below items in the future
```
**Env Configuration:** 
```
-WIP
```
**Google/Github OAuth Configuration:**
```
-WIP
```
**Composio Configuration:**
```
-WIP
```
**Daytona Configuration:**
```
-WIP
```

</div>

<div align="center">

# Kortix – Open Source Platform to Build, Manage and Train AI Agents

![Kortix Screenshot](frontend/public/banner.png)

**The complete platform for creating autonomous AI agents that work for you**

Kortix is a comprehensive open source platform that empowers you to build, manage, and train sophisticated AI agents for any use case. Create powerful agents that act autonomously on your behalf, from general-purpose assistants to specialized automation tools.

[![License](https://img.shields.io/badge/License-Apache--2.0-blue)](./license)
[![Discord Follow](https://dcbadge.limes.pink/api/server/Py6pCBUUPw?style=flat)](https://discord.gg/RvFhXUdZ9H)
[![Twitter Follow](https://img.shields.io/twitter/follow/kortixai)](https://x.com/kortixai)
[![GitHub Repo stars](https://img.shields.io/github/stars/kortix-ai/suna)](https://github.com/kortix-ai/suna)
[![Issues](https://img.shields.io/github/issues/kortix-ai/suna)](https://github.com/kortix-ai/suna/labels/bug)

<!-- Keep these links. Translations will automatically update with the README. -->
[Deutsch](https://www.readme-i18n.com/kortix-ai/suna?lang=de) | 
[Español](https://www.readme-i18n.com/kortix-ai/suna?lang=es) | 
[français](https://www.readme-i18n.com/kortix-ai/suna?lang=fr) | 
[日本語](https://www.readme-i18n.com/kortix-ai/suna?lang=ja) | 
[한국어](https://www.readme-i18n.com/kortix-ai/suna?lang=ko) | 
[Português](https://www.readme-i18n.com/kortix-ai/suna?lang=pt) | 
[Русский](https://www.readme-i18n.com/kortix-ai/suna?lang=ru) | 
[中文](https://www.readme-i18n.com/kortix-ai/suna?lang=zh)

</div>

<div align="left">

## 🌟 What Makes Kortix Special

### 🤖 Includes Suna – Flagship Generalist AI Worker
Meet Suna, our showcase agent that demonstrates the full power of the Kortix platform. Through natural conversation, Suna handles research, data analysis, browser automation, file management, and complex workflows – showing you what's possible when you build with Kortix.

### 🔧 Build Custom Suna-Type Agents
Create your own specialized agents tailored to specific domains, workflows, or business needs. Whether you need agents for customer service, data processing, content creation, or industry-specific tasks, Kortix provides the infrastructure and tools to build, deploy, and scale them.

### 🚀 Complete Platform Capabilities
- **Browser Automation**: Navigate websites, extract data, fill forms, automate web workflows
- **File Management**: Create, edit, and organize documents, spreadsheets, presentations, code
- **Web Intelligence**: Crawling, search capabilities, data extraction and synthesis
- **System Operations**: Command-line execution, system administration, DevOps tasks
- **API Integrations**: Connect with external services and automate cross-platform workflows
- **Agent Builder**: Visual tools to configure, customize, and deploy agents

## 📋 Table of Contents

- [🌟 What Makes Kortix Special](#-what-makes-kortix-special)
- [🎯 Agent Examples & Use Cases](#-agent-examples--use-cases)
- [🏗️ Platform Architecture](#️-platform-architecture)
- [🚀 Quick Start](#-quick-start)
- [🏠 Self-Hosting](#-self-hosting)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## 🎯 Agent Examples & Use Cases

### Suna - Your Generalist AI Worker

Suna demonstrates the full capabilities of the Kortix platform as a versatile AI worker that can:

**🔍 Research & Analysis**
- Conduct comprehensive web research across multiple sources
- Analyze documents, reports, and datasets
- Synthesize information and create detailed summaries
- Market research and competitive intelligence

**🌐 Browser Automation**
- Navigate complex websites and web applications
- Extract data from multiple pages automatically
- Fill forms and submit information
- Automate repetitive web-based workflows

**📁 File & Document Management**
- Create and edit documents, spreadsheets, presentations
- Organize and structure file systems
- Convert between different file formats
- Generate reports and documentation

**📊 Data Processing & Analysis**
- Clean and transform datasets from various sources
- Perform statistical analysis and create visualizations
- Monitor KPIs and generate insights
- Integrate data from multiple APIs and databases

**⚙️ System Administration**
- Execute command-line operations safely
- Manage system configurations and deployments
- Automate DevOps workflows
- Monitor system health and performance

### Build Your Own Specialized Agents

The Kortix platform enables you to create agents tailored to specific needs:

**🎧 Customer Service Agents**
- Handle support tickets and FAQ responses
- Manage user onboarding and training
- Escalate complex issues to human agents
- Track customer satisfaction and feedback

**✍️ Content Creation Agents**
- Generate marketing copy and social media posts
- Create technical documentation and tutorials
- Develop educational content and training materials
- Maintain content calendars and publishing schedules

**📈 Sales & Marketing Agents**
- Qualify leads and manage CRM systems
- Schedule meetings and follow up with prospects
- Create personalized outreach campaigns
- Generate sales reports and forecasts

**🔬 Research & Development Agents**
- Conduct academic and scientific research
- Monitor industry trends and innovations
- Analyze patents and competitive landscapes
- Generate research reports and recommendations

**🏭 Industry-Specific Agents**
- Healthcare: Patient data analysis, appointment scheduling
- Finance: Risk assessment, compliance monitoring
- Legal: Document review, case research
- Education: Curriculum development, student assessment

Each agent can be configured with custom tools, workflows, knowledge bases, and integrations specific to your requirements.

## 🏗️ Platform Architecture

![Architecture Diagram](docs/images/diagram.png)

Kortix consists of four main components that work together to provide a complete AI agent development platform:

### 🔧 Backend API
Python/FastAPI service that powers the agent platform with REST endpoints, thread management, agent orchestration, and LLM integration with Anthropic, OpenAI, and others via LiteLLM. Includes agent builder tools, workflow management, and extensible tool system.

### 🖥️ Frontend Dashboard
Next.js/React application providing a comprehensive agent management interface with chat interfaces, agent configuration dashboards, workflow builders, monitoring tools, and deployment controls.

### 🐳 Agent Runtime
Isolated Docker execution environments for each agent instance featuring browser automation, code interpreter, file system access, tool integration, security sandboxing, and scalable agent deployment.

### 🗄️ Database & Storage
Supabase-powered data layer handling authentication, user management, agent configurations, conversation history, file storage, workflow state, analytics, and real-time subscriptions for live agent monitoring.

## 🚀 Quick Start

Get your Kortix platform running in minutes with our automated setup wizard:

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/kortix-ai/suna.git
cd suna
```

### 2️⃣ Run the Setup Wizard
```bash
python setup.py
```
The wizard will guide you through 14 steps with progress saving, so you can resume if interrupted.

### 3️⃣ Start the Platform
```bash
python start.py
```

That's it! Your Kortix platform will be running with Suna ready to assist you.

## 🏠 Self-Hosting

Just use "setup.py". Ty mate.

## 📄 License

Kortix is licensed under the Apache License, Version 2.0. See [LICENSE](./LICENSE) for the full license text.

---
</div>

<div align="center">

**Ready to build your first AI agent?** 

[Get Started](./docs/SELF-HOSTING.md) • [Join Discord](https://discord.gg/RvFhXUdZ9H) • [Follow on Twitter](https://x.com/kortix)

</div>
