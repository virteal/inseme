# inseme - https://inseme.firebaseapp.com
Votes temps réel pour assemblées, façon NuitDebout et #democratieliquide

Inseme vise à faciliter l'accès aux assemblées organisées selon la façon NuitDebout. D'une part à titre de formation en familiarisant les participants avec la gestuelle à utiliser pour s'exprimer. D'autre part à titre opérationnel en permettant de participer à distance.

Pour participer à une assemblée à distance, deux conditions sont requises.
1 disposer de l'adresse d'un flux video "live" (ou audio).
2 s'organiser avec un modérateur "relai" sur place qui tiendra compte des interventions par Internet et les communiquera aux participants présents "en personne".


## Mode d'emploi

1/ se connecter via twitter

2/ choisir ou créer une "room", cad dire une assemblée

3/ chatter en regardant la video live et clicker pour se manifester

Pour changer la question posée à l'assemblée, taper "inseme ? xxxx", 
éventuellement précédé de "inseme ?" pour d'abord remettre tous les compteurs à zéro.

Pour changer la vidéo/audio, taper "inseme live addresse-du-live".
Pour enlever/remettre la vidéo, taper "inseme live off" ou "inseme live on".
Pour changer l'image affichée en bas, taper "inseme image http://xxxx" ou bien "inseme http://xxxx"

Explications au sujet des gestes pour se manifester : http://www.slate.fr/story/116483/mains-nuit-debout-signes


## Démocratie Liquide

La démocratie liquide est une solution pour pratiquer la démocratie directe à grande échelle.

Elle permet de se partager le travail en automatisant une partie du vote.

Une forme simple d'automatisation consiste à copier les votes de quelqu'un en qui on a confiance.

S'agissant d'assemblées "temps réel", il peut ainsi être utile de designer la personne dont on copie le vote quand on s'absente de l'assemblée.

Pour cela, deux possibilités. 

1/ Envoyer 'inseme bye martin' pour signaler qu'on part et qu'on fait confiance à martin.
Quand martin exprimera son avis au sujet d'une proposition, le logiciel indiquera que vous copiez cet avis.

2/ Envoyer 'inseme pas d'accord => jacques,pierre" pour signaler votre avis et le fait que jacques et pierre vous font confiance.
Chaque fois que vous exprimerez votre avis au sujet d'une proposition, le logiciel indiquera que jacques et pierre vous font confiance et vous copient.

A noter : dès que la personne revient et s'exprime, le logiciel cesse les copies de votes la concernant, elle s'exprime donc désormais de nouveau directement et non plus via un représentant.


## Live

Les sources de "live" supportées sont celles venant de facebook, bambuser.com (video) et mixlr.com (radio). Les sources Periscope posent problème car Twitter interdit de les intégrer à une page existante, il faut se rendre sur le site de periscope.
Pour les autres sources, un lien est affiché, il permet d'ouvrir le flux dans une nouvelle fenêtre.

Exemple :
  inseme live https://www.facebook.com/lenouvelobservateur/videos/10156868107940037/
  inseme live https://embed.bambuser.com/broadcast/6209824
  inseme live http://mixlr.com/radiodebout/
  

## Roadmap

Migration vers inseme.kudocracy.com

Transfer des délégations à l'occasion d'un 'bye'

Intégrer d'autres sources de vidéo "live"

Intégrer des systèmes de video conférence

Intégrer des système de chat, Rocket.chat typiquement

S'intégrer dans des systèmes de chat, via un "chat bot" (robot)

Pour faire des suggestions, merci de me contacter via github et/ou d'écrire dans le 'pad'.


## Historique

9 avril 2016, version initiale, juste des chats, https://inseme.firebaseapp.com

10 avril 2016, ajout d'un pad et des vidéos live de "nuitdebout"

11 avril 2016, ajout de boutons pour chaque signe + photo d'aide

12 avril 2016, affichage temps réel des résultats

13 avril 2016, délégations façon "démocratie liquide"

14 avril 2016, filtre anti bruit, live facebook, tweets de @ReportersDebout

15 avril 2016, intégration des radios mixlr

## Aspects techniques

Le contenu du répertoire /public est directement hébergé par firebase.com sur 
lequel il est déployé au moyen de la commande "firebase deploy".

L'application est basée sur l'exemple de chat fourni par firebase. 
Certains messages, débutant par "inseme", sont ensuite interprétés de façon particulière. 
Aucun code ne tourne coté serveur, chaque client est autonome et les clients
se synchronisent via les messages spéciaux échangés avec le chat.

## Aider

Un proxy https/http me permettrait peut-être d'embarquer les videos periscope dans la page, pour l'instant ce n'est pas possible. Si vous avez ça sur un de vos serveurs... merci.

Pour former les participants à la gestuelle d'intervention j'aimerai avoir des icones pour chaque geste. S'ils sont en plus animés, c'est le top.

J'ignore si c'est possible, mais si ça l'est, ce serait sympa que quelqu'un présente Inseme à l'occasion du hackathon chez numa ce vendredi 15 avril.

## License

Open source. Faites en ce que vous voulez !
