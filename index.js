const SlackBot = require('slackbots');


const channel = 'foosball';
//const channelID = 'UCB7SEALU';
const amountOfPlayers = 4;

//Param info: https://api.slack.com/methods/chat.postMessage
const params = {
	icon_emoji: ':foos:'
};

// queue 
var queue = [];

// users accepting game
var userAccepts = {}; //value = 0: no response. Value = 1: accept. Value = 2: reject.

// userID to real_name map
var userIdToRealName = {};

// userID to name map
var userIdToName = {};

// create a bot
var bot = new SlackBot({
    token: 'xoxb-420812391766-433171433110-d2ccuFvA2sPIgCdqF0SkY3wM',
    name: 'FoosballBot'
});

//On statup handler
bot.on('start', function() {
	postSimpleMessageToChannel('Hi, I\'m FoosballBot! Use commands *!enqueue* and *!dequeue* to arrange foosball matches.');	
	
	initUserMaps();
	/*
	const channelData = bot.getChannels();
	console.log(channelData);
	*/
	
	console.log("Started FoosballBot.");
});

function initUserMaps(){
	const users = bot.getUsers();
	for(var i = 0; i < users._value.members.length; i++){
		const id = users._value.members[i].id;
		const name = users._value.members[i].name;
		const realName = users._value.members[i].real_name;
		
		userIdToName[id] = name;
		userIdToRealName[id] = realName;
	}
	
	//console.log(userIdToRealName);
}


//On message
bot.on('message', function(data) {
	//console.log(data);
	
    // all ingoing events https://api.slack.com/rtm
	if(data.type !== 'message' || 'bot_id' in data || !('text' in data) ){
		return;
	}
	
	determineCommand(data);
});


function determineCommand(message) {
	if(['!enqueue', '!en', '+'].includes(message.text.toLowerCase())){
		enqueue(message);
	} else if(['!dequeue', '!de', '-'].includes(message.text.toLowerCase())){
		dequeue(message);
	} else if (['!ready', '!r', 'r'].includes(message.text.toLowerCase())){
		readyConfirmation(message);
	}
}

function enqueue(message) {
	if(!queue.includes(message.user)){
		queue.push(message.user);
		postSimpleMessageToChannel(prettyPrintQueue());
		handleGameStart();
	} else {
		//postSimpleMessageToChannel( getUserRealNameById(message.user) + " is already enqueued. You can't play with yourself, now can you?\n" + prettyPrintQueue());
		postSimpleMessageToUser(message.user,  "You are already enqueued. You can't play with yourself, now can you?\n" + prettyPrintQueue());
	}
}

function dequeue(message) {
	
	if(message.user in userAccepts){
		userAccepts[message.user] = 2;
		postSimpleMessageToUser(message.user, "Your rejection of foosball and life itself has been registered.");
		handleConfirmationAnswer();
	} else {
		const queueLength = queue.length;
		queue = queue.filter(item => item !== message.user)
		if(queueLength !== queue.length)
			postSimpleMessageToChannel(prettyPrintQueue());
	}
}

function readyConfirmation(message){
	if(message.user in userAccepts){
		postSimpleMessageToUser(message.user, "Your acceptance has been registered.");
		userAccepts[message.user] = 1;
		handleConfirmationAnswer();
	} else if(Object.keys(userAccepts).length !== 0) {
		postSimpleMessageToUser(message.user, "You are not among the first 4 players in the queue.");
	} else {
		postSimpleMessageToUser(message.user, "There is no game to ready up for yet. I suggest disturbing your teammates until they sign up.");
	}
}

function handleGameStart() {
	if(Object.keys(userAccepts).length !== 0 || queue.length < amountOfPlayers)
		return;
	
	for (var i = 0; i < amountOfPlayers; i++) {
		userAccepts[queue[i]] = 0;
		postReadyConfirmationToUser(queue[i]);
	}
	
	postSimpleMessageToChannel("Enough players are enqueued. They have 60 seconds to register as ready.");

	setTimeout(() => handleConfirmationTimeout(), 60000);
}

