// inseme.js
//
//  Realtime votes for assemblies, NuitDebout style
//
//  April 11th 2016 by @jhr


// de&&bug() & de&&mand(), traces and asserts
var de = true;
var bug  = console.log.bind( console );
var mand = function( p ){ if( !p ) throw new Error( "assert failed" ); };


var Inseme = {

  // All seen users, including the current one, on all rooms
  all_users: {},
  all_users_by_id: {}, // id is <provider>:<id>
  
  // All rooms
  rooms: {},
  rooms_by_id: {},
  
  // This is the current user's id, as per Firebase auth
  user_id: null,

  // This is the displayed name of the current user
  user_name: "",
  
  // id of current room, the one with the focus
  room_id: "",
  
  // name of current room
  room_name: "",
  
  // Some user actions are automatically stopped after a while
  interval: null,
  
  // This is how long (sec) until user actions are stopped automatically
  countdown: 0,
  
  // offline users (names) that the current user vote on behalf of
  proxied_users: {},
  
  // Log of all votes
  votes: [],

  // Count hands, per room_id, one counter per vote orientation
  results:{},

  // Always true as of today, served by firebase hosting solution
  is_https: false,
  
  // The Firechat instance. See https://firechat.firebaseapp.com/docs/
  // note: this is actually a FirechatUI object, with a _chat member
  firechat: null,
  
  // When the local clock is late, it is possible to adjust it  
  delta_clock: 0,
  
  config:{
    
    place: "Paris",
    
    url_help: "http://documentup.com/Virteal/inseme",
    
    // Max for user messages in UI
    maxLengthMessage: 1000,
    
    // Initial value of countdown for auto stop actions, seconds
    countdown: 30,

    // This defines the content of the action menu to "vote".
    // "sticky" ones are remembered when user gets back to "quiet" state
    choices:{
      
      //"inseme": {
      //  text: "inseme"
      //},
      
      "quiet": {
        text: "Silencieux",
        html: '<i class="material-icons">stop</i>'
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
        text: "Aide",
        html: '<i class="material-icons">help</i>'
      }
    }
  }

};


Inseme.patch_firechat = function(){
// Inject some modifications into Firechat code
  // I could fork firechat but this is overkill for now
  var templates = FirechatDefaultTemplates;
  for( var template_name in templates ){
    templates[ template_name ] 
    = Inseme.patch_i18n_template( template_name, templates[ template_name ] );
  }
  return Inseme;
};


Inseme.patch_i18n_template = function( name, html ){
// Patch jQuery style templates, including for i18n purposes
  
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
  
  // Decompile jQuery style template, it is a Function object, f( obj )
  var text = html.toString();
  
  r = text;
  
  function s( en, fr ){
    if( r.indexOf( en ) === -1 ){
      de&&bug( "Cannot translate in", name, "not found:", en );
      return;
    }
    r = r.replace( en, fr );
  }
  
  // Hack to find where some message is defined
  if( false && r.indexOf( "Create Public Room" ) > 0 ){
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
    s( "Invite to Private Chat", "Inviter dans un espace priv&eacute;" );
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
    s( "Invite to Private Chat", "Inviter dans une espace priv&eacute" );

  }else if( name === "room-user-search-list-item" ){
    s( "Invite to Room", "Inviter &agrave; une assembl&eacute;e" );

  }else if( name === "tab-content" ){
    s( "In Room", "Pr&eacute;sents" );
    s( "Invite", "Inviter" );
    s( "Leave Room", "Quitter l\\'assembl&eacute;e" );
    s( "Your message:", "Votre message :" );
    s( "Type your message here...", "Tapez votre message ici..." );
    
  }else if( name === "user-search-list-item" ){
    s( "Invite to Private Chat", "Inviter dans un espace priv&eacute;" );
  }
  
  // Recompile function if needed
  if( r !== text ){
    try{
      r = r.replace( "function (obj) {", "" );
      var idx_last_close_statement = r.lastIndexOf( "}" );
      r = r.substring( 0, idx_last_close_statement );
      r = new Function( "obj", r );
    }catch( err ){
      de&&bug( "i18n compile error for template", name, err );
      debugger;
      r = html;
    }
  }else{
    r = html;
  }
  
  return r;
  
};


