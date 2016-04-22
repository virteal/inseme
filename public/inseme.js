// inseme.js
//
//  Realtime votes for assemblies, NuitDebout style
//
//  April 11th 2016 by @jhr

var de = true;
var bug  = console.log.bind( console );
var mand = function( p ){ if( !p ) throw new Error( "assert failed" ); };


var Inseme = {

  user_id: null,

  user_name: "",
  
  interval: null,
  countdown: 0,
  
  // All seen users, including current one
  users: {},
  
  // offline users that the current user vote on behalf of
  proxied_users: {},
  
  // inseme ? xxxx to set the currently discussed proposition
  proposition: "",
  proposition_timestamp: 0,

  votes: [],

  // Count hands, one counter per vote orientation
  results:{},

  is_https: false,
  
  rooms: {},
  rooms_by_id: {},
  
  // id of current room
  room_id: "",
  
  // name of current room
  room_name: "",
  
  config:{
    
    place: "Paris",
    
    url_help: "http://documentup.com/Virteal/inseme",
    
    firechat: null,
    maxLengthMessage: 1000,
    
    
    countdown: 30,

    choices:{
      
      //"inseme": {
      //  text: "inseme"
      //},
      
      "quiet": {
        text: "Silencieux"
      },
      
      "ok": {
        text: "D'accord",
        is_sticky: true,
        html: '<i class="inseme_sprite inseme_sprite-ok"></i>'
      },
      
      "no": {
        text: "Pas d'accord",
        is_sticky: true,
        html: '<i class="inseme_sprite inseme_sprite-no"></i>'
      },
      
      "block": {
        text: "Non radical",
        is_sticky: true,
        html: '<i class="inseme_sprite inseme_sprite-block"></i>'
      },
      
      "talk": {
        text: "Parole",
        html: '<i class="inseme_sprite inseme_sprite-talk"></i>'
      },
      
      "point": {
        text: "Point technique",
        html: '<i class="inseme_sprite inseme_sprite-point"></i>'
      },
      
      "volume": {
        text: "Plus fort",
        html: '<i class="inseme_sprite inseme_sprite-volume"></i>'
      },
      
      "repeat": {
        text: "Déja dit",
        html: '<i class="inseme_sprite inseme_sprite-repeat"></i>',
        ascii: "Deja dit",
        // html: "D&eacute;ja dit"
      },
      
      "silence": {
        text: "Silence",
        html: '<i class="inseme_sprite inseme_sprite-silence"></i>',
      },
      
      "help": {
        text: "Aide"
      }
    }
  },
    
  delta_clock: 0

};


Inseme.patch_firechat = function(){
  var templates = FirechatDefaultTemplates;
  for( var template_name in templates ){
    templates[ template_name ] 
    = Inseme.patch_i18n_template( template_name, templates[ template_name ] );
  }
};


