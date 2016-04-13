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
  
  // All seen users, including current one
  users: {},
  
  // offline users that the current user vote on behalf of
  proxied_users: {},
  
  // inseme ? xxxx to set the currently discussed proposition
  proposition: null,

  votes: [],

  // Count hands, one counter per vote orientation
  results:{},

  is_https: false,
  
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
  // Autodetect https access
  Inseme.is_https = ( 'https:' == document.location.protocol );
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
    Inseme.logout();
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
  
  // if( vote === Inseme.vote )return;
  
  var user = Inseme.users[ Inseme.user_label ];
  
  if( !user ){
    user = {};
    Inseme.users[ Inseme.user_label ] = user;
  }
  
  $("#inseme_proposition_vote").text( Inseme.config.choices[ vote ].text );
  
  // Collect potential proxied users, => u1, u2, u3...
  var proxied_users = [];
  for( var u in Inseme.proxied_users ){
    proxied_users.push( u );
  }
  Inseme.config.firechat._chat.sendMessage( 
    Inseme.config.firechat._inseme_room_id,
    "inseme " 
    + ( Inseme.config.choices[ vote ].text || vote )
    + ( proxied_users.length
      ? " => " + proxied_users.join( "," )
      : ""
    )
  );
  return Inseme;
};


Inseme.set_firechat_event_handlers = function(){
  var chat = Inseme.config.firechat;
  // Monkey patch firechatui to track roomId
  var old = chat.focusTab;
  chat.focusTab = function( room_id ){
    Inseme.room_id = chat._inseme_room_id = room_id;
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
  var user_name = message.name;
  
  // Never proxy a talking user
  delete Inseme.proxied_users[ user_name ];
  
  // Skip not inseme related messages
  if( text.substring( 0, "inseme".length ) !== "inseme" )return;
  
  // Extract proxied users, if any
  var idx = text.indexOf( " => " );
  var proxied_users = null;
  if( idx > 0 ){
    proxied_users = text.substring( idx + " => ".length ).split( "," );
    text = text.substring( 0, idx );
  }
  
  // Look for vote orientation
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
        
      }else if( token1 === "live" ){
        Inseme.set_live( param );
        
      }else if( token1 === "?" ){
        Inseme.set_proposition( param );
      
      }else if( token1 === "bye" ){
        if( param === Inseme.user_label ){
          Inseme.proxied_users[ param ] = param;
        }
      }
      
    }
  }
  if( !found )return;
  
  de&&bug( "vote", vote, "user", user_name );
  Inseme.push_vote( user_name, vote, message.timestamp );
  if( proxied_users ){
    proxied_users.forEach( function( u ){
      Inseme.push_vote( u, vote, message.timestamp, user_name );
      // When current user acquire that other person's vote
      if( user_name === Inseme.user_label ){
        Inseme.proxied_users[ u ] = u;
      }
    });
  }
  
  // Remove some messages after a while to improve signal/noise
  setTimeout( 
    function(){
      // chat/room-messages/room_id/msg_id
      var room_id = Inseme.room_id;
      var msg_id = message.id;
      // var ref = "room_messages/" + room_id + "/" + msg_id;
      // var msg_ref = Inseme.chatRef.child( ref );
      // msg_ref.remove();
      Inseme.config.firechat.removeMessage( room_id, msg_id );
    },
    3 * 1000
  );
  
};


Inseme.push_vote = function( user_name, vote, timestamp, proxy ){
  
  Inseme.votes.push( { orientation: vote, user: user_name } );
  
  var user = Inseme.users[ user_name ];
  
  // Track all seen users, including current one
  if( !user ){
    user = {};
    Inseme.users[ user_name ] = user;
  }
  
  // Track proxied users of current user
  if( proxy === Inseme.user_label ){
    Inseme.proxied_users[ user_name ] = user_name;
  }
  
  var results = Inseme.results;
  
  // Remove previous vote
  var previous_vote = user.vote;
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
          var vote2 = Inseme.get_vote_of( user_name2 );
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
  
  user.vote = vote;
  user.timestamp = timestamp; // Date.now();
  user.via = proxy;
  
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
  
  Inseme.display_short_results();
  Inseme.display_long_results();
 
};


