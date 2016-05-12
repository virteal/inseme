# inseme - http://inseme.kudocracy.com

## Votes temps réel pour assemblées, façon NuitDebout

Inseme vise à faciliter l'accès aux assemblées organisées selon la façon NuitDebout. D'une part à titre de formation en familiarisant les participants avec la gestuelle à utiliser pour s'exprimer. D'autre part à titre opérationnel en permettant de participer à distance.

Pour participer à une assemblée à distance, deux conditions sont requises.
1 disposer de l'adresse d'un flux video "live" (ou audio).
2 s'organiser avec un modérateur "relai" sur place qui tiendra compte des interventions par Internet et les communiquera aux participants présents "en personne".


## Mode d'emploi

1/ se connecter

2/ choisir ou créer une assemblée

3/ chatter en regardant la video live et clicker pour se manifester

## Modérateurs

Pour l'instant, n'importe qui peut faire de la modération. Pour se déclarer modérateur, taper "inseme modérateur". Pour désigner un modérateur, "inseme modérateur son_nom".

Pour changer la question posée à l'assemblée, taper "inseme ? xxxx", éventuellement précédé de "inseme !" pour d'abord remettre tous les compteurs à zéro.

Pour changer la vidéo/audio partagée, taper "inseme live adresse-du-live".

Pour simplement fournir un lien, taper "inseme live in adresse-du-live".

Pour changer l'image partagée affichée en bas, taper "inseme adresse-de-l-image".

Pour changer le fil twitter partagé affiché en bas, taper "inseme twitter nom".

Pour afficher un pad collaboratif, taper "inseme pad un_message".


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

Diverses sources de "live" sont possibles dont celles de periscope, youtube, facebook, bambuser.com (video) et mixlr.com (radio).

Exemple :

- inseme live https://www.periscope.tv/w/1ynJOmElDalKR
- inseme live https://www.facebook.com/lenouvelobservateur/videos/10156868107940037/
- inseme live https://embed.bambuser.com/broadcast/6209824
- inseme live http://mixlr.com/radiodebout/
- inseme live in http://nuitdebout.fr
- inseme live https://meet.jit.si/inseme

Dans l'avant dernier exemple, "inseme live in", seul un lien vers la source spécifiée est affiché. Dans le dernier exemple, meet.jit.si, c'est une video conférence.  

## Aider

### Periscope

Sur PC, le live periscope est en léger différé, de sorte que la participation n'est praticable qu'à condition d'utiliser periscope sur son mobile en même temps que Inseme sur son PC.

Sur mobile, le live periscope n'est visible que depuis l'application periscope et du coup l'application web Inseme n'est plus à l'écran, de sorte qu'il faut 2 mobiles, l'un pour périscope, l'autre pour Inseme.

### Google Hangout

Quand on ne fait pas partie de la conférence, on peut cependant voir ce qui s'y dit. Pour cela, un des participants à la conférence doit publier le lien vers le live. Ce lien est accessible dans la fenêtre Hangout, en bas à droite. 

Il y a un décalage temporel entre ce live et la réalité, de l'ordre de 10 secondes, j'étudie comment l'éviter.

### jit.si

Cet outil permet de créer des video conférences. Tapez "inseme live https://meet.jit.si/inseme" (remplacer "inseme", typiquement par le nom de l'assemblée).

### Misc

Pour mieux former les participants à la gestuelle d'intervention j'aimerai avoir des images animées pour chaque geste.


## Roadmap

Injection des messages dans une chat-room Rocket.chat

Renforcer la modération dans la mesure du nécessaire

Transfer des délégations à l'occasion d'un 'bye'

Meilleure gestion des participants qui sont partis

Pour faire des suggestions, merci de me contacter via github et/ou d'écrire dans le 'pad'.


## Historique 2016

-  9 avril, version initiale, juste des chats, https://inseme.firebaseapp.com
- 10 avril, ajout d'un pad et des vidéos live de "nuitdebout"
- 11 avril, ajout de boutons pour chaque signe + photo d'aide
- 12 avril, affichage temps réel des résultats
- 13 avril, délégations façon "démocratie liquide"
- 14 avril, filtre anti bruit, live facebook, tweets de @ReportersDebout
- 15 avril, intégration des radios mixlr, video live periscope
- 16 avril, "inseme live in adresse-du-live" pour n'afficher qu'un lien
- 17 avril, comptage des accords et affichage en temps réel du résultat
- 21 avril, icones associés à la gestuelle, boutton 'AIDE'
- 22 avril, connexion facebook ou github + déconnexion, traduction
- 23 avril, connexion google, intégration de Google Hangout
- 24 avril, section 'aide' dans la page, profils sociaux, anonymes
- 25 avril, affichage de l'agenda NuitDebout
- 26 avril, 'inseme agenda nom_ou_adresse' pour changer d'agenda
- 27 avril, 'inseme modérateur' pour devenir modérateur
-  5 mai, 'inseme pad un_titre' pour afficher un pad collaboratif
- 12 mai, 'inseme pad https:xxx' pour utiliser un pad externe, dont framapad


## Aspects techniques

Le contenu du répertoire /public est directement hébergé par firebase.com sur 
lequel il est déployé au moyen de la commande "firebase deploy".

L'application est basée sur l'exemple de chat fourni par firebase. 
Certains messages, débutant par "inseme", sont ensuite interprétés de façon particulière. 
Aucun code ne tourne coté serveur, chaque client est autonome et les clients
se synchronisent via les messages spéciaux échangés via le chat.


## Auteur

Ce logiciel open source est écrit par Jean Hugues Robert.

On peut me joindre par mail jean_hugues_robert@yahoo.com, via twitter jhr et sur skype jeanhuguesrobert.

Pour être informé des nouveautés concernant Inseme, le plus simple est de s'abonner au compte twitter Kudocracy. Il y a aussi une page facebook Iseme.

## License

Open source, sur github. Faites en ce que vous voulez !
