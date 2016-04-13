# inseme - https://inseme.firebaseapp.com
Votes temps réel pour assemblées, façon NuitDebout & #democratieliquide

## Mode d'emploi

1/ se connecter via twitter

2/ choisir ou créer une "room", cad dire une assemblée

3/ chatter en regardant la video live et clicker pour se manifester

Pour changer la question posée à l'assemblée, taper "inseme ? xxxx", 
éventuellement précédé de "inseme ?" pour d'abord remettre tous les compteurs à zéro.

Pour changer la vidéo, taper "inseme live addresse-de-la-video".
Pour enlever/remettre la vidéo, taper "inseme live off" ou "inseme live on".
Pour changer l'image affichée en bas, taper "inseme image http://xxxx" ou bien "inseme http://xxxx"

Explications au sujet des gestes pour se manifester : http://www.slate.fr/story/116483/mains-nuit-debout-signes

## Démocratie Liquide

La démocratie liquide est une solution pour pratiquer la démocratie directe à grande échelle.
Elle permet de se partager le travail en automatisant une partie du vote.

Une forme simple d'automatisation consiste à copier le vote de quelqu'un en qui on a confiance.

S'agissant d'assemblée "temps réel", il peut ainsi être utile de designer la personne dont on copie le vote quand on s'absente de l'assemblée.

Pour cela, deux possibilités. 

1/ Envoyer 'inseme bye martin' pour signaler qu'on part et qu'on fait confiance à martin.
Quand martin exprimera son avis au sujet d'une proposition, le logiciel indiquera que vous copiez cet avis.

2/ Envoyer 'inseme pas d'accord => jacques,pierre" pour signaler votre avis et le fait que jacques et pierre vous font confiance.
Chaque fois que vous exprimerez votre avis au sujet d'une proposition, le logiciel indiquera que jacques et pierre vous font confiance et vous copient.

A noter : dès que la personne revient et s'exprime, le logiciel cesse les copies de vote la concernant, elle s'exprime donc désormais directement et non plus via un représentant.

## Roadmap

Intégrer la radio mixlr en live

Transfer des déléguations à l'occasion d'un 'bye'

Intégrer d'autres sources de vidéo "live"

Intégrer des systèmes de video conférence

Intégrer des système de chat

S'intégrer dans des systèmes de chat, via un "chat bot" (robot)

Pour faire des suggestions, merci de me contacter et/ou d'écrire dans le 'pad' accessible via un lien en bas de page.


## Historique

9 avril 2016, version initiale, juste des chats, https://inseme.firebaseapp.com

10 avril 2016, ajout d'un pad et des vidéos live de "nuitdebout"

11 avril 2016, ajout de boutons pour chaque signe + photo d'aide

12 avril 2016, affichage temps réel des résultats

13 avril 2016, délégations façon "démocratie liquide"

## Aspects techniques

Le contenu du répertoire /public est directement hébergé par firebase.com sur 
lequel il est déployé au moyen de la commande "firebase deploy".

L'application est basée sur l'exemple de chat fourni par firebase. 
Certains messages, débutant par "inseme", sont ensuite interprétés de façon particulière. 
Aucun code ne tourne coté serveur, chaque client est autonome et les clients
se synchronisent via les messages spéciaux échangés avec le chat.

## License

Open source. Faites en ce que vous voulez !