Inseme.patch_i18n_template = function( name, html ){
  
  // Extract name from xxxx/name.xxx
  var idx_slash = name.lastIndexOf( "/" );
  if( idx_slash >= 0 ){
    name = name.substring( idx_slash + 1 );
  }
  var idx_dot = name.lastIndexOf( "." );
  if( idx_dot >= 0 ){
    name = name.substring( 0, idx_dot );
  }
  
  de&&bug( "Template i18n patch for", name );
  var r;
  
  // Decompile template
  var text = html.toString();
  
  r = text;
  
  function s( en, fr ){
    if( r.indexOf( en ) === -1 ){
      de&&bug( "Cannot translate in", name, "not found:", en );
      return;
    }
    r = r.replace( en, fr );
  }
  
  // ToDo: find where this is defined, not in a template apparently
  if( r.indexOf( "Create Public Room" ) > 0 ){
    de&&bug( "Message found in template", name );
  }
  
  if( name === "layout-full" ){
    s( "Chat Rooms", "Assembl&eacute;es" );
    s( "Create Room", "Cr&eacute;er une assembl&eacute;e" );
    s( "Visitors", "Participants" );
    s( 
      'Use "+ Invite" button within chat rooms for regular invites',
      'Utiliser "+ Inviter" pour les invitations normales'
    );
    s( "Next", "Suite" );
    
  }else if( name === "message-context-menu" ){
    s( "Warn User", "Pr&eacute;venir le participant" );
    s( "Kick User", "Faire sortir le participant" );
    s( "Suspend User (1 Hour)", "Suspendre le participant (1 heure)" );
    s( "Suspend User (1 Day)", "Suspendre le participant (1 jour)" );
    s( "Delete Message", "Effacer le message" );

  }else if( name === "message" ){
    s( "Invite to Private Chat", "Inviter dans un salon priv&eacute;" );
    s( "Mute User", "Filtrer le participant" );
    
  }else if( name === "prompt-alert" ){
    s( "Close", "Fermer" );
    
  }else if( name === "prompt-create-room" ){
    s( "Give your chat room a name:", "Donner un nom &agrave; votre assembl&eacute;e : " );
    s( "Room name...", "Nom..." );

  }else if( name === "prompt-invitation" ){
    s( "invited you to join", "Vous invite &agrave; vous joindre" );
    s( "Accept", "Accepter" );
    s( "Decline", "D&eacute;cliner" );

  }else if( name === "prompt-invite-private" ){
    s( "Invite", "Inviter" );
    s( " to ", " dans " );
    s( "Invite", "Inviter" );
    s( "Cancel", "Annuler" );
    
  }else if( name === "prompt-invite-reply" ){
    s( "accepted your invite", "a accept&eacute; votre invitation" );
    s( "declined your invite", "a d&eacute;clin&eacute; votre invitation" );
  
  
  }else if( name === "prompt-user-mute" ){
    s( "Mute", "Filtrer" );
    s( "Cancel", "Annuler" );
  
  }else if( name === "room-user-list-item" ){
    s( "Toggle User Mute", "Inverser le filtrage" );
    s( "Invite to Private Chat", "Inviter dans une salon priv&eacute" );

  }else if( name === "room-user-search-list-item" ){
    s( "Invite to Room", "Inviter &agrave; une assembl&eacute;e" );

  }else if( name === "tab-content" ){
    s( "In Room", "Pr&eacute;sents" );
    s( "Invite", "Inviter" );
    s( "Leave Room", "Quitter l\\'assembl&eacute;e" );
    s( "Your message:", "Votre message :" );
    s( "Type your message here...", "Tapez votre message ici..." );
    
  }else if( name === "user-search-list-item" ){
    s( "Invite to Private Chat", "Inviter dans un salon priv&eacute;" );
  
  }
  
  // Recompile if needed
  if( r !== text ){
    try{
      r = r.replace( "function (obj) {", "" );
      var idx_last_close_statement = r.lastIndexOf( "}" );
      r = r.substring( 0, idx_last_close_statement );
      r = new Function( "obj", r );
    }catch( err ){
      de&&bug( "i18n compile error for templace", name, err );
      debugger;
      r = html;
    }
  }else{
    r = html;
  }
  
  return r;
  
};


Inseme.init = function( config ){
  de&&bug( "Inseme.init(", config, ") called" );
  de&mand( config );
  Inseme.config.firechat = config.firechat;
  if( config.maxLengthMessage ){
    Inseme.config.maxLengthMessage = config.maxLengthMessage;
  }
  config.firechat.maxLengthMessage = Inseme.config.maxLengthMessage;
  Inseme.set_firechat_event_handlers();
  // Autodetect https access
  Inseme.is_https = ( 'https:' == document.location.protocol );
  return Inseme;
};


Inseme.close = function(){
  de&&bug( "Inseme.close() called" );
  return Inseme.logout();
};


Inseme.track_room = function( id, name, timestamp ){
// Remember/retrieve all seen rooms, even when some info is missing
  var room;
  if( !room && id ){
    room = Inseme.rooms_by_id[ id ];
  }
  if( !room && name ){
    room = Inseme.rooms[ name ];
  }
  if( id && !name && room ){
    name = room.name;
  }
  if( !id && name && room ){
    id = room.id;
  }
  if( !room ){
    de&&bug( "Tracking new room", id, name, timestamp );
    room = {
      id:   "",
      name: "",
      proposition: "",
      proposition_timestamp: 0,
      live: "",
      image: ""
    };
  }
  if( !room.proposition_timestamp && timestamp ){
    room.proposition_timestamp = timestamp;
  }
  if( name ){
    room.name = name;
    Inseme.rooms[ name ] = room;
  }
  if( id ){
    room.id = id;
    Inseme.rooms_by_id[ id ] = room;
  }
  return room;
};


Inseme.login = function( user_id, user_name, room_name ){
  de&&bug( "Inseme.login(" + user_id + ", " + user_name + ", " + room_name + ") called" );
  de&&mand( user_id );
  de&&mand( user_name );
  if( Inseme.user_id ){
    Inseme.logout();
  }
  Inseme.user_id = user_id;
  Inseme.user_name = user_name;
  // Enter specified room, if any
  var chatui_api = Inseme.config.firechat;
  var chat_api = Inseme.config.firechat._chat;
  // Scan all existing room
  chat_api.getRoomList( function( list ){
    de&&bug( list );
    for( var id in list ){
      var a_room = list[ id ];
      Inseme.track_room( a_room.id, a_room.name );
    }
    var found_room = room_name && Inseme.rooms[ room_name ];
    if( found_room ){
      de&&bug( "Entering room ", found_room.name, found_room.id );
      Inseme.set_current_room( found_room.id, found_room.name );
      if( chatui_api.$messages[ found_room.id ] ){
        chatui_api.focusTab( found_room.id );
      }else{
        chatui_api._chat.enterRoom( found_room.id, found_room.name );
      }
    }
    Inseme.change_vote();
    setTimeout( function(){
      Inseme.change_vote();
    }, 1000 );
  });
  Inseme.change_vote();
  return Inseme;
};


