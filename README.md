# inseme
Votes temps réel pour assemblées, façon NuitDebout

http://www.slate.fr/story/116483/mains-nuit-debout-signes

## Mode d'emploi

1/ se connecter via twitter

2/ choisir ou créer une "room", cad dire une assemblée

3/ chatter en regardant la video

Pour changer l'image affichée en bas, taper "inseme image http://xxxx" ou bien "inseme http://xxxx"

## Roadmap

"inseme video xxxx" pour changer la video partagée par les participants.

"inseme ? xxxx" pour désigner la proposition en cours de discussion.

"inseme ?" pour partager le score instantané de la dite proposition.

Affichage de statistiques temps réel sur les "gestes" pour compter qui fait quoi.

"inseme bye xxxx" pour que xxxx vote en votre absence (démocratie liquide).


## Historique

9 avril 2016, version initiale, juste des chats, https://inseme.firebaseapp.com

10 avril 2016, ajout d'un pad et des vidéos live de "nuitdebout"

11 avril 2016, ajout de boutons pour chaque signe + photo d'aide

12 avril 2016, "inseme http://xxxxx" pour partager une image ou un site

## Aspects techniques

Le contenu du répertoire /public est directement hébergé par firebase.com sur lequel il est déployé au moyen de la commande "firebase deploy".

L'application est basée sur l'exemple de chat fourni par firebase. Certains messages, débutant par "inseme" sont ensuite interprétés de façon particulière.

## License

Open source. Faites en ce que vous voulez !
