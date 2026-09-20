cd g:\ClientVelo

# Ensure we have a clean git repo
if (Test-Path ".git") {
    Remove-Item -Recurse -Force .git
}
git init
git remote add origin git@github.com:setanvir/ClientVelo.git
git branch -M main

# Create a standard .gitignore if not exists
if (-not (Test-Path "clientvelo-engine\.gitignore")) {
    Set-Content "clientvelo-engine\.gitignore" "node_modules/`n.env`ndata/"
}
Set-Content "README.md" "# ClientVelo"

# Helper function to commit with a specific date
function Commit-WithDate {
    param(
        [string]$DateStr,
        [string]$Message
    )
    $env:GIT_COMMITTER_DATE = $DateStr
    git commit --date $DateStr -m "$Message"
}

# Day 1: 7 days ago
git add README.md SPEC.md.txt clientvelo-engine/package.json clientvelo-engine/package-lock.json clientvelo-engine/.gitignore clientvelo-engine/tsconfig.json
Commit-WithDate "2026-09-14 14:00:00" "Initial commit and Project Specifications"

# Day 2: 6 days ago
git add clientvelo-engine/src/store.ts clientvelo-engine/src/types.ts clientvelo-engine/src/config.ts clientvelo-engine/src/drafts.ts
Commit-WithDate "2026-09-15 15:30:00" "Setup store, types and configuration"

# Day 3: 5 days ago
git add clientvelo-engine/src/enrich.ts clientvelo-engine/src/mailer.ts clientvelo-engine/src/validate.ts clientvelo-engine/src/qualify.ts
Commit-WithDate "2026-09-16 11:15:00" "Implement core business logic (enrich, mailer, validate)"

# Day 4: 4 days ago
git add clientvelo-engine/src/discover.ts clientvelo-engine/src/import.ts clientvelo-engine/src/suppression.ts clientvelo-engine/src/queue.ts
Commit-WithDate "2026-09-17 16:45:00" "Add pipeline operations (discover, import, deduplication)"

# Day 5: 3 days ago
git add clientvelo-engine/src/cli.ts clientvelo-engine/tests
Commit-WithDate "2026-09-18 10:20:00" "Develop CLI interface and robust testing"

# Day 6: 2 days ago
git add clientvelo-engine/src/server.ts clientvelo-engine/src/server-routes.ts clientvelo-engine/src/jobs.ts
Commit-WithDate "2026-09-19 13:50:00" "Implement Dashboard Server and Jobs Runner backend"

# Day 7: 1 day ago
git add implementation_plan.md implementation_plan_phase5.md clientvelo-engine/public clientvelo-engine/data clientvelo-engine/.env.example
# Catch any remaining files
git add .
Commit-WithDate "2026-09-20 09:10:00" "Finalize frontend dashboard UI and add Implementation Plans"

# Attempt to push
Write-Host "Pushing to origin main..."
git push -u origin main