Inseme.logout = function(){
  de&&bug( "Inseme.logout() called" );
  if( !Inseme.user_id )return Inseme;
  Inseme.change_vote();
  Inseme.user_id = null;
  return Inseme;
};


Inseme.change_vote = function( vote ){
  
  if( !vote ){
    vote = "quiet";
  }
  
  de&&bug( "UI. Inseme.vote(" + vote + ") called" );
  
  // if( vote === Inseme.vote )return;
  
  var user = Inseme.users[ Inseme.user_name ];
  
  if( !user ){
    user = {};
    Inseme.users[ Inseme.user_name ] = user;
  }
  
  $("#inseme_proposition_vote").text( Inseme.config.choices[ vote ].text );
  var icon = Inseme.config.choices[ vote ].html;
  if( icon ){
   $("#inseme_proposition_vote").html(
     icon + $("#inseme_proposition_vote").html()
   );
  }
  if( vote === "quiet" ){
    $('#inseme_you').addClass( "hide" );
  }else{
    $('#inseme_you').removeClass( "hide" );
  }
  
  // Collect potential proxied users, => u1, u2, u3...
  var proxied_users = [];
  for( var u in Inseme.proxied_users ){
    proxied_users.push( u );
  }
  
  var room_id = Inseme.room_id;

  if( room_id ){
    de&&bug( "Send vote", room_id, vote );
    Inseme.config.firechat._chat.sendMessage( 
      room_id,
      "inseme " 
      + ( Inseme.config.choices[ vote ].text || vote )
      + ( proxied_users.length
        ? " => " + proxied_users.join( "," )
        : ""
      )
    );
  }
  return Inseme;
};


Inseme.set_current_room = function( id, name ){
  var previous_room_id = Inseme.room_id;
  var room = Inseme.track_room( id, name );
  if( !room ){
    de&&bug( "weird missing room in Inseme.set_current_room", id );
    debugger;
    return Inseme;
  }
  if( !room.id ){
    // This happens at starup only
    de&&bug( "missing id for room in Inseme.set_current_room", room );
    return Inseme;
  }
  Inseme.room_id = room.id;
  Inseme.room_name = room.name;
  if( Inseme.room_id !== previous_room_id ){
    // Adjust current live, image & proposition
    de&&bug( "Current room becomes", id, name, "was", previous_room_id );
    Inseme.set_live( room.id, room.live );
    Inseme.set_image( room.id, room.image );
  }
  return Inseme;
};


Inseme.set_firechat_event_handlers = function(){
  var chat = Inseme.config.firechat;
  // Monkey patch firechatui to track roomId
  var old = chat.focusTab;
  chat.focusTab = function( room_id ){
    Inseme.set_current_room( room_id );
    return old.apply( this, arguments );
  };
  // Hack to track currently shown tab/room
  $(document).delegate('[data-toggle="firechat-tab"]', 'click', function(event) {
    event.preventDefault();
    var tab_name = $(this).text();
    Inseme.set_current_room( null, tab_name );
  });
  chat.on( 'message-add',    Inseme.on_firechat_message_add );
  chat.on( 'message-remove', Inseme.on_firechat_message_remove );
  chat.on( 'room-enter',     Inseme.on_firechat_room_enter );
  chat.on( 'room-exit',      Inseme.on_firechat_room_exit );
};


Inseme.on_firechat_room_enter = function( room ){
  Inseme.set_current_room( room.id, room.name );
};


Inseme.on_firechat_room_exit = function( room_id ){
  // ToDo: deal with it
  de&&bug( "leave room", room_id );
};

Inseme.now = function(){
  return Date.now() + Inseme.delta_clock;
};


