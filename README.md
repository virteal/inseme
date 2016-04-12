# inseme - https://inseme.firebaseapp.com
Votes temps réel pour assemblées, façon NuitDebout

http://www.slate.fr/story/116483/mains-nuit-debout-signes

## Mode d'emploi

1/ se connecter via twitter

2/ choisir ou créer une "room", cad dire une assemblée

3/ chatter en regardant la video et clicker pour se manifester

Pour changer la question posée à l'assemblée, taper "inseme ? xxxx", 
éventuellement précédé de "inseme ?" pour d'abord remettre tous les compteurs à zéro.

Pour changer l'image affichée en bas, taper "inseme image http://xxxx" ou bien "inseme http://xxxx"

Pour enlever/remettre la vidéo, taper "inseme video off" ou "inseme video on".
Pour changer la vidéo, taper "inseme video address-de-la-video" (seulement bambuser pour l'instant, periscope bientôt).

## Roadmap

"inseme video xxxx" pour changer la video partagée par les participants (periscope)

"inseme bye xxxx" pour que xxxx vote en votre absence (démocratie liquide).

Pour faire des suggestions, merci de me contacter et/ou d'écrire dans le 'pad' accessible via un lien en bas de page.


## Historique

9 avril 2016, version initiale, juste des chats, https://inseme.firebaseapp.com

10 avril 2016, ajout d'un pad et des vidéos live de "nuitdebout"

11 avril 2016, ajout de boutons pour chaque signe + photo d'aide

12 avril 2016, affichage temps réel des résultats

## Aspects techniques

Le contenu du répertoire /public est directement hébergé par firebase.com sur 
lequel il est déployé au moyen de la commande "firebase deploy".

L'application est basée sur l'exemple de chat fourni par firebase. 
Certains messages, débutant par "inseme" sont ensuite interprétés de façon particulière. 
Aucun code ne tourne coté serveur, chaque client est autonome et les clients
se synchronisent via les messages spéciaux échangés avec le chat.

## License

Open source. Faites en ce que vous voulez !