Inseme.display_short_results = function(){
  var results = Inseme.results;
  var msg = "";
  var orientation;
  var count;
  function twitter( n ){
    return ""
    + '<a href="http://twitter.com/' + n + '">' 
    + "@" + n
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
  $("#inseme_proposition_results").html( msg );
  return Inseme;
}


Inseme.display_long_results = function(){
  var msg = "<ul>";
  var now = Date.now();
  var v;
  var list = [];
  for( var n in Inseme.users ){
    list.push( n );
  }
  list = list.sort();
  function twitter( n ){
    return ""
    + '<a href="http://twitter.com/' + n + '">' 
    + "@" + n
    + '</a>';
  }
  list.forEach( function( n ){
    v = Inseme.users[ n ];
    msg += "<li>"
    + twitter( n )
    + ", " + Inseme.config.choices[ v.vote ].text
    + ( v.via 
      ? " (via " + twitter( v.via ) + ")"
      : "" )
    + ", depuis " 
    + Inseme.duration_label( now - v.timestamp )
    + ".</li>";
  });
  msg += "</ul>";
  $('#inseme_vote_list').empty().append( msg );
  return Inseme;
};


Inseme.get_vote_of = function( user_name ){
  var vote = Inseme.users[ user_name ];
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


Inseme.set_image = function( image_url ){
  $("#inseme_image_container")
  .empty()
  .append( $( '<a>', { href: image_url } ) )
  .embedly();
};


Inseme.set_live = function( video_url ){
  
  var idx_last_slash;
  var id;
  var html;

  // ToDo: periscope case
  // Periscope does not allow embedding, I am looking for a solution
  // http://embedperiscope has issues with https
  if( !Inseme.is_https && video_url.indexOf( "periscope.tv") > 0 ){
    idx_last_slash = video_url.lastIndexOf( "/" );
    id = video_url.substring( idx_last_slash + 1 );
    // Note: per spec, cannot open unsecure http iframe from https page
    html = ""
    + '<!doctype html><body><script id="periscope-embed"'
    + ' src="http://embedperiscope.com/app/embed.js"'
    + " data-options='"
    + '{"width":316,"height":561,"orientation":"portrait","broadcast_id":"'
    + encodeURIComponent( id ) 
    + '"}'
    + "'"
    + '></script></body>';
    var iframe_html = '<iframe id="inseme_live_frame" '
    + '" width="316" height="561" frameborder="0"></iframe>';
    de&bug( "script:", html );
    $("#inseme_live_container").empty().append( iframe_html ).removeClass( "hide" );
    var $iframe = $('#inseme_live_frame');
    var iFrameDoc = $iframe[0].contentDocument || $iframe[0].contentWindow.document;
    iFrameDoc.write( html );
    iFrameDoc.close();
    return; 
  }

  // bambuser case, the live video is embedded at the top of the page
  if( video_url.indexOf( "bambuser.com/broadcast/" ) > 0 ){
    idx_last_slash = video_url.lastIndexOf( "/" );
    id = video_url.substring( idx_last_slash + 1 );
    $("#inseme_live_container").empty().append(
    '<iframe id="inseme_live_frame" src="https://embed.bambuser.com/broadcast/'
    + encodeURIComponent( id )
    + '" width="460" height="345" frameborder="0"></iframe>'
    ).removeClass( "hide" );
    return;
  }
  
  // http://mixlr.com/radiodebout
  // ToDo: issue with https
  if( !Inseme.is_https && video_url.indexOf( "mixlr.com" ) > 0 ){
    idx_last_slash = video_url.lastIndexOf( "/" );
    id = video_url.substring( idx_last_slash + 1 );
    $("#inseme_live_container").empty().append(
    '<iframe id="inseme_live_frame" src="https://mixlr.com/'
    + encodeURIComponent( id )
    + '" width="300" height="34" frameborder="0"></iframe>'
    ).removeClass( "hide" );
    return;
  }

  // 'off' special case
  if( video_url === "off" ){
    $("#inseme_live_container").addClass( "hide" );
    return;
  }

  // 'on' special case
  if( video_url === "on" ){
    $("#inseme_live_container").removeClass( "hide" );
    return;
  }
  
  // Default to a link, if http starts the input
  if( video_url.indexOf( "http" ) === 0 ){
    html = '<a id="inseme_live_link" href="" target="_blank">Live</a>'; 
    $("#inseme_live_container").empty().append( html ).removeClass( "hide" );
    $("#inseme_live_link").attr( "href", video_url );
    return;
  }

  // Restore default, the same as on http://nuitdebout.fr
  // ToDo: per place default
  $("#inseme_live_container")
  .empty().append(
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


Inseme.populate_vote_buttons = function(){
  
  var $vote_buttons = $("#inseme_vote_buttons");
  
  var html = '<ul id="#inseme_vote_button_ul">';
  //+ '<tr class="inseme_vote_button_tr">'
  
  Inseme.each_choice( function( c ){
    
    var text = Inseme.config.choices[ c ].text;
    if( !text )return;
    
    // Add a button to vote according to that choice
    html += "" //+ '<tr class="inseme_vote_button_tr">'
    + '<li class="inseme_vote_button_li">'
    + '<a class="inseme_vote_button waves-effect waves-light btn"'
    + ' data-inseme-vote="' + c 
    + '">'
    + text
    + '</a>'
    + '</li>'
    //+ '</tr>'
    ;
  });
  
  //html += "</tr>";
  html += "</ul>";
  $vote_buttons.empty().append( html );
  
  // Add one global handler to manage all buttons
  $(".inseme_vote_button").click ( function() {
    var vote = $(this).attr ( "data-inseme-vote" );
    
    // inseme: prefill textarea
    if( vote === "inseme" ){
      $("#firechat").find("textarea")
      .val( "inseme " )
      .focus();
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
  if( day_delta < 0 ) return l( "le futur", "the future" );
  return (day_delta == 0
      && ( delta < 5
        && l( "maintenant", "just now")
        || delta < 60
        && "" + Math.floor( delta )
        + l( " secondes", " seconds")
        || delta < 120
        && l( "1 minutes", "1 minute")
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
      && l( "un jour", "a day")
      || day_delta < 7
      && "" + day_delta
      + l( " jours", " days")
      || day_delta < 31
      && "" + Math.ceil( day_delta / 7 )
      + l( " semaines", " weeks")
      || day_delta >= 31
      && "" + Math.ceil( day_delta / 30.5 )
      + l( "mois", " months")
      ).replace( /^ /, ""); // Fix double space issue with "il y a "
}


console.log( "Inseme was loaded" );