Inseme.on_firechat_message_add = function( room_id, message ){
  
  var age = Inseme.now() - message.timestamp;
  
  // If local clock is late compared server's one, adjust local one
  if( age < 0 ){
    Inseme.delta_clock -= age;
    age = 0;
  }
  
  Inseme.track_room( room_id, null, message.timestamp );
  
  // Skip old messages, 1 day
  // if( age > 24 * 60 * 60 * 1000 )return;
  
  var text = message.message;
  var user_name = message.name;
  
  if( user_name === Inseme.user_name ){
    Inseme.set_current_room( room_id );
  }
  
  // Skip not inseme related messages
  if( text.substring( 0, "inseme".length ).toLowerCase() !== "inseme" )return;
  
  // Remove some messages after a while to improve signal/noise
  var to_be_removed = true;
  setTimeout( 
    function(){
      if( !to_be_removed )return;
      // chat/room-messages/room_id/msg_id
      var msg_id = message.id;
      // var ref = "room_messages/" + room_id + "/" + msg_id;
      // var msg_ref = Inseme.chatRef.child( ref );
      // msg_ref.remove();
      Inseme.config.firechat.removeMessage( room_id, msg_id );
    },
    delay
  );
  
  // If not about a known room, ignore
  if( !Inseme.rooms_by_id[ room_id ] ){
    de&&bug( "Message in unkown room", room_id );
    return;
  }
  
  // Track which room the current user talks into
  if( user_name === Inseme.user_name ){
    Inseme.set_current_room( room_id );
  }
  
  // Never proxy a talking user
  delete Inseme.proxied_users[ user_name ];
  
  // Extract proxied users, if any
  var idx = text.indexOf( " => " );
  var proxied_users = null;
  if( idx > 0 ){
    proxied_users = text.substring( idx + " => ".length ).split( "," );
    text = text.substring( 0, idx );
  }
  
  // Look for vote orientation
  var vote = text.substr( "inseme ".length ) || "quiet";
  var cmd = vote;
  vote = vote.toLowerCase();
  var found = false;
  // Lookup canonical form
  if( !found ){
    found = Inseme.config.choices[ vote ];
  }
  if( !found ){
    Inseme.each_choice( function( c ){
      if( found )return;
      if( Inseme.config.choices[ c ].text.toLowerCase() !== vote ){
        if( !Inseme.config.choices[ c ].ascii
        ||   Inseme.config.choices[ c ].ascii.toLowerCase() !== vote
        ){
          return;
        }
      }
      vote = c;
      found = true;
    });
  }
  
  // Handle special actions
  var param = "";
  var token1;
  if( !found ){
    var isp = vote.indexOf( " " );
    if( isp >= 0 ){
      token1 = vote.substring( 0, isp );
      param = cmd.substring( isp + 1 );
    }else{
      token1 = vote;
      if( token1.substring( 0, 4 ) === "http" ){
        param = token1;
        token1 = "image";
      }
    }
    if( param || token1 === "?" ){
      
      if( token1 === "image" ){
        if( param === "help" ){
          param = "nuitdebout.png";
        }
        to_be_removed = false;
        Inseme.set_image( room_id, param, message.timestamp );
        
      }else if( token1 === "live" ){
        to_be_removed = false;
        Inseme.set_live( room_id, param, message.timestamp );
        
      }else if( token1 === "?" ){
        to_be_removed = false;
        Inseme.set_proposition( room_id, param, message.timestamp );
      
      }else if( token1 === "bye" ){
        to_be_removed = false;
        if( param === Inseme.user_name ){
          Inseme.proxied_users[ param ] = param;
        }
      }
      
    }
  }
  if( !found )return;
  
  de&&bug( 
    "Received vote", 
    vote, 
    "user", user_name,
    "room", room_id,
    "named", Inseme.rooms_by_id[ room_id ].name,
    "ago", Inseme.duration_label( Inseme.now() - message.timestamp )
  );
  Inseme.push_vote( room_id, user_name, vote, message.timestamp );
  
  if( proxied_users ){
    proxied_users.forEach( function( u ){
      Inseme.push_vote( room_id, u, vote, message.timestamp, user_name );
      // When current user acquire that other person's vote
      if( user_name === Inseme.user_name ){
        Inseme.proxied_users[ u ] = u;
      }
    });
  }
  
  var delay = (3 * 1000) - age;
  if( delay <= 0 || vote === "quiet" ){ delay = 1; }
  
  // Restore "quiet" after a while
  if( user_name === Inseme.user_name ){
    if( vote !== "quiet" ){
      if( delay > 1 ){
        Inseme.countdown = Inseme.config.countdown;
        if( !Inseme.interval ){
          Inseme.interval = setInterval(
            function(){
              if( --Inseme.countdown <= 0 ){
                clearInterval( Inseme.interval );
                Inseme.interval = null;
                $('#inseme_countdown').text( "" )
                .addClass( "hide" );
                Inseme.change_vote();
                Inseme.refresh_display();
              }else{
                $('#inseme_countdown')
                .text( Inseme.countdown )
                .removeClass( Inseme.countdown >  5 ? "red-text" : "grey-text" )
                .addClass(    Inseme.countdown <= 5 ? "red-text" : "grey-text" )
                .removeClass( "hide" );
              }
            },
            1000
          );
        }
      }
      
    }else{
      if( Inseme.interval ){
        clearInterval( Inseme.interval );
        Inseme.interval = null;
        $('#inseme_countdown').addClass( "hide" );
      }
    }
  }
  
};