Inseme.connect = function( chatref, authdata ){
  
  if( !authdata )return;
  var random_name = "Anonyme" + Math.round( Math.random() * 1000 );
  
  $('#inseme_live').removeClass( "hide" );
  
  $('#inseme_logout').removeClass( "hide" ).click( function(){
    Inseme.logout();
    chatref.unauth();
    document.location.reload();
  });
  
  Inseme.patch_firechat();
  
  var chat = new FirechatUI( 
    chatref, 
    document.getElementById( 'firechat-wrapper') 
  );
  
  Inseme.init( { firechat: chat } );
  Inseme.populate_vote_buttons();
  
  var uid = authdata.uid;
  var info = authdata[authdata.provider]
  var name = info.displayName || info.username || random_name;
  
  var room = window.location.search;
  // Get rid of ? if some room was specified
  if( room.length ){
    room = room.substring( 1 );
  }
  
  chat.setUser( uid, name );
  
  // Hack: because FirechatUI's .setUser() does not allow a callback,
  // I need to use a timeout...
  // ToDo: monkey patch firechat API to set up a callback
  setTimeout( 
    function(){
      Inseme.login( uid, name, room );
      setTimeout( 
        function(){
          Inseme.refresh_display();
        },
        3000 // Enought time to process previous 'inseme' messages
      );
    },
    3000 // Enought time to reload previous chat messages
  );
};


Inseme.init = function( config ){
// Called after user is firebase authenticated and after firechat is started

  de&&bug( "Inseme.init(", config, ") called" );
  de&mand( config );
  
  Inseme.firechat = config.firechat;
  if( config.maxLengthMessage ){
    Inseme.config.maxLengthMessage = config.maxLengthMessage;
  }
  config.firechat.maxLengthMessage = Inseme.config.maxLengthMessage;
  
  Inseme.set_firechat_event_handlers();
  
  // Scroll to top when reload
  window.onbeforeunload = function(){
    Inseme.close();
	  window.scrollTo( 0, 0 );
  };

  // Autodetect https access (not needed at this point)
  Inseme.is_https = ( 'https:' == document.location.protocol );
  
  return Inseme;
};


Inseme.close = function(){
// Called on user logout UI or beforeunload event, when user closes the window
  de&&bug( "Inseme.close() called" );
  return Inseme.logout();
};


Inseme.lookup_room = function( id ){
// Find a room, by id or by name, unless id is alreay a room itself
  if( !id )return null;
  if( typeof id !== "string" && id.id && id.name )return id;
  var room = Inseme.rooms_by_id[ id ];
  if( room )return room;
  room = Inseme.rooms[ id ];
  return room;
};


Inseme.track_room = function( id, name, timestamp ){
// Remember/retrieve all seen rooms, even when some info is missing
// ToDo: should remove room when user leave it ?
  
  var room;
  
  // If id, try to find using it 
  if( !room && id ){
    room = Inseme.rooms_by_id[ id ];
  }
  
  // If not found but name is available, try to find using name
  if( !room && name ){
    room = Inseme.rooms[ name ];
  }
  
  // If room was found, try to get id and name from it if needed
  if( room ){

    // Some consistency check
    de&&mand( !id || !room.id || id === room.id );
    de&&mand( !name || !room.name || name === room.name );

    // try to get name if unknown
    if( !name && room.name ){
      name = room.name;
    }
  
    // try to get id if unknown
    if( !id && room.id ){
      id = room.id;
    }
  
  // Create new room
  }else if( !room ){
    de&&bug( "Tracking new room", id, name, timestamp );
    room = {
      id:   "",
      name: "",
      proposition: "",
      proposition_timestamp: 0,
      reset_timestamp: timestamp,
      live: "",
      image: "",
      twitter: "",
      agenda: "",
      debounce_table: {},
      votes: {} // by user.id
    };
  }
  
  // Init timestamps if I have one
  if( !room.reset_timestamp && timestamp ){
    room.reset_timestamp = timestamp;
  }
  if( !room.proposition_timestamp && timestamp ){
    room.proposition_timestamp = timestamp;
  }
  
  // Make sure invariants are robust
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
  // Logout previous user (not expected at this stage)
  if( Inseme.user_id ){
    Inseme.logout();
  }
  Inseme.user_id = user_id;
  Inseme.user_name = user_name;
  // Enter specified room, if any
  var chatui_api = Inseme.firechat;
  var chat_api = Inseme.firechat._chat;
  // Scan all existing rooms
  chat_api.getRoomList( function( list ){
    for( var id in list ){
      var a_room = list[ id ];
      Inseme.track_room( a_room.id, a_room.name );
    }
    var found_room = room_name && Inseme.rooms[ room_name ];
    if( found_room ){
      de&&bug( "Entering room ", found_room.name, found_room.id );
      Inseme.set_current_room( found_room.id, found_room.name );
      // Set focus on chat tab for that room
      if( chatui_api.$messages[ found_room.id ] ){
        chatui_api.focusTab( found_room.id );
      }else{
        chatui_api._chat.enterRoom( found_room.id, found_room.name );
      }
    }
    // Broadcast a "quiet" initial message
    // ToDo: do I need the delay?
    setTimeout( function(){
      Inseme.change_vote();
    }, 1000 );
  });
  // ToDo: ? Inseme.change_vote();
  return Inseme;
};


