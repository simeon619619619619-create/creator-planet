# MCP Configuration

## Available Servers (from `.mcp.json`)

### Supabase
- **Type**: HTTP MCP
- **URL**: `https://mcp.supabase.com/mcp?project_ref=ilntxxutxbygjuixrzng`
- **Project**: FC (`ilntxxutxbygjuixrzng`)

### Stripe
- **Type**: HTTP MCP
- **URL**: `https://mcp.stripe.com/`
- **Account**: TBD (new Stripe account pending setup)

## Key Tools & Usage
| Server | Tool | Purpose |
|--------|------|---------|
| supabase | `list_tables` | View table structure |
| supabase | `execute_sql` | Run SQL queries (service_role access) |
| supabase | `apply_migration` | DDL schema changes |
| supabase | `list_edge_functions` | View deployed functions |
| supabase | `deploy_edge_function` | Deploy functions (⚠️ doesn't resolve `../_shared/` imports) |
| stripe | `list_products`, `list_prices` | View Stripe catalog |
| stripe | `list_customers`, `list_subscriptions` | Customer data |
| stripe | `search_stripe_documentation` | API reference |

## Configuration Notes
- MCP Supabase server runs with **service_role** permissions — can access auth schema and bypass RLS
- For edge function deployment with shared imports, use CLI: `npx supabase functions deploy <name>`
- To switch between Supabase projects, edit `.mcp.json` `project_ref` and run `/mcp`
- CC (Creator Club) project ref: `znqesarsluytxhuiwfkt` — anon key in `/Users/bojodanchev/creator-club™/.env.local`

## Agent Coordination

### Chatroom System
Agents communicate via `chatroom.md`. Template in `.claude/templates/chatroom-template.md`.

### Agent Definitions (`.claude/agents/`)
coordinator, explorer, architect, implementer, reviewer, debugger, tester

### Agent Mail (MCP-based)
Separate from role-based agents. Use for MCP coordination with `macro_start_session()`, `fetch_inbox()`, `send_message()`, etc. Project key: `/Users/bojodanchev/founders-club`.

### Commands
- `/coordinate [task]` - Start coordinated multi-agent work
- `/reset-chatroom` - Clear chatroom for new task
- `/learn` - Update knowledge base
