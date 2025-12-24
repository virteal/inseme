# GEMINI.md

## Project Overview

This is a **Kudocracy.Survey**, an open-source platform for citizen consultation and participatory
democracy. It is a web application built with React, Vite, and Tailwind CSS for the frontend, and
Netlify Functions for the serverless backend. The database is powered by Supabase (PostgreSQL). The
application also integrates with various AI services like OpenAI, Hugging Face, and Anthropic.

The goal of the project is to provide a reusable platform for municipalities and collectives to
engage with their citizens. The platform includes features like a collaborative wiki, a discussion
forum, a proposal and voting system, and an AI assistant named Ophélia.

## Building and Running

### Prerequisites

- Node.js version 18 or higher
- A Supabase account
- Netlify CLI

### Installation and Development

1.  **Clone the project:**

    ```bash
    git clone <repository-url>
    cd survey
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configure environment variables:** Copy the `.env.example` file to `.env` and fill in the
    required API keys and other configuration values. The project uses a centralized configuration
    system ("vault") - see `docs/CONFIGURATION_VAULT.md` for details.

    ```bash
    cp .env.example .env
    ```

4.  **Run in development mode:**
    ```bash
    netlify dev
    ```
    The application will be available at `http://localhost:8888`.

### Building for Production

To create a production build, run the following command:

```bash
npm run build
```

### Testing

The project includes a script for running RAG (Retrieval-Augmented Generation) and SQL tests via the
command line.

**RAG Test:**

```bash
node scripts/rag_chat_cli.js "Your question for Ophélia" --top 8 --fetch-limit 1500 --json
```

**SQL Test:**

```bash
RAG_SQL_ENDPOINT=https://<your-site>/api/chat-stream \
CLI_TOKEN=<your-netlify-cli-token> \
node scripts/rag_chat_cli.js --sql "SELECT id, title FROM wiki_pages ORDER BY updated_at DESC" --limit 50 --json
```

## Development Conventions

- **Code Formatting:** The project uses Prettier for code formatting. You can format the code by
  running `npm run format`.
- **Linting:** The project uses ESLint for JavaScript and Stylelint for CSS.
- **Git Hooks:** The project uses Husky for Git hooks. A pre-commit hook is configured to run
  `lint-staged`.
- **Branching:** (TODO: Add information about branching strategy if available)
- **Commits:** (TODO: Add information about commit message conventions if available)
