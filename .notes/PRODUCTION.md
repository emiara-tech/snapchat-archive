# Goodbye Chat Production Readiness

This repository is prepared for a manual Cloudflare Pages deployment to `https://goodbye.chat`. Deployment remains an owner task.


The production build output directory is `dist`.

## Remote repository hosting
Due to the heavy integrations with both automatic AI-code review tools, easy deploy tools like vercel and cloudflare, and blacksmith.sh.  The project should move from codeberg to github. A mirror was considered but in the end deemed unessesary. Sorry codeberg.

## CI/CD
[x] dev branch for main development
[x] main branch for production

[] coderabbit for AI codereview
[] blacksmith for building

Should be a `pull request` first workflow. This is to encurage contributions to the tools that will be added to analyse the archive.


## Cloudflare Pages Settings

Use these settings when creating the Pages project:

```text
Framework preset: Vue or Vite
Build command: pnpm build
Build output directory: dist
Root directory: /
Production branch: main
Environment variables: none
```

The app is a Vue Router history-mode SPA. Cloudflare Pages should serve `index.html` for direct route visits through `public/_redirects`:

```text
/* /index.html 200
```

## Owner Deployment Checklist

- Open the Cloudflare dashboard.
- Go to Workers & Pages.
- Create a Pages project.
- Connect the repository source.
- Set the build command to `pnpm build`.
- Set the build output directory to `dist`.
- Deploy the first preview.
- Test the preview URL.
- Add the custom domain `goodbye.chat`.
- Add the custom domain `www.goodbye.chat`.
- Configure `www.goodbye.chat` to redirect to `https://goodbye.chat`.
- Verify HTTPS works.
- Verify direct route refresh works for `/privacy` and `/import`.

## Known Launch Tradeoff

`cities.json` currently creates a large lazy chunk. This is accepted for launch and should not block deployment. Revisit the city lookup strategy after the first production deployment if measured performance shows a real issue.

## Rollback Basics

Cloudflare Pages keeps deployment history for the project. If a production deployment has a problem, use the Cloudflare Pages dashboard to promote the previous known-good deployment, then investigate and fix the repository before redeploying.

No deployment should be performed from this repository-readiness pass.
