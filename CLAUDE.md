@AGENTS.md

## Workflow

- The repository owner wants every change shipped to `main` automatically:
  after committing and pushing work, open a pull request into `main` and merge
  it, without waiting to be asked.
- Before pushing, run `npm run lint`, `npm run typecheck`, `npm test`, and a
  production build (`npm run build`, with placeholder env vars if needed).
