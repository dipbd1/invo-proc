# Review UI

Local Vite app. Talks to ingest on `:3001` through the `/api` proxy. Never calls Gemini or the accounting API directly.

```bash
cd packages/shared && npm install
cd ../../apps/ingest && npm start
cd ../review && npm install && npm run dev
```

Open http://localhost:3000. Approve & post is the only write into the accounting mock.
