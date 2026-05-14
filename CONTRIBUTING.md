# Guide de contribution — TrustBuild IA

## Équipe

| Membre | GitHub | Branche |
|--------|--------|---------|
| Pierre | @PFS-StudioTechs | `dev/pierre` |
| Steeve | @steevii | `dev/steevii` |
| FC | @fc-excellence-consulting | `dev/fc-excellence` |

## Structure des branches

```
main          ← production (protégée — PR obligatoire)
  ↑
develop       ← intégration commune (protégée — PR obligatoire)
  ↑     ↑     ↑
dev/  dev/  dev/
pierre steevii fc-excellence
```

## Workflow quotidien

### 1. Commencer une session de travail

Toujours partir de sa branche à jour :

```bash
git checkout dev/pierre          # ta branche
git pull origin develop          # récupérer les dernières modifications
```

### 2. Travailler et commiter

```bash
git add .
git commit -m "feat: description courte de ce que tu as fait"
git push
```

### Conventions de messages de commit

| Préfixe | Usage |
|---------|-------|
| `feat:` | Nouvelle fonctionnalité |
| `fix:` | Correction de bug |
| `style:` | Changement visuel/CSS |
| `refactor:` | Refactoring sans nouvelle feature |
| `docs:` | Documentation |
| `chore:` | Config, dépendances |

### 3. Merger vers develop

Quand une feature est prête :
1. Va sur GitHub → **Pull Requests** → **New pull request**
2. Base : `develop` ← Compare : `dev/ta-branche`
3. Assigne un autre membre pour la review
4. Merge après validation

### 4. Mise en production

Seul `main` est déployé sur Vercel.
Le merge `develop` → `main` se fait en équipe, après validation collective.

## Règles importantes

- **Ne jamais commiter** `.env.local` (clés API)
- **Ne jamais pusher** directement sur `main` ou `develop`
- **Toujours passer par une PR** pour merger
- Tirer (`git pull`) avant de commencer à travailler

## Installation locale

```bash
# Cloner le repo
git clone https://github.com/PFS-StudioTechs/TrustBuild-ia-VScode.git
cd TrustBuild-ia-VScode

# Installer les dépendances
npm install

# Copier et remplir les variables d'environnement
cp .env.example .env.local
# → Renseigner les vraies valeurs dans .env.local

# Lancer en local
npm run dev
```
