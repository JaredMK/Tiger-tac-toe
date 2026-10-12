#!/usr/bin/env sh
# Commit every change with the message you give and push, so the live site updates.
#   ./deploy.sh "what changed"
# Pushes HEAD to the main branch of the origin remote (GitHub Pages serves main, root folder).
# Override with DEPLOY_REMOTE=<remote> DEPLOY_BRANCH=<branch> ./deploy.sh "message".
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
git push "$remote" "HEAD:$branch"
echo "Pushed to $remote/$branch. GitHub Pages rebuilds in about a minute."
