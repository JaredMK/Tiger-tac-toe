#!/usr/bin/env sh
# Commit every change with the message you give and push, so the live site updates.
#   ./deploy.sh "what changed"
# Pushes HEAD to the main branch of the origin remote. GitHub Pages then publishes the site, and when
# the Cloud Functions or the database rules changed (functions/, engine.js, database.rules.json,
# firebase.json), the "Deploy Firebase" workflow tests them on the emulators and deploys them too.
# Override with DEPLOY_REMOTE=<remote> DEPLOY_BRANCH=<branch> ./deploy.sh "message".
# DEPLOY_FIREBASE=local also deploys functions and rules from this computer (needs `firebase login`).
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
server=$(git diff --name-only "$remote/$branch" HEAD -- functions engine.js physics.js database.rules.json firebase.json .firebaserc 2>/dev/null || echo "unknown")
git push "$remote" "HEAD:$branch"
echo "Pushed to $remote/$branch. GitHub Pages rebuilds in about a minute."
if [ -n "$server" ]; then
  if [ "$DEPLOY_FIREBASE" = "local" ]; then
    cp engine.js functions/engine.js
    cp physics.js functions/physics.js
    cp trivia.json functions/trivia.json
    firebase deploy --only functions,database --project tic-tac-chaos
  else
    echo "Functions or rules changed: the \"Deploy Firebase\" workflow tests and deploys them (a few minutes)."
  fi
fi
