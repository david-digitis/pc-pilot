# PC-Pilot — Contrôlez votre PC depuis Gladys

Salut à tous !

J'ai développé un petit outil pour contrôler un PC Windows ou Linux directement depuis les scènes Gladys : **PC-Pilot**.

Il tourne en tray icon sur votre PC et expose une API REST locale que Gladys peut appeler via des requêtes HTTP.

## Qu'est-ce que ça fait ?

- **Éteindre**, **redémarrer**, **mettre en veille**, **hiberner** ou **verrouiller** votre PC
- **Lancer ou arrêter des applications** (Firefox, VLC, etc.)
- **Exécuter des commandes personnalisées** (scripts de backup, etc.)

## Comment ça marche

1. Installez PC-Pilot sur le PC à contrôler
2. Ajoutez l'IP de votre Gladys dans les IPs autorisées (depuis le menu tray, pas besoin d'éditer de fichier)
3. Copiez le token API depuis le menu tray
4. Créez une scène Gladys avec une action requête HTTP

Exemple pour verrouiller votre PC :

| Champ | Valeur |
| ----- | ------ |
| Méthode | `POST` |
| URL | `http://<ip-du-pc>:7042/api/v1/system/lock` |
| Header | `Authorization` = `Bearer <votre-token>` |
| Header | `Content-Type` = `application/json` |
| Body | `{}` |

> N'oubliez pas le `{}` dans le body — Gladys l'exige même quand l'API n'en a pas besoin.

## Cas d'usage

- "Éteins le PC" par commande vocale
- Verrouiller le PC quand on quitte la maison
- Lancer une application en arrivant chez soi
- Lancer un backup sur planning

## Sécurité

Tout reste sur votre réseau local. Authentification par token, whitelist IP, rate limiting, aucune injection shell possible.

## Liens

- **GitHub** : https://github.com/david-digitis/pc-pilot
- **Téléchargement (Windows)** : https://github.com/david-digitis/pc-pilot/releases

Vos retours sont les bienvenus !