Inseme.logout = function(){
  de&&bug( "Inseme.logout() called" );
  if( !Inseme.user_id )return Inseme;
  // Broadcast a last "quiet" message
  Inseme.change_vote();
  Inseme.user_id = null;
  Inseme.user_name = null;
  return Inseme;
};


Inseme.lookup_user = function( id ){
// Find a user, by id or by name, unless id is already a user itself
  if( !id )return null;
  if( typeof id !== "string" && id.id && id.name )return id;
  var user = Inseme.all_users_by_id[ id ];
  if( user )return user;
  user = Inseme.all_users[ id ];
  return user;
};


Inseme.track_user = function( name, id ){
  
  if( !name || !id ){
    de&&bug( "Missing name or id in Inseme.track_user()", name, id );
    debugger;
    return null;
  }
  
  if( name.indexOf( ":" ) !== -1 ){
    de&&bug( "Wrong name, id instead", name, id );
    debugger;
    return;
  }
  
  if( id.indexOf( ":" ) === -1 
  &&  id.length !== "5f917712-8d29-4c2e-96ac-9240365b6702".length
  ){
    de&&bug( "Wrong id, name instead", name, id );
    debugger;
    return;
  }
  
  var user = Inseme.all_users_by_id[ id ];
  
  // Create new user, on the fly
  if( !user ){
    user = {
      id: id,
      name: name,
      is_there: true, // ToDo: handle disconnect, remove votes
      votes: {} // by room.id
    };
    Inseme.all_users[ name ] = user;
    Inseme.all_users_by_id[ id ] = user;
  }
  
  return user;
  
};


