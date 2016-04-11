// inseme.js
//
//  Realtime votes for assemblies, NuitDebout style
//
//  April 11th 2016 by @jhr

var de = true;
var bug  = function(){ return console.log.apply( console, arguments ); };
var mand = function( p ){ if( !p ) throw new Error( "assert failed" ); };


var Inseme = {

  user_id: null,

  user_label: "",

  vote: null,

  timestamp: null,

  votes: [],

  results:{},

  config:{
    
    place: "Paris",
    
    firechat: null,

    choices:{
      
      "quiet": {
        text: "silencieux"
      },
      
      "ok": {
        text: "d'accord"
      },
      
      "repeat": {
        text: "deja dit"
      },
      
      "talk": {
        text: "demande la parole"
      },
      
      "point": {
        text: "point technique"
      },
      
      "explain": {
        text: "pas compris"
      },
      
      "no": {
        text: "opposition radicale"
      },
      
      "calm": {
        text: "calme"
      },
      
      "volume": {
        text: "plus fort"
      },
      
      "translate": {
        text: "traduire"
      }
    }
  }

};


Inseme.init = function( config ){
  de&&bug( "Inseme.init(", config, ") called" );
  if( !config ) config = {};
  de&mand( config );
  Inseme.config.firechat = config.firechat;
  Inseme.set_firechat_event_handlers();
  return Inseme;
};


Inseme.close = function(){
  de&&bug( "Inseme.close() called" );
  return Inseme.logout();
};


Inseme.login = function( user_id, user_label ){
  de&&bug( "Inseme.login(" + user_id + ", " + user_label + ") called" );
  de&&mand( user_id );
  de&&mand( user_label );
  if( Inseme.user_id ){
    Inseme.logou();
  }
  Inseme.user_id = user_id;
  Inseme.user_label = user_label;
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
  de&&bug( "Inseme.vote(" + vote + ") called" );
  if( vote === Inseme.vote )return;
  Inseme.vote = vote;
  Inseme.timestamp = Date.now();
  Inseme.config.firechat._chat.sendMessage( 
    Inseme.config.firechat._inseme_room_id,
    "inseme " + ( Inseme.config.choices[ vote ].text || vote )
  );
  return Inseme;
};


Inseme.set_firechat_event_handlers = function(){
  var chat = Inseme.config.firechat;
  // Monkey patch firechatui to track roomId
  var old = chat.focusTab;
  chat.focusTab = function( room_id ){
    chat._inseme_room_id = room_id;
    return old.apply( this, arguments );
  };
  chat.on( 'message-add',    Inseme.on_firechat_message_add );
  chat.on( 'message-remove', Inseme.on_firechat_message_remove );
};


Inseme.on_firechat_message_add = function( room_id, message ){
  // Skip old messages, process only those that are less than a minute old
  var age = Date.now() - message.timestamp;
  if( age > 60 * 1000 )return;
  var text = message.message;
  // Skip not inseme related messages
  if( text.substring( 0, "inseme".length ) !== "inseme" )return;
  var vote = text.substr( "inseme ".length ) || "quiet";
  // Lookup canonical form
  if( !Inseme.config.choices[ vote ] ){
    var found = false;
    Inseme.each_choice( function( c ){
      if( found )return;
      if( Inseme.config.choice[ c ].text != vote )return;
      vote = c;
      found = true;
    });
    if( !found )return;
  }
  var user = message.name;
  de&&bug( "Inseme.on_firechat_message_add(...,", message, ") called" );
  de&&bug( "vote", vote, "user", user );
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


console.log( "Inseme was loaded" );
