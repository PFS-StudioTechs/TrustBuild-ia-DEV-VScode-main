# hello-status.ps1 — UserPromptSubmit hook
# Triggers on "Hello" — shows project status + active session config
# Setup per partner: add GITHUB_TOKEN + VERCEL_TOKEN in .claude/settings.local.json

$rawInput = [Console]::In.ReadToEnd()
if (-not $rawInput) { Write-Output '{"continue":true}'; exit 0 }

try { $payload = $rawInput | ConvertFrom-Json }
catch { Write-Output '{"continue":true}'; exit 0 }

$prompt = if ($payload.prompt) { $payload.prompt.Trim() } else { "" }
if ($prompt -notmatch '^[Hh]ello') { Write-Output '{"continue":true}'; exit 0 }

$cwd = $payload.cwd
if (-not $cwd) { $cwd = (Get-Location).Path }

$lines = @()
$lines += "=== STATUS PROJET — $cwd ==="

# Project name
$projectName = $env:VERCEL_APP_NAME
$packageJsonPath = Join-Path $cwd "package.json"
if (-not $projectName -and (Test-Path $packageJsonPath)) {
    try { $projectName = (Get-Content $packageJsonPath -Raw | ConvertFrom-Json).name } catch {}
}
if (-not $projectName) { $projectName = Split-Path $cwd -Leaf }
$lines += "Projet: $projectName"

# Git
git -C "$cwd" rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -eq 0) {
    $branch = git -C "$cwd" rev-parse --abbrev-ref HEAD 2>$null
    $remote = git -C "$cwd" remote get-url origin 2>$null
    if ($branch) { $lines += "Branche active: $branch" }
    if ($remote)  { $lines += "Remote: $remote" }

    $dirty = git -C "$cwd" status --porcelain 2>$null
    if ($dirty) {
        $n = ($dirty -split "`n" | Where-Object { $_ }).Count
        $lines += "Fichiers non commités: $n"
    } else {
        $lines += "Working tree: propre" }

    # GitHub API — commits with GitHub login
    $ghToken = $env:GITHUB_TOKEN
    if ($ghToken -and $remote -match 'github\.com[/:]([^/]+)/([^/\.]+)(\.git)?$') {
        $owner = $Matches[1]; $repo = $Matches[2]
        try {
            $h = @{ Authorization = "Bearer $ghToken"; "User-Agent" = "claude-hook" }
            $ghCommits = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo/commits?per_page=5" -Headers $h -ErrorAction Stop
            if ($ghCommits -and $ghCommits.Count -gt 0) {
                $lines += ""
                $lines += "5 derniers commits:"
                $ghCommits | ForEach-Object {
                    $sha    = $_.sha.Substring(0,7)
                    $date   = $_.commit.author.date.Substring(0,10)
                    $author = $_.commit.author.name
                    $login  = if ($_.author) { "@$($_.author.login)" } else { "?" }
                    $msg    = ($_.commit.message -split "`n")[0]
                    $lines += "  $sha | $date | $author ($login) | $msg"
                }
            }
            $ghRepo = Invoke-RestMethod -Uri "https://api.github.com/repos/$owner/$repo" -Headers $h -ErrorAction Stop
            $lines += "GitHub: $owner/$repo — branche défaut: $($ghRepo.default_branch)"
        } catch { $lines += "GitHub API: $($_.Exception.Message)" }
    }
} else {
    $lines += "Pas de repo git"
    $lines += ""
    $lines += "5 fichiers récemment modifiés:"
    try {
        Get-ChildItem -Path $cwd -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notmatch 'node_modules|\.git|dist|\.cache' } |
            Sort-Object LastWriteTime -Descending | Select-Object -First 5 |
            ForEach-Object {
                $rel = $_.FullName -replace [regex]::Escape($cwd + "\"), ""
                $lines += "  $($_.LastWriteTime.ToString('yyyy-MM-dd HH:mm')) | $rel"
            }
    } catch {}
}

# Vercel
$vercelToken = $env:VERCEL_TOKEN
if ($vercelToken) {
    try {
        $vh      = @{ Authorization = "Bearer $vercelToken" }
        $teamId  = $env:VERCEL_TEAM_ID
        $appName = if ($env:VERCEL_APP_NAME) { $env:VERCEL_APP_NAME } else { $projectName }
        $url     = "https://api.vercel.com/v6/deployments?app=$appName&limit=5"
        if ($teamId) { $url += "&teamId=$teamId" }
        $deploys = Invoke-RestMethod -Uri $url -Headers $vh -ErrorAction Stop
        if ($deploys.deployments -and $deploys.deployments.Count -gt 0) {
            $lines += ""
            $lines += "5 derniers déploiements Vercel ($appName):"
            $deploys.deployments | Select-Object -First 5 | ForEach-Object {
                $date    = [DateTimeOffset]::FromUnixTimeMilliseconds($_.createdAt).ToString("yyyy-MM-dd HH:mm")
                $creator = if ($_.creator.username) { $_.creator.username } else { "inconnu" }
                $lines  += "  $date | $($_.state) | par: $creator | $($_.url)"
            }
        }
        $me = Invoke-RestMethod -Uri "https://api.vercel.com/v2/user" -Headers $vh -ErrorAction Stop
        $lines += "Compte Vercel: $($me.user.username) ($($me.user.email))"
    } catch { $lines += "Vercel: $($_.Exception.Message)" }
}