Inseme.push_vote = function( room_id, user_name, vote, timestamp, proxy ){
  
  Inseme.votes.push( { 
    room_id: room_id,
    user: user_name,
    orientation: vote,
    timestamp: timestamp
  } );
  
  var user = Inseme.users[ user_name ];
  
  // Track all seen users, including current one
  if( !user ){
    user = {};
    Inseme.users[ user_name ] = user;
  }
  
  // Track proxied users of current user
  if( proxy === Inseme.user_name ){
    Inseme.proxied_users[ user_name ] = user_name;
  }
  
  var results = Inseme.results[ room_id ];
  if( !results ){
    results = Inseme.results[ room_id ] = {};
  }
  
  var votes = user.votes;
  if( !votes ){
    votes = user.votes = {};
  }
  var user_vote = votes[ room_id ];
  if( !user_vote ){
    user_vote = votes[ room_id ] = {};
  }
  
  // Remove previous vote
  var previous_vote = user_vote.state;
  if( previous_vote ){
    var old_result = results[ previous_vote ];
    if( !old_result ){
      old_result = { count: 1, who_first: null };
      results[ previous_vote ] = old_result;
    }
    old_result.count--;
    // If this was the first talker, find the other older one
    if( old_result.who_first === user_name ){
      old_result.who_first = null;
      if( old_result.count ){
        var found_first = null;
        var user_name2;
        for( user_name2 in Inseme.users ){
          var vote2 = Inseme.get_vote_of( room_id, user_name2 );
          if( user_name2 === user_name || vote2 !== previous_vote )continue;
          if( !found_first ){
            found_first = vote2;
            old_result.who_first = user_name2;
            continue;
          }
          if( vote2.timestamp < found_first.timestamp ){
            found_first = vote2;
            old_result.who_first = user_name2;
          }
        }
      }
    }
  }
  
  var previous_state = user_vote.state;
  var previous_via   = user_vote.via;
  
  user_vote.state = vote;
  if( Inseme.config.choices[ vote ].is_sticky ){
    user_vote.vote = vote;
    user_vote.timestamp = timestamp;
  }
  if( vote === "quiet" ){
    if( previous_state !== "quiet" || proxy !== previous_via ){
      user_vote.timestamp = timestamp;
    }
  }else{
    if( vote !== previous_state || proxy !== previous_via ){
      user_vote.timestamp = timestamp;
    }
  }
  if( !user_vote.timestamp ){
    user_vote.timestamp = timestamp;
  }

  user_vote.via = proxy;
  
  // Increase counter and track first talker
  var result = results[ vote ];
  if( !result ){
    result = { count: 0, who_first: null };
    results[ vote ] = result;
  }
  result.count++;
  if( result.count === 1 ){
    result.who_first = user_name;
  }
  
  Inseme.refresh_display();
 
};


Inseme.refresh_display = function(){
  if( !Inseme.interval_refresh_display ){
    Inseme.interval_refresh_display 
    = setInterval( Inseme.refresh_display, 1000 );
  }
  Inseme.display_short_results();
  Inseme.display_long_results();
};


Inseme.get_short_results = function(){
  var room_id = Inseme.room_id;
  var results = Inseme.results[ room_id ];
  if( !results ){
    results = Inseme.results[ room_id ] = {};
  }
  var msg = "";
  var orientation;
  var count;
  function twitter( n ){
    if( !n )return "";
    if( n[0] !== "@" )return n;
    return ""
    + '<a href="http://twitter.com/' + n.substring( 1 ) + '">' 
    + n
    + '</a>';
  }
  for( orientation in results ){
    count = results[ orientation ].count;
    if( !count )continue;
    var who_first = results[ orientation ].who_first;
    msg +=  " "
    + Inseme.config.choices[ orientation ].text
    + " " 
    + ( count === 1 
      ? ( ( who_first && twitter( who_first ) ) || count )
      : count )
    + ".";
  }
  return msg;
};


Inseme.display_short_results = function(){
  $("#inseme_proposition_results").html( Inseme.get_short_results() );
};


Inseme.date_label = function( timestamp ){
  var date = new Date( timestamp || Inseme.now() );
  var annee = date.getFullYear();
  var mois = date.getMonth();
  var mois_labels = [ 
    'Janvier', 'F&eacute;vrier', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet',
    'Ao&ucirc;t', 'Septembre', 'Octobre', 'Novembre', 'D&eacute;cembre'
  ];
  var j = date.getDate();
  var jour = date.getDay();
  var jours_labels = [ 
    'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'
  ];
  var h = date.getHours();
  if( h < 10 ){
    h = "0" + h;
  }
  var m = date.getMinutes();
  if( m < 10 ){
    m = "0" + m;
  }
  var s = date.getSeconds();
  if( s < 10 ){
    s = "0" + s;
  }
  return "" 
  + jours_labels[ jour ] 
  + ' ' + j 
  + ' ' + mois_labels[ mois ] 
  + ' ' + annee 
  + ' &agrave; ' + h + ':' + m + ':' + s;
};


