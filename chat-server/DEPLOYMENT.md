# Déploiement du chat-server (gratuit, sans carte bancaire)

## ⭐ Recommandé : **Render** (le plus simple)

Render offre 750h/mois gratuites sans carte bancaire. Le service "s'endort" après 15 min d'inactivité (premier message à 30s pour réveiller — acceptable pour un MVP).

### 1. Préparer le repo Git

```bash
# À la racine de votre projet
cd C:\Users\omara\tawassol\chat-server
git init
git add .
git commit -m "chat-server initial"

# Créez un repo "tswal-chat" sur github.com (vide), puis :
git remote add origin https://github.com/<votre-user>/tswal-chat.git
git branch -M main
git push -u origin main
```

> Note : `node_modules/` et `.env` sont déjà ignorés par `.gitignore` ✓

### 2. Créer le service sur Render

1. Allez sur [render.com](https://render.com) → **Sign up** (avec GitHub, gratuit)
2. Dashboard → **New +** → **Web Service**
3. Connectez votre repo `tswal-chat`
4. Configurez :
   - **Name** : `tswal-chat`
   - **Region** : `Frankfurt` (proche Algérie)
   - **Branch** : `main`
   - **Runtime** : `Node`
   - **Build Command** : `npm install`
   - **Start Command** : `npm start`
   - **Instance Type** : **Free**

5. **Environment Variables** (cliquer Add) :
    ```
    MONGODB_URI = mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority
    ALLOWED_ORIGINS = https://votre-app.vercel.app,http://localhost:3000
    FIREBASE_PROJECT_ID = <your-firebase-project-id>
    FIREBASE_CLIENT_EMAIL = <your-firebase-admin-email>
    FIREBASE_PRIVATE_KEY = <your-firebase-private-key>
    ```
    *Note : Render fournit automatiquement `PORT` — ne le définissez pas.*
    *⚠️ Utilisez un mot de passe MongoDB fort — jamais de mots de passe simples comme "admin".*

6. Cliquez **Create Web Service**

Attendez ~3 minutes. Render vous donnera une URL du type :
**`https://tswal-chat.onrender.com`**

### 3. Configurer le frontend

Dans Vercel (ou en local pour tester) → **Environment Variables** :
```
NEXT_PUBLIC_CHAT_SERVER_URL=https://tswal-chat.onrender.com
```

Redéployez le frontend → ça marche.

### 4. Ouvrir MongoDB Atlas au monde

Comme Render n'a pas d'IP fixe, autorisez `0.0.0.0/0` dans Atlas :
- **MongoDB Atlas** → **Network Access** → **Add IP Address** → **Allow Access from Anywhere**

⚠️ Compensez avec une **DB password forte** (changez `admin` par un mot de passe complexe).

---

## Alternative : **Railway**

Railway donne **5 $ de crédit gratuit/mois** sans carte (équiv. ~500h pour un petit service).

1. [railway.app](https://railway.app) → **Login** (GitHub, gratuit)
2. **New Project** → **Deploy from GitHub repo** → choisir `tswal-chat`
3. **Variables** (icône d'engrenage) :
   ```
   MONGODB_URI = …
   ALLOWED_ORIGINS = …
   ```
4. **Settings** → **Generate Domain** → vous obtenez `tswal-chat.up.railway.app`

Avantage Railway : **pas de mise en veille** (toujours actif). Inconvénient : crédit qui s'épuise si trafic intense.

---

## Vérification rapide

Une fois déployé, testez l'URL `/health` :
```
curl https://tswal-chat.onrender.com/health
{ "ok": true, "mongo": "connected", "uptime": 123.4 }
```

Si vous voyez `mongo: "connected"`, tout est bon.

---

## Tableau récapitulatif

| Critère                  | Render Free            | Railway Free          |
|--------------------------|------------------------|----------------------|
| Carte bancaire requise   | ❌ Non                 | ❌ Non               |
| Heures gratuites/mois    | 750h                   | 500h (5 $ crédit)     |
| Mise en veille (idle)    | Oui (après 15 min)     | Non                  |
| Latence de réveil        | ~30s (premier message) | 0                    |
| Verdict                  | ⭐ MVP / dev           | ⭐ Production légère  |

Pour TSSWAL en phase de test → **Render**. Pour la production scolaire active → **Railway**.
