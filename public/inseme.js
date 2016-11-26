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
  all_users_by_name: {},
  all_users_by_id: {}, // id is <provider>:<id>, unless anonymous
  
  // All rooms
  rooms: {},
  rooms_by_id: {},
  
  // This is the current user, the one logged in
  user: null,
  
  // the current room, if any
  room: null,
  
  // Some user actions are automatically stopped after a while
  interval: null,
  
  // This is how long (sec) until user actions are stopped automatically
  countdown: 0,
  
  // users (names) that the current user vote on behalf of
  proxied_users: {},
  
  // Log of all votes, not used yet
  log_votes: [],

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
    
    // Number of previous messages to process when entering a room
    numMaxMessages: 500,
    
    // Initial value of countdown for auto stop actions, seconds
    countdown: 30,

    // This defines the content of the action menu to "vote".
    // "sticky" ones are remembered when user gets back to "quiet" state
    choices:{
      
      "quiet": {
        text: "silencieux",
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
      
      /*"help": {
        text: "Aide",
        html: '<i class="material-icons">help</i>'
      }*/
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
// Patch firechat's jQuery style templates, including for i18n purposes
  
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
      var idx_first_open_statement = r.indexOf( "{" );
      r = r.substring( idx_first_open_statement + 1 );
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
  
  $('#inseme_live').removeClass( "hide" );
  
  $('#inseme_logout').removeClass( "hide" ).click( function(){
    Inseme.logout();
    // chatref.signOut();
    firebase.auth().signOut();
    document.location.reload();
  });
  
  Inseme.patch_firechat();
  
  var chat = new FirechatUI( 
    chatref, 
    document.getElementById( 'firechat-wrapper'),
    {
      numMaxMessages: Inseme.config.numMaxMessages
    }
  );
  
  Inseme.init( { firechat: chat } );
  Inseme.populate_vote_buttons();
  
  var uid = authdata.uid;
  var info;
  var provider;
  var provider_uid;
  if( authdata.isAnonymous ){
    info = {}; 
    provider = "anonymous";
  }else{
    info = authdata.providerData[ 0 ];
    provider = info.providerId.replace( /\..*/, "" );
    provider_uid = info.uid;
  }
  var random_name = "Anonyme" + Math.round( Math.random() * 1000 );
  var name = info.displayName || info.username || random_name;
  
  var room = window.location.search;
  // Get rid of ? if some room was specified
  if( room.length ){
    room = room.substring( 1 );
    // Get rid of c9 special stuff
    if( room.indexOf( "_c9" ) !== -1 ){
      room = null;
    }
  }
  
  chat.setUser( uid, name );
  
  // Hack: because FirechatUI's .setUser() does not allow a callback,
  // I need to use a timeout...
  // ToDo: monkey patch firechat API to set up a callback
  setTimeout( 
    function(){
      Inseme.login( provider, provider_uid, uid, name, room );
      setTimeout( 
        function(){
          Inseme.refresh_display();
        },
        300 // Enough time to process previous 'inseme' messages
      );
    },
    300 // Enought time to reload previous chat messages
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

  if( !id && !name )return null;
  
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
  
  // Create a new room
  }else if( !room ){
    de&&bug( "Tracking new room", id, name, timestamp );
    room = {
      id:   "",
      name: "",
      proposition: "",
      proposition_timestamp: 0,
      reset_timestamp: timestamp,
      pad: "",
      live: "",
      image: "",
      twitter: "",
      facebook: "",
      agenda: "",
      debounce_table: {},
      votes_by_user_id: {},
      results: {} // by orientation (ie by sticky state)
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


Inseme.login = function( provider, provider_uid, user_id, user_name, room_name ){
  
  de&&bug( "Inseme.login( " + provider + ", " + provider_uid + ", " + user_id + ", " + user_name + ", " + room_name + ") called" );
  de&&mand( user_id );
  de&&mand( user_name );
  
  // Logout previous user (not expected at this stage)
  if( Inseme.user ){
    Inseme.logout();
  }
  
  Inseme.set_current_room( null );
  
  Inseme.user = Inseme.track_user( provider, provider_uid, user_id, user_name );
  de&&mand( Inseme.user );
  
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

    // ToDo: do I need the delay?
    setTimeout( function(){
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
      Inseme.change_vote();
    }, 1000 );
  });

  // ToDo: ? Inseme.change_vote();
  return Inseme;

};


Inseme.logout = function(){
  de&&bug( "Inseme.logout() called" );
  if( !Inseme.user )return Inseme;
  // Broadcast a last "quiet" message
  Inseme.change_vote();
  Inseme.user = null;
  return Inseme;
};


Inseme.lookup_user = function( id ){
// Find a user, by id or by name, unless id is already a user itself
  if( !id )return null;
  if( typeof id !== "string" && id.id && id.name )return id;
  var user = Inseme.all_users_by_id[ id ];
  if( user )return user;
  user = Inseme.all_users_by_name[ id ];
  return user;
};


Inseme.track_user = function( provider, provider_uid, id, name, timestamp ){
  
  if( !name || !id ){
    de&&bug( "Missing name or id in Inseme.track_user()", name, id );
    debugger;
    return null;
  }
  
  if( false && name.indexOf( ":" ) !== -1 ){
    de&&bug( "Wrong name, id instead", name, id );
    debugger;
    return;
  }
  
  if( id.indexOf( ":" ) === -1 
  &&  id.length !== "PzM6AKsQGhMR7smnk7i2eEpuXHC2".length
  &&  id.length !== "bc964d54-a3aa-4791-a201-9836f4452700".length
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
      is_moderator: false,
      is_anonymous: provider === "anonymous",
      provider: provider,
      provider_uid: provider_uid,
      timestamp: null,
      is_there: true // ToDo: handle disconnect, remove votes
    };
    Inseme.all_users_by_name[ name ] = user;
    Inseme.all_users_by_id[ id ] = user;
  
  // Update user info
  }else{
    if( user.is_anonymous && provider !== "anonymous" ){
      user.is_anonymous = false;
      user.provider = provider;
      user.provider_uid = provider_uid;
    }
  }
  
  user.timestamp = timestamp || Inseme.now();
  
  return user;
  
};


Inseme.change_vote = function( vote ){
// Locally initiated change

  if( !vote ){
    vote = "quiet";
  }
  
  de&&bug( "UI. Inseme.vote(" + vote + ") called" );
  
  var user = Inseme.user;
  if( !user ){
    de&&bug( "Weird change_vote() for unknown user" );
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
  
  var room = Inseme.room;

  // Send message. Channel listener will do the vote tracking stuff
  if( room ){
    de&&bug( "Send vote", room.id, vote );
    Inseme.firechat._chat.sendMessage( 
      room.id,
      "inseme "
      + ( user.is_anonymous ? "" : user.provider + " " + user.provider_uid + " " )
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

  var previous_room = Inseme.room;
  
  var room = Inseme.track_room( id, name );
  
  if( !room ){
    if( Inseme.room ){
      Inseme.room = null;
      de&&bug( "Current room becomes null, was", previous_room && previous_room.id );
      Inseme.set_live();
      Inseme.set_pad();
      Inseme.set_image();
      Inseme.set_twitter();
      Inseme.set_facebook();
      Inseme.set_agenda();
      $("#inseme_hangout_button").addClass( "hide" );
      Inseme.refresh_display();
    }else{
      Inseme.room = null;
    }
    return Inseme;
  }
  
  Inseme.room = room;
  
  if( !room.id ){
    // This happens at startup only
    de&&bug( "missing id for room in Inseme.set_current_room", room );
    return Inseme;
  }
  
  // If changed
  if( Inseme.room !== previous_room ){
    
      var room_name = ( Inseme.room && Inseme.room.name ) || ""; 
      var user_name = ( Inseme.user && Inseme.user.name ) || "";
      try{
        gapi.hangout.render( 
          'inseme_hangout', 
          { 
            render: 'createhangout',
            topic: "Inseme/" + room_name,
            hangout_type: "onair",
            initial_apps: [
              { 
                app_id : '1008226714074', // ToDo: config
                start_data : user_name,
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

    // Adjust current live, image & proposition
    de&&bug( "Current room becomes", id, name, "was", previous_room && previous_room.id );
    Inseme.set_live( room.id, room.live );
    Inseme.set_pad( room.id, room.pad );
    Inseme.set_image( room.id, room.image );
    Inseme.set_twitter( room.id, room.twitter );
    Inseme.set_facebook( room.id, room.facebook );
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
  Inseme.set_current_room( null );
};


Inseme.now = function(){
// Local clock is not as reliable as server's one
  var server_now = firebase.database.ServerValue.TIMESTAMP;
  var basic_now  = Date.now() 
  var local_now  = basic_now + Inseme.delta_clock;
  if( server_now ){
    var delta = server_now - local_now;
    if( delta < 1000 || delta > 1000 ){
      de&&bug( "Clock delta", delta );
      if( local_now < server_now ){
        Inseme.delta_clock += delta;
        console.warn( "Insme.now(), adjust local clock", delta );
        de&&mand( basic_now + Inseme.delta_clock === server_now );
        local_now = server_now;
      }
    }
  }
  return local_now;
};


Inseme.on_firechat_message_add = function( room_id, message ){
// This is called whenever a message is added to the channel for a room
  
  // Past messages are delivered first
  var age = Inseme.now() - message.timestamp;
  
  // If local clock is late compared server's one, adjust local one
  // ToDo: what if it is early, not late?
  if( age < 0 ){
    console.warn( "Inseme.on_firechat_message_add(), adjust local clock", -age );
    Inseme.delta_clock -= age;
    age = 0;
  }
  
  // This may be the first message about that room
  var room = Inseme.track_room( room_id, null, message.timestamp );
  
  // Skip old messages, 1 day
  // if( age > 24 * 60 * 60 * 1000 )return;
  
  var text = message.message;
  var user_name = message.name;
  var user_id = message.userId;
  
  // Detect inseme special messages
  var is_command = text.substring( 0, "inseme".length ).toLowerCase() === "inseme";
  
  // Extract provider from message "inseme xxxx ...."
  var provider = "anonymous";
  var provider_uid;
  if( is_command ){
    provider = text.substring( "inseme".length + 1 );
    provider = provider.substring( 0, provider.indexOf( " " ) );
    if( [ "anonymous", "twitter", "facebook", "google", "github" ].indexOf( provider ) !== -1 ){
      var new_text = text.replace( provider + " ", "" );
      provider_uid = new_text.substring( "inseme".length + 1 );
      provider_uid = provider_uid.substring( 0, provider_uid.indexOf( " " ) );
      if( provider_uid && provider_uid.substring( 0, 4 ) !== "http" ){
        text = new_text.replace( provider_uid + " ", "" );
      }else{
        provider = "anonymous";
      }
    }else{
      provider = "anonymous";
    }
  }
  var user = Inseme.track_user( provider, provider_uid, user_id, user_name, message.timestamp );
  
  if( !user ){
    de&&bug( "weird missing user in on_firechat_message", user_id, user_name );
    return;
  }
  
  // If the message was sent by the current user, we can assume he/she
  // focuses on the associated room
  if( user === Inseme.user ){
    Inseme.set_current_room( room.id );
  }
  
  // Skip not inseme related messages
  if( !is_command )return;
  
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
      
    }else if( token1 === "pad" ){
      to_be_removed = false;
      Inseme.set_pad( room_id, param, message.timestamp );
      
    }else if( token1 === "twitter" ){
      to_be_removed = false;
      Inseme.set_twitter( room_id, param, message.timestamp );
      
    }else if( token1 === "facebook" ){
      to_be_removed = false;
      Inseme.set_facebook( room_id, param, message.timestamp );
      
    }else if( token1 === "agenda" ){
      to_be_removed = false;
      Inseme.set_agenda( room_id, param, message.timestamp );
    
    }else if( token1 === "moderateur" || token1 === "modérateur" ){
      to_be_removed = false;
      Inseme.set_moderator( user, room_id, param, message.timestamp );
      
    }else if( token1 === "!" || ( param && token1 === "?" ) ){
      to_be_removed = false;
      Inseme.set_proposition( room_id, param, message.timestamp );
    
    }else if( token1 === "?" ){
      // ToDo: display help message
      $("#inseme.help").removeClass( "hide" );

    }else if( token1 === "bye" ){
      to_be_removed = false;
      if( param === Inseme.user && Inseme.user.name ){
        Inseme.proxied_users[ param ] = param;
      }
    }
      
  }
  if( !found )return;
  
  false && de&&bug( 
    "Received vote", 
    vote, 
    "user", user.name,
    "room", room.id,
    "named", Inseme.rooms_by_id[ room.id ].name,
    "ago", Inseme.duration_label( Inseme.now() - message.timestamp )
  );
  Inseme.push_vote( room_id, user.name, user.id, vote, message.timestamp );
  
  if( proxied_users ){
    proxied_users.forEach( function( u ){
      Inseme.push_vote( room_id, u, vote, message.timestamp, user.name );
      // When current user acquires that other person's vote
      if( user.name === ( Inseme.user && Inseme.user.name ) ){
        Inseme.proxied_users[ u ] = u;
      }
    });
  }
  
  // Restore "quiet" after a while if message is from current user
  if( user === Inseme.user ){
    
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
              $('#inseme_action_countdown').text( "" ).addClass( "hide" );
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
              $('#inseme_action_countdown')
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
  var user = Inseme.track_user( "anonymous", null, user_id, name, timestamp );  
  
  // Log all votes, this may be useful in the future, not at this stage however
  Inseme.log_votes.push( {
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
  if( Inseme.user && ( proxy === Inseme.user.name ) ){
    Inseme.proxied_users[ user.name ] = user.name;
  }
  
  // Update result
  var results = Inseme.room.results;
  var votes_by_user_id = Inseme.room.votes_by_user_id;
  
  var user_vote = votes_by_user_id[ user.id ];
  if( !user_vote ){
    user_vote = votes_by_user_id[ user.id ] = {};
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
        for( var user_id2 in Inseme.all_users_by_id ){
          var user2 = Inseme.all_users_by_id[ user_id2 ];
          var vote2 = Inseme.get_vote_of( room.id, user_id2 );
          if( user2 === user || vote2 !== previous_vote )continue;
          if( !found_first ){
            found_first = vote2;
            old_result.who_first = user2.name;
            continue;
          }
          if( vote2.timestamp < found_first.timestamp ){
            found_first = vote2;
            old_result.who_first = user2.name;
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
// This funtion is called every second and it redraw parts of the
// display that change according to time and user actions.
  
  if( !Inseme.interval_refresh_display ){
    Inseme.interval_refresh_display 
    = setInterval( Inseme.refresh_display, 1000 );
  }
  
  var room = Inseme.room;
  var user = Inseme.user;
  
  // Show/hide the action buttons
  if( !room ){
    $("#inseme_actions").addClass( "hide" );
  }else{
    $("#inseme_actions").removeClass( "hide" );
  }
  
  // 'quiet' button is shown only when user is not quiet
  if( room 
  &&  user
  &&  room.votes_by_user_id[ user.id ]
  // &&  room.votes_by_user_id[ user.id ].state !== "quiet"
  ){
    $("#inseme_vote_button_quiet").removeClass( "hide" );
  }else{
    $("#inseme_vote_button_quiet").addClass( "hide" );
  }
  
  Inseme.debounce_run( room && room.id );
  Inseme.display_short_results();
  Inseme.display_long_results();

  // Make a bookmarkable url
  var href = window.location.href;
  var idx = href.indexOf( "?" );
  if( idx !== -1 ){
    href = href.substring( 0, idx );
  }
  
  // ToDo: detect changes and use pushState()
  if( room ){
    href += "?" + room.name;
    window.history.replaceState( {}, room.name, href );
  }else{
    window.history.replaceState( {}, "", href );
  }

};


Inseme.user_link = function( n ){
  
  var user = Inseme.lookup_user( n );
  if( !user )return "";
  
  var name = user.name;
  var provider = user.provider;
  var id = user.provider_uid;
  
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
// Short results are a one liner with synthetic results.
  
  var room = Inseme.room;
  if( !room )return "";
  
  var results = room.results;
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
  
  var room = Inseme.room;
  
  $("#inseme_proposition_text").text( 
    room
    ? ( room.proposition || "Tapez inseme ? proposition" )
    : "Choisissez une assemblée d'abord"
  );
  
  if( !room ){
    $("#inseme_proposition_results").html( "" );
    return;
  }
  
  var results = room.results;
  var msg = "";
  var orientation;
  var count;
  
  for( orientation in results ){
    
    count = results[ orientation ].count;
    
    if( !count ){
      $( "#inseme_proposition_result_" + orientation ).html( "" );
      continue;
    }
    
    var who_first = results[ orientation ].who_first;
    
    var tmp = "" + count;
    if( count === 1 && who_first ){
      tmp = "" + ( Inseme.user_link( who_first ) || count );
    }
    msg +=  " "
    + Inseme.config.choices[ orientation ].text
    + " " + tmp + ".";
    
    if( orientation !== "quiet" ){
      if( who_first && who_first === Inseme.user.name && Inseme.countdown ){
        tmp += '<div id="inseme_action_countdown">' 
        + Inseme.countdown + '</div>';
      }
      $( "#inseme_proposition_result_" + orientation ).html( tmp );
    }
    
  }
  
  $("#inseme_proposition_results").html( msg );
  
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
  
  var room = Inseme.room;
  
  var msg = "";
  
  var now = Inseme.now();
  msg += "<br>Nous sommes " + Inseme.date_label( now );
  
  if( !room ){
    $('#inseme_vote_list').empty().append( msg );
    return;
  }
  
  var age = 0;
  if( room.proposition_timestamp ){
    age = now - room.proposition_timestamp;
  }else{
    if( room.reset_timestamp ){
      age = now - room.reset_timestamp;
    }
  }
  msg += ", dans l'assemblée '" + ( room.name || "sans nom" ) + "'.";
  
  if( room.proposition ){
    msg += "<br>Proposition \"" + room.proposition + "\"";
    msg += " faite " + Inseme.date_label( room.proposition_timestamp );
    msg += ", il y a " + Inseme.duration_label( age ) + ".";
  }else if( age ){
    msg += "<br>Sur la discussion en cours depuis "
    + Inseme.duration_label( age ) + ".";
  }
  
  msg += "<ul>";
  
  var sticky_votes = {};
  var count_sticky_votes = 0;
  
  var list = [];
  for( var ii in Inseme.all_users_by_id ){
    list.push( Inseme.all_users_by_id[ ii ] );
  }
  list = list.sort( function( a, b ){
    if( a.name < b.name )return -1;
    if( a.name > b.name )return 1;
    return 0;
  });
  
  // For each known user
  list.forEach( function( user ){
    
    // Is there a vote from that user in the current room?
    if( !user || !user.is_there )return;
    var votes_by_user_id = room.votes_by_user_id;
    var vote = votes_by_user_id[ user.id ]
    if( !vote )return;
    
    // Ignore vote if too old, ie before last reset
    if( room.reset_timestamp
    &&  vote.timestamp
    &&  vote.timestamp < room.reset_timestamp
    &&  vote.state !== "talk"
    ){
      return;
    }

    var state = vote.state || "quiet";
    var age = now - ( vote.timestamp || user.timestamp );
    
    var is_cold = age > 60 * 60 * 1000; // one hour
    
    // Not cold if after last reset of votes/proposition
    if( is_cold 
    && vote.timestamp 
    && room.reset_timestamp 
    && vote.timestamp > room.reset_timestamp
    ){
      is_cold = false;
    }
    
    msg += ( is_cold ? '<li class="inseme_cold_state">' : '<li>' );
    
    if( user.is_moderator ){
      msg += "*";
    }
    
    msg += Inseme.user_link( user ) + ", ";
   
    // Sticky votes are special, they remain active, they impact the global results
    if( vote.vote && Inseme.config.choices[ vote.vote ].is_sticky ){
      if( !sticky_votes[ vote.vote ] ){
        sticky_votes[ vote.vote ] = 0;
      }
      if( !room.reset_timestamp || vote.timestamp > room.reset_timestamp ){
        sticky_votes[ vote.vote ]++;
        count_sticky_votes++;
      }
      msg += ""
      + '<span class="orange-text">'
      + Inseme.config.choices[ vote.vote ].text
      + '</span>';
      if( vote.state !== vote.vote ){
        msg += ", puis ";
      }else{
        state = null;
      }
    }
    
    if( state ){
      if( state !== "quiet" ){
        msg += '<span class="red-text">';
      }
      msg += Inseme.config.choices[ state || "quiet" ].text;
      if( state !== "quiet" ){
        msg += '</span>';
      }
    }
    msg += ""
    + ( vote.via 
      ? " (via " + Inseme.user_link( vote.via ) + ")"
      : "" )
    + ", depuis " 
    + Inseme.duration_label( age )
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
    
    if( room.proposition ){
      msg += "<tr><td colspan=2>" + room.proposition + "</td></tr>";
    }

    orientations.forEach( function( orientation ){
      msg += "<tr><td>" 
      + Inseme.config.choices[ orientation ].text
      + "</td><td>"
      + sticky_votes[ orientation ]
      + "</td></tr>";
    });

    if( orientations.length > 1 ){
      msg += "<tr><td>Total</td><td>" + count_sticky_votes + '</td></tr>';
    }
    
    msg += "</table>";

  }
  
  $('#inseme_vote_list').empty().append( msg );
  return Inseme;
};


Inseme.get_vote_of = function( room_id, user_id ){
  
  var room = Inseme.lookup_room( room_id );
  var user = Inseme.lookup_user( user_id );
  if( !user || !room )return null;
  return room.votes_by_user_id[ user.id ];

};


Inseme.on_firechat_message_remove = function( room_id, message ){
  de&&bug( "Inseme.on_firechat_message_remove(", arguments, ") called" );
  de&&bug( "message", message );
};


Inseme.debounce = function( room_id, key, fun ){
// Register a function to execute when a room becomes the current one.
// Execution of such function is never immediate. If multiple functions
// are registered quickly, only the last one is run.

  var room = Inseme.lookup_room( room_id );
  
  // Use global table if there is no "current room"
  if( !room ){
    room = Inseme;
  }
  
  if( !room.debounce_table ){
    room.debounce_table = {};
  }
  
  room.debounce_table[ key ] = fun;
  
};


Inseme.debounce_run = function( room_id ){
  
  var room = Inseme.lookup_room( room_id );
  
  // Use global table if there is no "current room"
  if( !room ){
    room = Inseme;
  }
  
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
  
  if( !room_id ){
    $("#inseme_image").empty();
    return;
  }
  
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


Inseme.set_moderator = function( by_user, room_id, name, timestamp ){
  
  if( !room_id )return;
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_moderator for unknow room", room_id );
    return;
  }
  
  var user = Inseme.lookup_user( by_user );
  if( !user ){
    de&&bug( "Missing user in set_moderator", by_user );
    return;
  }
  
  // Default to sending user if nothing else was specified
  if( !name ){
    // However, anonymous users cannot designate themselves
    if( user.provider === "anonymous" ){
      name = user.name;
    }
  }
  if( !name )return;
  
  var moderator = Inseme.lookup_user( name );
  
  // Only moderators can designate an anonymous moderators
  if( moderator.id.indexOf( ":" ) === -1 && !user.is_moderator ){
    return;
  }
  
  function add_to_database( a_user ){
    // Hack into firechat internals
    Inseme.firechat._chat.isModerator = true;
    a_user.is_moderator = true;
    // Hack into firechat internals
    var ref = Inseme.firechat._chat._moderatorsRef;
    var new_administrator = ref.child( a_user.id ).push();
    // ToDo: should be by room, not global
    var when = timestamp || Inseme.now();
    new_administrator.update( {
      set_by_user_id: user.id,
      set_by_user_name: user.name,
      from_room_id: room.id,
      from_room_name: room.name,
      to_user_id: a_user.id,
      to_user_name: a_user.name,
      at: when,
      at_label: Inseme.date_label( when ).replace( "&agrave;", "à" )
    } );
  }
  
  if( !moderator.is_moderator ){
    add_to_database( moderator );
  }
  
  // Whoever designated a moderator is also a moderator
  if( !user.is_moderator ){
    // de&&mand( user.id.indexOf( ":" ) !== -1 );
    add_to_database( user );
  }
  
};


Inseme.set_twitter = function( room_id, name, timestamp ){
  
  if( !room_id ){
    $("#inseme_twitter_timeline").empty();
    return;
  }
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_twitter for unknow room", room_id );
    return;
  }
  
  name = name.replace( "@", "" ).trim();
  
  room.twitter = name || "";
  
  Inseme.debounce( room, "twitter", function(){
    $("#inseme_twitter_timeline").empty();
    if( !name )return;
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
  });
  
};


Inseme.set_facebook = function( room_id, name, timestamp ){
  
  if( !room_id ){
    $("#inseme_facebook").empty();
    return;
  }
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_facebook for unknow room", room_id );
    return;
  }
  
  name = name.trim();
  
  room.facebook = name || "";
  
  Inseme.debounce( room, "facebook", function(){
    $("#inseme_facebook").empty();
    if( !name )return;
    var idx = name.indexOf( "#" );
    if( idx !== -1 ){
      name = name.substring( 0, idx );
    }
    var config = {
      "data-href": name,
      "data-width": "560"
    };
    var what_type = "fb-post";
    if( name.indexOf( "/video" ) !== -1 ){
      what_type = "fb-video";
    }
    if( name.indexOf( "comment_id") !== -1 ){
      what_type = "fb-comment-embed";
      config[ "data-include-parent" ] = "true";
    }
    if( name === "comments" ){
      what_type = "fb-comments"
      config[ "data-href" ] = window.location.href;
      config[ "data-numposts" ] = "10";
      config[ "data-order-by"] = "reverse_time";
    }
    config[ "class"] = what_type;
    console.log( "facebook", what_type, config ); 
    $("#inseme_facebook").append( $( "<div>", config ) );
    // Update display
    if( window.FB && window.FB.XFBML ){
      FB.XFBML.parse( document.getElementById( "inseme_facebook" ) );
    }
  });
  
};


Inseme.set_agenda = function( room_id, name, timestamp ){
  
  if( !room_id ){
    $("#inseme_agenda").empty().addClass( "hide" );
    return;
  }
    
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


Inseme.set_pad = function( room_id, msg, timestamp ){
  
  if( !room_id ){
    Inseme.debounce( room, "pad", function(){
      $("#inseme_pad").addClass( "hide" ).empty();
    });
    return;
  }
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_pad for unknow room", room_id );
    return;
  }
  
  msg = ( msg || "" ).trim();
  room.pad = msg;
  
  // Empty msg to remove all
  if( !msg ){
    Inseme.debounce( room, "pad", function(){
      $("#inseme_pad").addClass( "hide" ).empty();
    });
    return;
  }
  
  // 'off' special case
  if( !msg || msg === "off" || msg === "-" ){
    Inseme.debounce( room, "pad_on_off", function(){
      $("#inseme_pad").addClass( "hide" );
    });
    return;
  }

  // 'on' special case
  if( msg === "on" || msg === "+" ){
    Inseme.debounce( room, "pad_on_off", function(){
      $("#inseme_pad").removeClass( "hide" );
    });
    return;
  }
  
  function use_link( url ){
    Inseme.debounce( room, "pad", function(){
      var html = '<a id="inseme_pad_link" href="" target="_blank">Pad</a>';
      $("#inseme_pad").empty().append( html ).removeClass( "hide" );
      $("#inseme_pad_link").attr( "href", url );
      $('html, body').animate({ scrollTop: 0 }, 0);
    });
  }
  
  function use_iframe_external( url, name, height ){
    
    var frame_height = "600";
    var frame_template = ""
    + '<h3>Pad</h3>'
    + '<iframe id="inseme_pad_frame" '
    + ' src="SRC"'
    + ' name="NAME"'
    + ' width="100%" height="' + frame_height + '" frameborder="0">'
    + '</iframe>';
  
    var html = frame_template.replace( "SRC", url );
    html = html.replace( "NAME", name || "pad" );
    if( height ){
      html = html.replace( 'height="' + frame_height, 'height="' + height );
    }
    Inseme.debounce( room, "pad", function(){
      $("#inseme_pad").empty().append( html ).removeClass( "hide" );
      $('html, body').animate({ scrollTop: 0 }, 0);
    });
  }
  
  if( msg.indexOf( "http" ) !== -1 ){
    // in xxxx to provide a link
    if( msg.substring( 0, 3 ) === "in " ){
      msg = msg.substring( 3 );
    }else{
     // Special cases when I can embed in a frame, Framapad
     if( msg.indexOf( "framapad.org" ) !== -1 ){
       msg = msg.replace( "http:", "https:" );
       if( msg.indexOf( "?" ) === -1 ){
         msg += "?showControls=true&showChat=true&showLineNumbers=true&useMonospaceFont=false";
       }
       use_iframe_external( msg, "embed_readwrite" );
       return;
     }
    }
    use_link( msg );
    return;
  }

  function use_iframe_pad( msg, room_name, height ){
    
    var frame_height = "600";
    var frame_template = ""
    + '<h3>Pad "' + msg.replace( /</g, "&lt;" ) + '"</h3>'
    + '<iframe id="inseme_pad_frame" '
    + ' src="pad.html"'
    + ' name="SRC"'
    + ' width="100%" height="' + frame_height + '" frameborder="0">'
    + '</iframe>';
  
    var html = frame_template.replace( "SRC", room_name );
    if( height ){
      html = html.replace( 'height="' + frame_height, 'height="' + height );
    }
    Inseme.debounce( room, "pad", function(){
      $("#inseme_pad").empty().append( html ).removeClass( "hide" );
      $('html, body').animate({ scrollTop: 0 }, 0);
    });
    
  }
  
  use_iframe_pad( msg, room.name );

};


Inseme.set_live = function( room_id, url, timestamp ){
  
  if( !room_id ){
    Inseme.debounce( room, "live", function(){
      $("#inseme_live").addClass( "hide" ).empty();
    });
    return;
  }
  
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
  if( url === "off" || url === "-" ){
    Inseme.debounce( room, "live_on_off", function(){
      $("#inseme_live").addClass( "hide" );
    });
    return;
  }

  // 'on' special case
  if( url === "on" || url === "+" ){
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
  
  function use_iframe( url, height ){
    
    // ToDo: compute aspect ratio to match 16/9?
    var frame_height = "600";
    
    var frame_template = ""
    + '<iframe id="inseme_live_frame" '
    + ' src="SRC"'
    + ' width="100%" height="' + frame_height + '" frameborder="0">'
    + '</iframe>';
  
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
  
  // Livesteam case
  if( id && url.indexOf( "livestream.com" ) > 0 ){
    // https://livestream.com/accounts/4256572/events/2374488
    id = "" + ( parseInt( id, 10 ) || "" );
    var idx = url.indexOf( ".com/" );
    if( id && idx !== -1 ){
      tmp = url.substring( idx + ".com/".length );
      idx = tmp.indexOf( "/event" );
      if( idx !== -1 ){
        tmp = tmp.substring( 0, idx );
        if( tmp ){
          use_iframe( 
            "https://livestream.com/" 
            + tmp
            + "/events/" + id
            + "/player?&autoPlay=true&mute=true"
          );
        }
      }
    }
    return;
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
  
  // Use a link if http starts the input
  if( url.indexOf( "http" ) === 0 ){
    use_link( id );
    return;
  }
  
  // Just set a text, default
  $("#inseme_live").empty().text( url ).removeClass( "hide" );
  
};


Inseme.set_proposition = function( room_id, text, timestamp ){
  
  if( !room_id )return;
  
  var room = Inseme.track_room( room_id, null, timestamp );
  if( !room ){
    de&&bug( "Weird call to set_proposition for unknow room", room_id );
    return;
  }
  
  var proposition = text || "";
  
  // Filter out if no change
  if( proposition && proposition === room.proposition )return;
  
  if( !proposition ){
    room.results = {};
    room.votes_by_user_id = {};
    room.reset_timestamp = timestamp || Inseme.now();
  }
  
  if( proposition ){
    de&&bug( "New proposition in room", room.id, room.name, proposition );
    room.proposition = proposition;
    room.proposition_timestamp = timestamp || Inseme.now();
  }
  
  return Inseme;
  
};


Inseme.each_choice = function( f ){
  var all_choices = Inseme.config.choices;
  for( var c in all_choices ){
    f( c );
  }
};


Inseme.populate_vote_buttons = function(){
  
  var $vote_buttons = $("#inseme_vote_buttons");
  
  var html = '<ul id="inseme_vote_button_ul">';
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
    + '<div id="inseme_proposition_result_' + c + '"></div>'
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
  
  // Show the div
  $('#inseme').removeClass( "hide" );
  $('#inseme_twitter_timeline').removeClass( "hide" );
  $('#inseme_facebook').removeClass( "hide" );
  $('html, body').animate({ scrollTop: 0 }, 0 );
  
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
  if( day_delta > 555 *  30 )return "un certain temps";
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