Inseme.display_long_results = function(){
  
  var room = Inseme.rooms[ Inseme.room_name ];
  if( !room )return;
  
  var msg = "";
  
  var now = Inseme.now();
  var age = 0;
  if( room.proposition_timestamp ){
    age = now - room.proposition_timestamp;
  }
  msg += "Nous sommes " + Inseme.date_label( now ) + ".";
  
  msg += "<br>Dans l'assemblée '" + ( Inseme.room_name || "sans nom" ) + "'.";
  
  
  if( room.proposition ){
    msg += "<br>Sur la proposition \"" + room.proposition + "\"";
    msg += " faite " + Inseme.date_label( room.proposition_timestamp );
    msg += ", il y a " + Inseme.duration_label( age ) + ".";
  }else{
    msg += "<br>Sur la discussion en cours depuis "
    + Inseme.duration_label( age ) + ".";
  }
  
  msg += "<ul>";
  
  var sticky_votes = {};
  var list = [];
  for( var n in Inseme.users ){
    list.push( n );
  }
  list = list.sort();
  
  function twitter( n ){
    if( !n )return "";
    if( n[0] !== "@" )return n;
    return ""
    + '<a href="http://twitter.com/' + n.substring( 1 ) + '">' 
    + n
    + '</a>';
  }
  
  var room_id = Inseme.room_id;
  
  list.forEach( function( n ){
    var user;
    var votes;
    var vote;
    
    user = Inseme.users[ n ];
    votes = user.votes;
    if( !votes ){
      votes = user.votes = {};
    }
    vote = votes[ room_id ];
    if( !vote ){
      vote = votes[ room_id ] = {};
    }
    if( !vote.vote )return;
    
    msg += "<li>" + twitter( n ) + ", ";
    if( vote.vote && Inseme.config.choices[ vote.vote ].is_sticky ){
      if( !sticky_votes[ vote.vote ] ){
        sticky_votes[ vote.vote ] = 0;
      }
      sticky_votes[ vote.vote ]++;
      msg += Inseme.config.choices[ vote.vote ].text;
      if( vote.state !== vote.vote ){
        msg += ", puis " + Inseme.config.choices[ vote.state ].text;
      }
    }else{
       msg += Inseme.config.choices[ vote.state ].text;
    }
    msg += ""
    + ( vote.via 
      ? " (via " + twitter( vote.via ) + ")"
      : "" )
    + ", depuis " 
    + Inseme.duration_label( now - vote.timestamp )
    + ".</li>";
  });
  msg += "</ul>";
  
  var orientation;
  var orientations = [];
  for( orientation in sticky_votes ){
    orientations.push( orientation );
  }
  if( orientations.length ){
    msg += "<br>R&eacute;sultat : ";
    orientations.sort( function( a, b ){
      return sticky_votes[ b ] - sticky_votes[ a ];
    });
    msg += '<table class="inseme_results">';
    orientations.forEach( function( orientation ){
      msg += "<tr><td>" 
      + Inseme.config.choices[ orientation ].text
      + "</td><td>"
      + sticky_votes[ orientation ]
      + "</td></tr>";
    });
    msg += "</table>";
  }
  
  msg += Inseme.get_short_results();
  $('#inseme_vote_list').empty().append( msg );
  return Inseme;
};


Inseme.get_vote_of = function( room_id, user_name ){
  var user = Inseme.users[ user_name ];
  var votes = user.votes;
  if( !votes ){
    votes = user.votes = {};
  }
  var vote = votes[ room_id ];
  if( !vote ){
    vote = vote[ room_id ] = { vote: {} };
  }
  return vote && vote.vote;
};


Inseme.on_firechat_message_remove = function( room_id, message ){
  de&&bug( "Inseme.on_firechat_message_remove(", arguments, ") called" );
  de&&bug( "message", message );
};


Inseme.each_choice = function( f ){
  var all_choices = Inseme.config.choices;
  for( var c in all_choices ){
    f( c );
  }
};


Inseme.set_image = function( room_id, image_url, timestamp ){
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_image for unknow room", room_id );
    return;
  }
  
  room.image = image_url || "";
  
  // Don't change display if not about the current room
  if( room.id !== Inseme.room_id )return;

  $("#inseme_image_container").empty();
  if( image_url ){
    $("#inseme_image_container")
    .append( $( '<a>', { href: image_url } ) )
    .embedly();
  }
  
};