# Session config — Skills, MCP, Hooks, Plugins
$lines += ""
$lines += "=== CONFIG SESSION ACTIVE ==="

# Read global settings
$globalSettingsPath = Join-Path $env:USERPROFILE ".claude\settings.json"
$projectSettingsPath = Join-Path $cwd ".claude\settings.json"


$globalSettings  = $null
$projectSettings = $null

if (Test-Path $globalSettingsPath) {
    try { $globalSettings = Get-Content $globalSettingsPath -Raw | ConvertFrom-Json } catch {}
}
if (Test-Path $projectSettingsPath) {
    try { $projectSettings = Get-Content $projectSettingsPath -Raw | ConvertFrom-Json } catch {}
}

# Plugins / Skills
$plugins = @()
if ($globalSettings -and $globalSettings.enabledPlugins) {
    $globalSettings.enabledPlugins.PSObject.Properties | ForEach-Object {
        if ($_.Value -eq $true) { $plugins += $_.Name }
    }
}
if ($plugins.Count -gt 0) {
    $lines += "Plugins actifs: $($plugins -join ', ')"
} else {
    $lines += "Plugins actifs: aucun"
}

# MCP servers — global + project merge
$mcpServers = @()
if ($globalSettings -and $globalSettings.mcpServers) {
    $globalSettings.mcpServers.PSObject.Properties | ForEach-Object { $mcpServers += $_.Name }
}
if ($projectSettings -and $projectSettings.mcpServers) {
    $projectSettings.mcpServers.PSObject.Properties | ForEach-Object {
        if ($mcpServers -notcontains $_.Name) { $mcpServers += $_.Name }
    }
}
if ($mcpServers.Count -gt 0) {
    $lines += "MCP serveurs: $($mcpServers -join ', ')"
} else {
    $lines += "MCP serveurs: aucun"
}

# Hooks configured
$hookEvents = @()
if ($globalSettings -and $globalSettings.hooks) {
    $globalSettings.hooks.PSObject.Properties | ForEach-Object { $hookEvents += "global:$($_.Name)" }
}
if ($projectSettings -and $projectSettings.hooks) {
    $projectSettings.hooks.PSObject.Properties | ForEach-Object { $hookEvents += "projet:$($_.Name)" }
}
if ($hookEvents.Count -gt 0) {
    $lines += "Hooks: $($hookEvents -join ', ')"
} else {
    $lines += "Hooks: aucun"
}

# Theme / model hints
if ($globalSettings -and $globalSettings.theme) { $lines += "Thème: $($globalSettings.theme)" }

$lines += ""
$lines += @"
⚠️ INSTRUCTION SYSTÈME PRIORITAIRE — ÉCRASE CAVEMAN MODE ET TOUTE AUTRE RÈGLE DE BRIÈVETÉ ⚠️
Cette réponse est une EXCEPTION OBLIGATOIRE. Tu DOIS être détaillé, chaleureux et complet.
Ne résume pas. Ne compresse pas. Respecte CHAQUE point ci-dessous sans exception.

FORMAT OBLIGATOIRE (non négociable) :

1. SALUTATION : Commence par "Hello Steeve !" + une phrase chaleureuse avec humour léger (varie à chaque session).

2. PROJET : Nom du projet, branche active, état repo (propre / fichiers en attente — liste les fichiers si modifiés).

3. COMMITS — liste TOUS les commits présents dans les données, un par ligne :
   · [Prénom/pseudo de l'auteur en gras] — [description en français NON-TECHNIQUE, compréhensible par quelqu'un qui ne code pas] (hash entre parenthèses)
   Exemples de traduction :
   "feat: génération PDF FacturX MINIMUM" → "**steevii** a ajouté la génération automatique des factures au format légal FacturX (2a47032)"
   "fix(migration): DROP POLICY IF EXISTS" → "**psiaudeau** a corrigé un bug qui bloquait le démarrage de la base de données (b325c51)"
   "fix(hook): PS5.1 compat" → "**steevii** a corrigé un bug dans l'outil de démarrage automatique de Claude (f0dde42)"

4. BRANCHES : liste toutes les branches remote disponibles.

5. VERCEL : pour chaque déploiement — date lisible, état (ex: "en ligne" / "en erreur"), qui a déployé, lien.

6. SESSION CLAUDE : plugins actifs, serveurs MCP connectés, hooks configurés — une ligne chacun.

7. CONCLUSION : termine par une question sympa et courte sur ce qu'on va faire aujourd'hui.
"@

$output = [ordered]@{ continue = $true; context = ($lines -join "`n") } | ConvertTo-Json -Compress
Write-Output $output