Inseme.change_vote = function( vote ){
// Locally initiated change

  if( !vote ){
    vote = "quiet";
  }
  
  de&&bug( "UI. Inseme.vote(" + vote + ") called" );
  
  var user = Inseme.track_user( Inseme.user_name, Inseme.user_id );
  if( !user ){
    de&&bug( "Weird change_vote() for unknown user", Inseme.user_name );
    return Inseme;
  }
  
  // Update display based on vote
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

  // Send message. Channel listener will do the vote tracking stuff
  if( room_id ){
    de&&bug( "Send vote", room_id, vote );
    Inseme.firechat._chat.sendMessage( 
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
// Track which tab has the focus

  var previous_room_id = Inseme.room_id;
  
  var room = Inseme.track_room( id, name );
  if( !room ){
    de&&bug( "weird missing room in Inseme.set_current_room", id );
    return Inseme;
  }
  
  if( !room.id ){
    // This happens at startup only
    de&&bug( "missing id for room in Inseme.set_current_room", room );
    return Inseme;
  }
  
  Inseme.room_id = room.id;
  Inseme.room_name = room.name;
  
  // If changed
  if( Inseme.room_id !== previous_room_id ){
    // Adjust current live, image & proposition
    de&&bug( "Current room becomes", id, name, "was", previous_room_id );
    Inseme.set_live( room.id, room.live );
    Inseme.set_image( room.id, room.image );
    Inseme.set_twitter( room.id, room.twitter );
    Inseme.set_agenda( room.id, room.agenda );
    Inseme.refresh_display();
  }
  
  return Inseme;
  
};


Inseme.set_firechat_event_handlers = function(){
// Called once, at init, to track various events

  var chat = Inseme.firechat;

  // Monkey patch firechatui to track roomId
  // ToDo: is this still needed
  var old = chat.focusTab;
  chat.focusTab = function( room_id ){
    Inseme.set_current_room( room_id );
    return old.apply( this, arguments );
  };
  
  // Monkey patch .prompt() for additionnal i18n
  var old_prompt = chat.prompt.bind( chat );
  chat.prompt = function( msg, template ){
    if( msg === "Create Public Room" ){
      msg = "Créer un espace public";
    }else if( msg === "Invite" ){
      msg = "Inviter";
    }else if( msg === "Accepted" ){
      msg = "Accepté";
    }else if( msg === "Declined" ){
      msg = "Décliné";
    }else if( msg === "Mute User?" ){
      msg = "Filrer le participant ?";
    }else if( msg === "Private Invite" ){
      msg = "Invitation privée";
    }else if( msg === "Warning" ){
      msg = "Attention";
      if( template[ 0 ] === "Y" ){
        template = "Messages inappropri&eacute;s. Risque de suspension.";
      }
    }else if( msg === "Suspended" ){
      msg = "Suspension";
      // ToDo: i18n of string templace that include time left suspended
    }
    return old_prompt( msg, template );
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
  
  return Inseme;
  
};


Inseme.on_firechat_room_enter = function( room ){
  Inseme.set_current_room( room.id, room.name );
};


Inseme.on_firechat_room_exit = function( room_id ){
  // ToDo: deal with it
  de&&bug( "leave room", room_id );
};


Inseme.now = function(){
// Local clock is not as reliable as server's one
  return Date.now() + Inseme.delta_clock;
};


Inseme.on_firechat_message_add = function( room_id, message ){
// This is called whenever a message is added to the channel for a room
  
  // Past messages are delivered first
  var age = Inseme.now() - message.timestamp;
  
  // If local clock is late compared server's one, adjust local one
  // ToDo: what if it is early, not late?
  if( age < 0 ){
    Inseme.delta_clock -= age;
    age = 0;
  }
  
  // This may be the first message about that room
  Inseme.track_room( room_id, null, message.timestamp );
  
  // Skip old messages, 1 day
  // if( age > 24 * 60 * 60 * 1000 )return;
  
  var text = message.message;
  var user_name = message.name;
  var user_id = message.userId;
  
  // If the message was sent by the current user, we can assume he/she
  // focuses on the associated room
  if( user_name === Inseme.user_name ){
    Inseme.set_current_room( room_id );
  }
  
  // Skip not inseme related messages
  if( text.substring( 0, "inseme".length ).toLowerCase() !== "inseme" )return;
  
  // Remove some messages after a while to improve signal/noise
  var to_be_removed = true;
  var delay = (3 * 1000) - age;
  if( delay <= 0 || vote === "quiet" ){ delay = 1; }
  setTimeout( 
    function(){
      if( !to_be_removed )return;
      // chat/room-messages/room_id/msg_id
      var msg_id = message.id;
      // var ref = "room_messages/" + room_id + "/" + msg_id;
      // var msg_ref = Inseme.chatRef.child( ref );
      // msg_ref.remove();
      Inseme.firechat.removeMessage( room_id, msg_id );
    },
    delay
  );
  
  // If not about a known room, ignore
  if( !Inseme.rooms_by_id[ room_id ] ){
    de&&bug( "Weird, message in unkown room", room_id );
    return;
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
  
  // Look for potential vote orientation
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
  if( !found ){

    var param = "";
    var token1;
    
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

    if( token1 === "image" ){
      if( param === "help" ){
        param = "nuitdebout.png";
      }
      to_be_removed = false;
      Inseme.set_image( room_id, param, message.timestamp );
      
    }else if( token1 === "live" ){
      to_be_removed = false;
      Inseme.set_live( room_id, param, message.timestamp );
      
    }else if( token1 === "twitter" ){
      to_be_removed = false;
      Inseme.set_twitter( room_id, param, message.timestamp );
      
    }else if( token1 === "agenda" ){
      to_be_removed = false;
      Inseme.set_agenda( room_id, param, message.timestamp );
      
    }else if( token1 === "!" || ( param && token1 === "?" ) ){
      to_be_removed = false;
      Inseme.set_proposition( room_id, param, message.timestamp );
    
    }else if( token1 === "?" ){
      // ToDo: display help message
      $("#inseme.help").removeClass( "hide" );

    }else if( token1 === "bye" ){
      to_be_removed = false;
      if( param === Inseme.user_name ){
        Inseme.proxied_users[ param ] = param;
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
  Inseme.push_vote( room_id, user_name, message.userId, vote, message.timestamp );
  
  if( proxied_users ){
    proxied_users.forEach( function( u ){
      Inseme.push_vote( room_id, u, vote, message.timestamp, user_name );
      // When current user acquire that other person's vote
      if( user_name === Inseme.user_name ){
        Inseme.proxied_users[ u ] = u;
      }
    });
  }
  
  // Restore "quiet" after a while if message is from current user
  if( user_name === Inseme.user_name ){
    
    // Not "quiet"...
    if( vote !== "quiet" ){
      
      Inseme.countdown = Inseme.config.countdown;
      
      // Start periodic task if not already started
      if( !Inseme.interval ){
        Inseme.interval = setInterval(
          function(){
            if( --Inseme.countdown <= 0 ){
              // Stop periodic task
              if( Inseme.clerInterval ){
                clearInterval( Inseme.interval );
                Inseme.interval = null;
              }
              $('#inseme_countdown').text( "" ).addClass( "hide" );
              // Broadcast a "quiet" state
              // ToDo: avoid excessive "quiet" msg, signal/noise
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
      
    // Back to "quiet"
    }else{
      if( Inseme.interval ){
        clearInterval( Inseme.interval );
        Inseme.interval = null;
        $('#inseme_countdown').text( "" ).addClass( "hide" );
      }
    }
  }
  
};


Inseme.push_vote = function( room_id, name, user_id, vote, timestamp, proxy ){
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&bug( "Weird room in push_vote()", room_id );
    return Inseme;
  }
  
  // Track all seen users, including current one
  var user = Inseme.track_user( name, user_id );  
  
  // Log all votes, this may be useful in the future, not at this stage however
  Inseme.votes.push( {
    room_id: room.id,
    room_name: room.name,
    proposition: room.proposition,
    proposition_timestamp: room.proposition_timestamp,
    user_id: user.id,
    user_name: user.name,
    orientation: vote,
    timestamp: timestamp
  } );
  
  // Track proxied users of current user
  if( proxy === Inseme.user_name ){
    Inseme.proxied_users[ user.name ] = user.name;
  }
  
  // Update result
  var results = Inseme.results[ room.id ];
  if( !results ){
    results = Inseme.results[ room.id ] = room.results = {};
  }
  
  var votes = user.votes;
  if( !votes ){
    votes = user.votes = {};
  }
  
  var user_vote = votes[ room.id ];
  if( !user_vote ){
    user_vote = votes[ room.id ] = {};
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
    if( old_result.who_first === user.name ){
      old_result.who_first = null;
      if( old_result.count ){
        var found_first = null;
        var user_name2;
        for( user_name2 in Inseme.all_users ){
          var vote2 = Inseme.get_vote_of( room.id, user_name2 );
          if( user_name2 === user.name || vote2 !== previous_vote )continue;
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
    result.who_first = user.name;
  }
  
  Inseme.refresh_display();
  return Inseme;
  
};


Inseme.refresh_display = function(){
  
  if( !Inseme.interval_refresh_display ){
    Inseme.interval_refresh_display 
    = setInterval( Inseme.refresh_display, 1000 );
  }
  
  var room = Inseme.lookup_room( Inseme.room_id );
  var user = Inseme.lookup_user( Inseme.user_id );
  
  // 'quiet' button is shown only when user is not quiet
  if( room 
  &&  user
  &&  user.votes
  &&  user.votes[ room.id ]
  &&  user.votes[ room.id ].state === "quiet"
  ){
    $("#inseme_vote_button_quiet").addClass( "hide" );
  }else{
    $("#inseme_vote_button_quiet").removeClass( "hide" );
  }
  
  Inseme.debounce_run( room.id );
  Inseme.display_short_results();
  Inseme.display_long_results();
};


Inseme.user_link = function( n ){
  var user = Inseme.lookup_user( n );
  if( !user )return "";
  
  var id = user.id;
  var name = user.name;
  var provider = "";
  
  if( id.indexOf( ":" ) !== -1 ){
    provider = id.substring( 0, id.indexOf( ":" ) );
    id = id.substring( id.indexOf( ":" ) + 1 );
  }
  
  if( false && !provider ){
    de&&bug( "Weird user id without a provider name", id );
    debugger;
  }
  
  var link = name;
  
  function make( url, id, name ){
    return ""
    + '<a '
    + 'href="https://'
    + url
    + id
    + '">'
    + name
    + '</a>';
  }
  
  if( provider === "twitter" ){
    link = make( "twitter.com/intent/user", "?user_id=" + id, name );
    
  }else if( provider === "facebook" ){
    link = make( "www.facebook.com/", id, name );
    
  }else if( provider === "google" ){
    link = make( "plus.google.com/", id, name );
    
  }else if( provider === "github" ){
    link = make( "github.com/", name, name );
  }
  
  return link;
  
};


Inseme.get_short_results = function(){
  
  var room = Inseme.lookup_room( Inseme.room_id );
  var results = Inseme.results[ room.id ];
  if( !results ){
    results = room.results = Inseme.results[ room.id ] = {};
  }
  var msg = "";
  var orientation;
  var count;
  for( orientation in results ){
    count = results[ orientation ].count;
    if( !count )continue;
    var who_first = results[ orientation ].who_first;
    msg +=  " "
    + Inseme.config.choices[ orientation ].text
    + " " 
    + ( count === 1 
      ? ( ( who_first && Inseme.user_link( who_first ) ) || count )
      : count )
    + ".";
  }
  return msg;
};


Inseme.display_short_results = function(){
  var room = Inseme.lookup_room( Inseme.room_id );
  $("#inseme_proposition_text").text( 
    room.proposition || "Tapez inseme ? proposition" 
  );
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
  // + ' ' + annee 
  + ' &agrave; ' + h + ':' + m + ':' + s;
};


Inseme.display_long_results = function(){
  
  var room = Inseme.lookup_room( Inseme.room_name );
  if( !room )return;
  
  var msg = "";
  
  var now = Inseme.now();
  var age = 0;
  if( room.proposition_timestamp ){
    age = now - room.proposition_timestamp;
  }else{
    age = now - room.reset_timestamp;
  }
  msg += "Nous sommes " + Inseme.date_label( now );
  
  msg += ", dans l'assemblée '" + ( room.name || "sans nom" ) + "'.";
  
  
  if( room.proposition ){
    msg += "<br>Proposition \"" + room.proposition + "\"";
    msg += " faite " + Inseme.date_label( room.proposition_timestamp );
    msg += ", il y a " + Inseme.duration_label( age ) + ".";
  }else{
    msg += "<br>Sur la discussion en cours depuis "
    + Inseme.duration_label( age ) + ".";
  }
  
  msg += "<ul>";
  
  var sticky_votes = {};
  var list = [];
  for( var n in Inseme.all_users ){
    list.push( Inseme.lookup_user( n ).name );
  }
  list = list.sort();
  
  list.forEach( function( n ){
    var user;
    var votes;
    var vote;
    
    user = Inseme.lookup_user( n );
    if( !user )return;
    
    votes = user.votes;
    if( !votes ){
      votes = user.votes = {};
    }
    vote = votes[ room.id ];
    if( !vote ){
      vote = votes[ room.id ] = {};
    }
    if( !vote.vote )return;
    
    var room_votes = room.votes;
    if( !room_votes ){
      room_votes = room.votes = {};
    }
    if( !room_votes[ user.id ] ){
      room_votes[ user.id ] = vote;
    }
    
    msg += "<li>" + Inseme.user_link( user ) + ", ";
    if( vote.vote && Inseme.config.choices[ vote.vote ].is_sticky ){
      if( !sticky_votes[ vote.vote ] ){
        sticky_votes[ vote.vote ] = 0;
      }
      if( !room.reset_timestamp || vote.timestamp > room.reset_timestamp ){
        sticky_votes[ vote.vote ]++;
      }
      msg += Inseme.config.choices[ vote.vote ].text;
      if( vote.state !== vote.vote ){
        msg += ", puis " + Inseme.config.choices[ vote.state ].text;
      }
    }else{
       msg += Inseme.config.choices[ vote.state ].text;
    }
    msg += ""
    + ( vote.via 
      ? " (via " + Inseme.user_link( vote.via ) + ")"
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
    msg += "<br>R&eacute;sultats, depuis " 
    + Inseme.date_label( room.reset_timestamp )
    + ", il y a " + Inseme.duration_label( now - room.reset_timestamp )
    + " : ";
    orientations.sort( function( a, b ){
      return sticky_votes[ b ] - sticky_votes[ a ];
    });
    msg += '<table id="inseme_results">';
    orientations.forEach( function( orientation ){
      msg += "<tr><td>" 
      + Inseme.config.choices[ orientation ].text
      + "</td><td>"
      + sticky_votes[ orientation ]
      + "</td></tr>";
    });
    msg += "</table>";
  }
  
  $('#inseme_vote_list').empty().append( msg );
  return Inseme;
};


Inseme.get_vote_of = function( room_id, user_name ){
  var user = Inseme.lookup_user( user_name );
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


Inseme.debounce = function( room_id, key, fun ){
// Register a function to execute when a room becomes the current one.
// Execution of such function is never immediate. If multiple functions
// are registered quickly, only the last one is run.
  var room = Inseme.lookup_room( room_id );
  if( !room )return;
  if( !room.debounce_table ){
    room.debounce_table = {};
  }
  room.debounce_table[ key ] = fun;
};


Inseme.debounce_run = function( room_id ){
  var room = Inseme.lookup_room( room_id );
  if( !room )return;
  var table = room.debounce_table;
  if( !table )return;
  
  for( var key in table ){
    var fun = table[ key ];
    if( !fun )continue;
    delete table[ key ];
    try{
      fun.call();
    }catch( err ){
      console.warn( "failed run of debounced", key, "in", room.name );
    }
  }
};


Inseme.set_image = function( room_id, image_url, timestamp ){
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_image for unknow room", room_id );
    return;
  }
  
  room.image = image_url || "";

  Inseme.debounce( room, "image", function(){
    $("#inseme_image").empty();
    if( image_url ){
      $("#inseme_image")
      .append( $( '<a>', { href: image_url } ) )
      .embedly();
    }
  });
  
};


Inseme.set_twitter = function( room_id, name, timestamp ){
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_image for unknow room", room_id );
    return;
  }
  
  name = name.replace( "@", "" ).trim();
  
  room.twitter = name || "";
  
  Inseme.debounce( room, "twitter", function(){
    $("#inseme_twitter_timeline").empty();
    if( name ){
      $("#inseme_twitter_timeline")
      .append( $( 
        "<a>", 
        { 
          text: "Tweets de @" + name,
          "class": "twitter-timeline",
          href: "https://twitter.com/" + name
        }
      ) );
      window.twttr && window.twttr.ready( function(){
        twttr.widgets.load( 
          document.getElementById( "inseme_twitter_timeline" )
        );
      });
    }
  });
  
};


Inseme.set_agenda = function( room_id, name, timestamp ){
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_agenda for unknow room", room_id );
    return;
  }
  
  name = name.trim();
  name = name.replace( "http:", "https:" );
  
  room.agenda = name || "";
  
  Inseme.debounce( room, "agenda", function(){
    if( !name ){
      $("#inseme_agenda").empty().addClass( "hide" );
      return;
    }
    if( name.indexOf( "//" ) === -1 ){
      name = "https://openagenda.com/" + name;
    }
    if( name ){
      var frame_height = "1000";
      var html = ""
      + '<iframe id="inseme_agenda_frame" '
      + ' src="' + name + '"'
      + ' width="100%" height="' + frame_height + '" frameborder="0">'
      + '</iframe>';
      $("#inseme_agenda").empty().append( html ).removeClass( "hide" );
    }
  });
  
};


Inseme.set_live = function( room_id, url, timestamp ){
  
  url = url.trim();
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_live for unknow room", room_id );
    return;
  }
  
  room.live = url || "";
  
  // remove extra spaces
  url = url.replace( /  /g, " " ).trim();
  
  // Empty url to remove all
  if( !url ){
    Inseme.debounce( room, "live", function(){
      $("#inseme_live").addClass( "hide" ).empty();
    });
    return;
  }
  
  // 'off' special case
  if( url === "off" ){
    Inseme.debounce( room, "live_on_off", function(){
      $("#inseme_live").addClass( "hide" );
    });
    return;
  }

  // 'on' special case
  if( url === "on" ){
    Inseme.debounce( room, "live_on_off", function(){
      $("#inseme_live").removeClass( "hide" );
    });
    return;
  }
  
  // 'broadcast' special case, using webRTC
  // See https://webrtc.ventures/2016/01/live-streaming-with-webrtc/
  if( url === "broadcast" ){
    // ToDo: implement sender side and receivers side
    return;
  }
  
  var idx_space = url.indexOf( " " );
  var token1 = url;
  var but_token1 = "";
  if( idx_space >= 0 ){
    token1 = url.substring( 0, idx_space );
    but_token1 = url.substring( idx_space + 1 );
  }
  
  function use_link( url ){
    Inseme.debounce( room, "live", function(){
      var html = '<a id="inseme_live_link" href="" target="_blank">Live</a>'; 
      $("#inseme_live").empty().append( html ).removeClass( "hide" );
      $("#inseme_live_link").attr( "href", url );
      $('html, body').animate({ scrollTop: 0 }, 0);
    });
  }
  
  var needs_link = url.substring( 0, "in ".length ) === "in ";
  if( needs_link ){
    use_link( url.substring( "in ".length ) );
    return;
  }
  
  var html;

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
    Inseme.debounce( room, "live", function(){
      $("#inseme_live").empty().append( html ).removeClass( "hide" );
      $('html, body').animate({ scrollTop: 0 }, 0);
    });
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
  
  // youtube case
  // ToDo: case https://www.youtube.com/watch?v=xjS6SftYQaQ
  if( id 
  && ( url.indexOf( "youtube.com/embed" ) > 0 
    || url.indexOf( "/youtu.be/" )        > 0 )
  ){
    use_iframe( "https://www.youtube.com/embed/" + id + "&autoplay=1" );
    return;
  }
  
  // facebook live case
  if( id && url.indexOf( "facebook.com/" ) > 0 ){
    // https://www.facebook.com/lenouvelobservateur/videos/10156868107940037/
    var template = ""
    + '<div class="fb-video"' 
    + ' data-href="https://www.facebook.com/facebook/videos/ID/"'
    + ' data-autoplay=true>'
    + '</div>';
    html = template.replace( "ID", id );
    Inseme.debounce( room, "live", function(){
     $("#inseme_live").empty().append( html ).removeClass( "hide" );
      FB.XFBML.parse();
      $('html, body').animate({ scrollTop: 0 }, 0);
    });
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
  // use_iframe( "https://embed.bambuser.com/broadcast/6205163" );
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
  
  if( !proposition ){
    room.results = Inseme.results[ room.id ] = room.results = {};
    room.reset_timestamp = timestamp || Inseme.now();
  }
  
  if( proposition ){
    de&&bug( "New proposition in room", room.id, room.name, proposition );
    room.proposition = proposition;
    room.proposition_timestamp = timestamp || Inseme.now();
  }
  
  return Inseme;
  
};


Inseme.populate_vote_buttons = function(){
  
  var $vote_buttons = $("#inseme_vote_buttons");
  
  var html = '<ul id="#inseme_vote_button_ul">';
  //+ '<tr class="inseme_vote_button_tr">'
  
  Inseme.each_choice( function( c ){
    
    var text = Inseme.config.choices[ c ].text;
    if( !text )return;
    var html_label = Inseme.config.choices[ c ].html || text;
    var tooltip = text.replace( /"/g, "'" );
    
    // Add a button to vote according to that choice
    html += "" //+ '<tr class="inseme_vote_button_tr">'
    + '<li id="inseme_vote_button_' + c + '"'
    + ' class="inseme_vote_button_li"'
    + '>'
    + '<a class="inseme_vote_button waves-effect waves-light btn-large tooltipped"'
    + ' data-position="bottom"'
    + ' data-delay="50"'
    + ' data-tooltip="' + tooltip + '"'
    + ' data-inseme-vote="' + c + '"' 
    + '>'
    + html_label
    + '</a>'
    + '</li>'
    //+ '</tr>'
    ;
  });
  
  //html += "</tr>";
  html += "</ul>";
  $vote_buttons.empty().append( html );
  
  // 'quiet' button is shown only when user is not quiet
  $("#inseme_vote_button_quiet").addClass( "hide" );
  
  // Enable tooltips
  $('.tooltipped').tooltip( { delay: 50 } );
  
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
      var $help = $("#inseme_help");
      if( $help.hasClass( "hide" ) ){
        $help.removeClass( "hide" );
      }else{
        $help.addClass( "hide" );
      }
      $("#inseme_help_link").attr( "href", Inseme.config.url_help );
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
  
  try{
    gapi.hangout.render( 
      'inseme_hangout', 
      { 
        render: 'createhangout',
        topic: "Inseme/" + Inseme.room_name,
        hangout_type: "onair",
        initial_apps: [
          { 
            app_id : '1008226714074', // ToDo: config
            start_data : Inseme.user_name,
            app_type: 'ROOM_APP'
          }
        ],
        widget_size: 200
      }
    );
    $("#inseme_hangout_button").removeClass( "hide" );
  }catch( err ){
    console.log( "Error starting hangout" );
    console.log( err );
  }
  
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