Inseme.set_live = function( room_id, url, timestamp ){
  
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_live for unknow room", room_id );
    return;
  }
  
  room.live = url || "";
  
  // Don't change display if not about the current room
  if( room.id !== Inseme.room_id )return;
  
  // remove extra spaces
  url = url.replace( /  /g, " " ).trim();
  
  // Empty url to remove all
  if( !url ){
    $("#inseme_live_container").addClass( "hide" ).empty();
    return;
  }
  
  // 'off' special case
  if( url === "off" ){
    $("#inseme_live_container").addClass( "hide" );
    return;
  }

  // 'on' special case
  if( url === "on" ){
    $("#inseme_live_container").removeClass( "hide" );
    return;
  }
  
  // 'broadcast' special case, using webRTC
  // See https://webrtc.ventures/2016/01/live-streaming-with-webrtc/
  if( url === "broadcast" ){
    // ToDo: implement sender side and receivers side
  }
  
  function use_link( url ){
    var html = '<a id="inseme_live_link" href="" target="_blank">Live</a>'; 
    $("#inseme_live_container").empty().append( html ).removeClass( "hide" );
    $("#inseme_live_link").attr( "href", url );
    $('html, body').animate({ scrollTop: 0 }, 0);
  }
  
  var needs_link = url.substring( 0, "in ".length ) === "in ";
  if( needs_link ){
    use_link( url.substring( "in ".length ) );
    return;
  }
  
  var html;

  function fill_frame( html ){
    var $iframe = $('#inseme_live_frame');
    var iFrameDoc = $iframe[0].contentDocument || $iframe[0].contentWindow.document;
    iFrameDoc.write( html );
    iFrameDoc.close();
  }

  function get_id( url ){
    if( !url )return "";
    var id = url;
    // Remove / at the end
    if( id[ id.length - 1 ] === "/" ){
      id = id.substring( 0, id.length - 1 );
    }
    // Remove anything after ? included
    var idx_question_mark = id.indexOf( "?" );
    if( idx_question_mark >= 0 ){
      id = id.substring( 0, idx_question_mark );
    }
    var idx_last_slash = id.lastIndexOf( "/" );
    if( idx_last_slash < 0 )return "";
    id = id.substring( idx_last_slash + 1 );
    // Sanitize to avoid html code injections
    id = encodeURIComponent( id );
    return id;
  }
  
  // A common case is when id is after last / (and before ?)
  var id = get_id( url );
  
  var frame_height = "600";
  var frame_template = ""
  + '<iframe id="inseme_live_frame" '
  + ' src="SRC"'
  + ' width="100%" height="' + frame_height + '" frameborder="0">'
  + '</iframe>';
  
  function use_iframe( url, height ){
    var html = frame_template.replace( "SRC", url );
    if( height ){
      html = html.replace( 'height="' + frame_height, 'height="' + height );
    }
    $("#inseme_live_container").empty().append( html ).removeClass( "hide" );
    $('html, body').animate({ scrollTop: 0 }, 0);
  }
    
  // Periscope case, the video is embedded in the top of the page iframe
  if( id && url.indexOf( "periscope.tv/") > 0 ){
    use_iframe( "https://periscope.tv/w/"+ id );
    // Another, complex, solution would be to play the stream myself
    // See: https://medium.com/@matteocontrini/how-to-use-the-public-periscope-stream-api-8dfedc7fe872#.jl8iz41uy
    // and https://github.com/gabrielg/periscope_api/blob/master/API.md
    // and https://github.com/ArnaudRinquin/peristream-examples/blob/master/browser-example.js
    // hls player: https://github.com/dailymotion/hls.js
    return; 
  }

  // bambuser case, the live video is embedded in the top of page iframe
  if( id && url.indexOf( "bambuser.com/broadcast/" ) > 0 ){
    use_iframe( "https://embed.bambuser.com/broadcast/" + id );
    return;
  }
  
  // facebook live case
  if( id && url.indexOf( "facebook.com/" ) > 0 ){
    // https://www.facebook.com/lenouvelobservateur/videos/10156868107940037/
    var width = $("#inseme_live_container").width();
    var template = ""
    + '<div class="fb-video"' 
    + ' data-href="https://www.facebook.com/facebook/videos/ID/"'
    + ' data-width="' + width + '" data-autoplay=true>'
    + '</div>';
    html = template.replace( "ID", id );
    $("#inseme_live_container").empty().append( html ).removeClass( "hide" );
    FB.XFBML.parse();
    $('html, body').animate({ scrollTop: 0 }, 0);
    return;
  }
  
  // mixlr audio case
  if( id && url.indexOf( "mixlr.com/" ) > 0 ){
    id = get_id( url.replace( "/embed", "" ) );
    if( id ){
      use_iframe( "https://mixlr.com/" + id + "/embed", "100" );
      return;
    }
  }

  // Use iframe if "http" starts the input
  if( url.indexOf( "http" ) === 0 ){
    // Minimal code injection protection
    id = url.replace( />/g, "!" ).replace( /script/gi, "!" );
    // Force https
    id = id.replace( "http:", "https:" );
    use_iframe( id );
    return;
  }
  
  // Default to a link if http starts the input
  if( url.indexOf( "http" ) === 0 ){
    use_link( id );
    return;
  }

  // Anything else restores the default, the same as on http://nuitdebout.fr
  // ToDo: per place default & .config one
  use_iframe( "https://embed.bambuser.com/broadcast/6205163" );
};


