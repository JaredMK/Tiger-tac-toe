#!/usr/bin/env sh
# Commits every change with the message you give and pushes it to main, deploying only what changed
# since the live version (the git diff against the remote's main):
#   the site (index.html, src/, the admin page, trivia.json)        the "Deploy to GitHub Pages" workflow
#   the functions (functions/, src/core, src/games but the views)   "Deploy Firebase", --only functions
#   the database rules (database.rules.json)                        "Deploy Firebase", --only database
# Each workflow runs only when its part changed (its path filter) and Firebase deploys only its changed
# part, so a push deploys exactly what this prints.
#   ./deploy.sh "what changed"
# DEPLOY_REMOTE=<remote> DEPLOY_BRANCH=<branch> push elsewhere (default: origin main).
# DEPLOY_FIREBASE=local also deploys the functions and rules from this computer (needs `firebase login`).
set -e
msg="${1:?usage: ./deploy.sh \"what changed\"}"
remote="${DEPLOY_REMOTE:-origin}"
branch="${DEPLOY_BRANCH:-main}"
git add -A
if git diff --cached --quiet; then
  echo "Nothing new to commit; pushing what is already committed."
else
  git commit -m "$msg"
fi
git fetch -q "$remote" "$branch" 2>/dev/null || true
if git rev-parse -q --verify "$remote/$branch" >/dev/null; then changed=$(git diff --name-only "$remote/$branch" HEAD); else changed=ALL; fi
site=''; fns=''; rules=''
if [ "$changed" = ALL ]; then site=1; fns=1; rules=1; fi
if echo "$changed" | grep -qE '^(index\.html|admin\.html|styles\.html|playtest\.js|trivia\.json|src/)'; then site=1; fi
if echo "$changed" | grep -v '/view\.js$' | grep -qE '^(functions/|src/core/|src/games/|trivia\.json|firebase\.json|\.firebaserc)'; then fns=1; fi
if echo "$changed" | grep -qE '^(database\.rules\.json|firebase\.json)'; then rules=1; fi
git push "$remote" "HEAD:$branch"
echo "Pushed to $remote/$branch."
if [ -n "$site" ]; then echo "Site: GitHub Pages rebuilds in about a minute."; fi
only=''
if [ -n "$fns" ]; then only=functions; fi
if [ -n "$rules" ]; then only="${only:+$only,}database"; fi
if [ -z "$site$only" ]; then echo "No site, functions or rules change: nothing deploys."; fi
if [ -n "$only" ]; then
  if [ "$DEPLOY_FIREBASE" = "local" ]; then
    node scripts/sync-functions.js
    firebase deploy --only "$only" --project tic-tac-chaos
  else
    echo "Firebase ($only): the \"Deploy Firebase\" workflow tests and deploys it (a few minutes)."
  fi
fi
