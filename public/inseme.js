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
  
  users: {},
  
  proposition: null,

  votes: [],

  results:{},

  config:{
    
    place: "Paris",
    
    firechat: null,

    choices:{
      
      "inseme": {
        text: "inseme"
      },
      
      "quiet": {
        text: "silencieux"
      },
      
      "ok": {
        text: "d'accord"
      },
      
      "no": {
        text: "pas d'accord"
      },
      
      "explain": {
        text: "pas compris"
      },
      
      "repeat": {
        text: "deja dit"
      },
      
      "talk": {
        text: "parole"
      },
      
      "point": {
        text: "point technique"
      },
      
      "volume": {
        text: "plus fort"
      },
      
      "calm": {
        text: "calme"
      },
      
      "translate": {
        text: "traduire"
      }
    }
  }

};


Inseme.init = function( config ){
  de&&bug( "Inseme.init(", config, ") called" );
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
  var user = Inseme.users[ Inseme.user_label ];
  if( !user ){
    user = {};
    Inseme.users[ Inseme.user_label ] = user;
  }
  $("#inseme_proposition_vote").text( Inseme.config.choices[ vote ].text );
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
  // if( age > 1 * 60 * 1000 )return;
  var text = message.message;
  // Skip not inseme related messages
  if( text.substring( 0, "inseme".length ) !== "inseme" )return;
  var vote = text.substr( "inseme ".length ) || "quiet";
  var found = false;
  // Lookup canonical form
  if( !found ){
    found = Inseme.config.choices[ vote ];
  }
  if( !found ){
    Inseme.each_choice( function( c ){
      if( found )return;
      if( Inseme.config.choices[ c ].text != vote )return;
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
      param = vote.substring( isp + 1 );
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
          param = "https://pbs.twimg.com/media/CfJGLWBXEAEPBfC.jpg";
        }
        Inseme.set_image( param );
      }else if( token1 === "video" ){
        Inseme.set_video( param );
      }else if( token1 === "audio" ){
        Inseme.set_audio( param );
      }else if( token1 === "?" ){
        Inseme.set_proposition( param );
      }
    }
  }
  if( !found )return;
  var user_name = message.name;
  //de&&bug( "Inseme.on_firechat_message_add(...,", message, ") called" );
  de&&bug( "vote", vote, "user", user_name );
  Inseme.votes.push( { orientation: vote, user: user_name } );
  var user = Inseme.users[ user_name ];
  if( !user ){
    user = {};
    Inseme.users[ user_name ] = user;
  }
  var results = Inseme.results;
  var previous_vote = user.vote;
  if( previous_vote ){
    var old_result = results[ previous_vote ];
    if( !old_result ){
      old_result = { count: 1, who_first: null };
      results[ previous_vote ] = old_result;
    }
    old_result.count--;
    if( old_result.who_first === user_name ){
      old_result.who_first = null;
      if( old_result.count ){
        var found_first = null;
        var user_name2;
        var user_object;
        for( user_name2 in Inseme.users ){
          var vote = Inseme.get_vote_of_user( user_name2 );
          if( !found_first ){
            found_first = vote;
            old_result.who_first = user_name2;
            continue;
          }
          if( vote.timestamp < found_first.timestamp ){
            found_first = vote;
            old_result.who_first = user_name2;
          }
        }
      }
    }
  }
  user.vote = vote;
  user.timestamp = Date.now();
  var result = results[ vote ];
  if( !result ){
    result = { count: 0, who_first: null };
    results[ vote ] = result;
  }
  result.count++;
  if( results[ vote ].count === 1 ){
    results[ vote ].who_first = user_name;
  }
  var msg = "";
  var orientation;
  var count;
  for( orientation in results ){
    count = results[ orientation ].count;
    if( !count )continue;
    msg +=  " "
    + Inseme.config.choices[ orientation ].text
    + "/" 
    + ( count === 1 
      ? ( results[ orientation ].who_first || count )
      : count )
    ;
  }
  $("#inseme_proposition_results").text( msg );
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


Inseme.set_image = function( image_url ){
  $("#inseme_image_container")
  .empty()
  .prepend( $( '<a>',{href: image_url } ) )
  .embedly();
};


Inseme.set_video = function( video_url ){

  // periscope case
  if( video_url.indexOf( "periscope.tv") > 0 ){
    return; 
  }

  // bambuser case
  if( video_url.indexOf( "bambuser.com/broadcast/" ) > 0 ){
    var idx_last_slash = video_url.lastIndexOf( "/" );
    var id = video_url.substring( idx_last_slash + 1 );
    $("#inseme_video_container").empty().prepend(
    '"<iframe id="inseme_video_frame" src="https://embed.bambuser.com/broadcast/'
    + id + '" width="460" height="345" frameborder="0"></iframe>"'
    ).removeClass( "hide" );
    return;
  }

  // 'off' special case
  if( video_url === "off" ){
    $("#inseme_video_container").addClass( "hide" );
    return;
  }

  // 'on' special case
  if( video_url === "on" ){
    $("#inseme_video_container").removeClass( "hide" );
    return;
  }

  // Restore default
  $("#inseme_video_container").empty().prepend(
  '"<iframe id="inseme_video_frame" src="https://embed.bambuser.com/broadcast/6205163" width="460" height="345" frameborder="0"></iframe>"'
  ).removeClass( "hide" );
  
};


Inseme.set_audio = function( audio_url ){
  
};


Inseme.set_proposition = function( text ){
  Inseme.proposition = text || "";
  Inseme.votes = [];
  Inseme.vote = null;
  Inseme.timestamp = Date.now();
  if( !text ){
    Inseme.results = {};
    Inseme.users   = {};
  }
  $("#inseme_proposition_text").text( text || "Tapez inseme ? proposition" );
};


console.log( "Inseme was loaded" );