Inseme.set_proposition = function( room_id, text, timestamp ){
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_proposition for unknow room", room_id );
    return;
  }
  var proposition = text || "";
  // Filter out if no change
  if( proposition && proposition === room.proposition )return;
  room.proposition = proposition;
  room.proposition_timestamp = timestamp || Inseme.now();
  if( !text ){
    Inseme.results[ room_id ] = {};
  }
  if( proposition ){
    de&&bug( "New proposition in room", room.id, room.name, proposition );
  }
  if( room_id === Inseme.room_id ){
    $("#inseme_proposition_text").text( 
      text || "Tapez inseme ? proposition" 
    );
  }
};


Inseme.populate_vote_buttons = function(){
  
  var $vote_buttons = $("#inseme_vote_buttons");
  
  var html = '<ul id="#inseme_vote_button_ul">';
  //+ '<tr class="inseme_vote_button_tr">'
  
  Inseme.each_choice( function( c ){
    
    var text = Inseme.config.choices[ c ].text;
    if( !text )return;
    var html_label = Inseme.config.choices[ c ].html || text;
    
    // Add a button to vote according to that choice
    html += "" //+ '<tr class="inseme_vote_button_tr">'
    + '<li class="inseme_vote_button_li">'
    + '<a class="inseme_vote_button waves-effect waves-light btn-large"'
    + ' data-inseme-vote="' + c 
    + '">'
    + html_label
    + '</a>'
    + '</li>'
    //+ '</tr>'
    ;
  });
  
  //html += "</tr>";
  html += "</ul>";
  $vote_buttons.empty().append( html );
  
  // Add one global handler to manage all buttons
  $(".inseme_vote_button").click( function() {
    var vote = $(this).attr ( "data-inseme-vote" );
    
    // inseme: prefill textarea
    if( vote === "inseme" ){
      $("#firechat").find("textarea")
      .val( "inseme " )
      .focus();
      return;
    }
    
    // help: goto to help page
    if( vote === "help" ){
      window.open( Inseme.config.url_help );
      return;
    }
    
    // image, prefill textare to set url of embedded content at bottom of page
    if( vote === "image" ){
      $("#firechat").find("textarea")
      .val( "inseme image http://" )
      .focus();
      return;
    }
    
    // Else, it is a vote, raising hand style
    Inseme.change_vote( vote );
  } );
  
  // Show the div
  $('#inseme').removeClass( "hide" );
  $('#inseme_twitter_timeline').removeClass( "hide" );
  $('html, body').animate({ scrollTop: 0 }, 0);
};

// extracted from kudocracy

Inseme.duration_label = function duration_label( duration ){
// Returns a sensible text info about a duration
  // Slight increase to provide a better user feedback
  //duration += 5000;
  function l( x ){ return x; } // future i18n
  var delta = duration / 1000;
  var day_delta = Math.floor( delta / 86400);
  if( isNaN( day_delta) )return "";
  if( day_delta < 0 ){
    de&&bug( "negative timestamp", delta );
    return l( "... bientot", "... soon" );
  }
  return (day_delta == 0
      && ( delta < 3
        && l( '<span class="red-text">maintenant</span>', "just now")
        || delta < 60
        && "" + Math.floor( delta )
        + l( " secondes", " seconds")
        || delta < 120
        && l( "1 minute", "1 minute")
        || delta < 3600
        && "" + Math.floor( delta / 60 )
        + l( " minutes", " minutes")
        || delta < 7200
        && l( "environ une heure", "about an hour")
        || delta < 86400
        && "" + Math.floor( delta / 3600 )
        + l( " heures", " hours")
        )
      || day_delta == 1
      && l( " un jour", " a day")
      || day_delta < 7
      && "" + day_delta
      + l( " jours", " days")
      || day_delta < 31
      && "" + Math.ceil( day_delta / 7 )
      + l( " semaines", " weeks")
      || day_delta >= 31
      && "" + Math.ceil( day_delta / 30.5 )
      + l( " mois", " months")
      ).replace( /^ /, ""); // Fix double space issue with "il y a "
};


console.log( "Inseme was loaded" );