function postSimpleMessageToChannel(message){
	bot.postMessageToChannel(channel, message, params);
}

function postSimpleMessageToUser(userID, message){
	bot.postMessageToUser(userIdToName[userID],message,params);
}

function prettyPrintQueue(){
	if(queue.length === 0)
		return 'The queue is empty';
	
	var result = "Current queue: ";
	for (var i = 0; i < queue.length; i++) {
		result = result + "\n " + (i + 1) + ". " + getUserRealNameById(queue[i]);
	}
	return result;
}

function getUserRealNameById(userID){
	if(!(userID in userIdToRealName))
		return 'anon';
	return userIdToRealName[userID];
}

function postReadyConfirmationToUser(userID){
	bot.postMessageToUser(userIdToName[userID],"A game is upcoming! Please type *!r* to register as ready. Type *!de* to reject the foosball game and life itself.", params);
}

function handleConfirmationAnswer(){
	for (var i = 0; i < amountOfPlayers; i++) {
		if(userAccepts[queue[i]] === 0)
			return;
	}
	
	for (var i = 0; i < amountOfPlayers; i++) {
		if(userAccepts[queue[i]] !== 1){
			handleConfirmationTimeout()
			return;
		}	
	}
	
	//We have a game!
	for (var i = 0; i < amountOfPlayers; i++) {
		postSimpleMessageToUser(queue[i], "Your game is ready! :man-running:");
	}
	postSimpleMessageToChannel("All players are ready. Game will commence");
	
	userAccepts = {}; //Reset accepts.
	
	queue.splice(0,4);
	
	handleGameStart();
	
	if(queue.length >= 1)
		postSimpleMessageToChannel(prettyPrintQueue());
}

function handleConfirmationTimeout(){
	if(Object.keys(userAccepts).length === 0) //there is an error here if 8 people sign up at the same time.
		return;
		
	for (var i = 0; i < amountOfPlayers; i++) {
		if(userAccepts[Object.keys(userAccepts)[i]] !== 1)
			queue = queue.filter(item => item !== Object.keys(userAccepts)[i]);
	}
	
	for (var i = 0; i < amountOfPlayers; i++) {
		postSimpleMessageToUser(queue[i], "Not all players were ready.\n" + prettyPrintQueue());
	}
	
	postSimpleMessageToChannel("Not all players were ready.\n" + prettyPrintQueue());

	userAccepts = {}; //Reset accepts.
	
	handleGameStart();
}

const readyParam = {
    "text": "Are you ready for foosball?",
    "attachments": [
        {
            "fallback": "You are unable to choose a ready up",
            "callback_id": "wopr_game",
            "color": "#3AA3E3",
            "attachment_type": "default",
            "actions": [
                {
                    "name": "game",
                    "text": "Ready",
                    "type": "button",
                    "value": "ready"
                },
                {
                    "name": "game",
                    "text": "Reject foosball and life itself",
					"style": "danger",
                    "type": "button",
                    "value": "denied",
					"confirm": {
                        "title": "Are you sure?",
						"text": "What could be more important than this?",
                        "ok_text": "Yes",
                        "dismiss_text": "No"
                    }
                }
            ]
        }
    ]
}


/*
//------------- Express ------------
//Would be needed for interactive components: https://api.slack.com/apps/ACR5114HL/interactive-messages?
var bodyParser = require('body-parser');
var express = require('express'),
  app = express();
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: false })); // support encoded bodies


var server = app.listen(28111, function () {
    console.log("app running on port.", server.address().port);
});

app.get('/',function(req,res){
   res.send("get");
   console.log("GREAT SUCCESS. GET");
});

app.post('/',function(req,res){
   res.send("post")
   console.log("GREAT SUCCESS. POST");
});
*/