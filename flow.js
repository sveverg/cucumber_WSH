var Log = (function(){
	var INDENT = '    ';

	var failedSents = [];

	var passed = true;
	var scenarioName;

	var debug = function(msg){
		if(App.debug) alert('Log: '+msg);
	}

	// returns obj[key1]...[keyN] or undefined
	var getPropertyByKeys = function(obj, keys){
		// object to check for the next key in list
		var property = obj;
		// cycle stops, when property becomes undefined
		keys.every(function(key){
			property = property[key];
			return property !== undefined;
		});
		return property;
	}

	//single quote
	var sq = function(str){
		return "'".concat(str,"'");
	}

	var stringifyCallStack = function(indent){
		var callStack = Core.callStack();
		var str = '', props;
		debug('CSL'+callStack.length);
		//zero element is headElement, it's not printed
		for (var i = callStack.length - 1; i >= 0; i--) {
			props = callStack[i].vars.content(indent+'    ');
			if(i > 0){
				str = str.concat(indent,'In Procedure: ',callStack[i].name);
				if(props.length){
					str = str.concat('\n',props);
				}
			}else if(props.length){
				str = str.concat(indent, 'In Scenario: ',scenarioName,'\n',props);
			}
		};
		return str;
	}

	var stringifyFail = function(failed){
		msg = "Failed "+quote(failed.word," ",failed.sent);
		if(failed.arg) msg = msg.concat(" called with ",failed.arg);
		if(failed.stack.length) msg += '\n'+failed.stack;
		return msg;
	}

	var stringifyFailedSents = function(){
		var str = "";
		debug('Number of failed sentences '+failedSents.length);
		failedSents.foreach(function(failed){
			str += INDENT + stringifyFail(failed)+'\n';
		});
		return str; 
	}

	// @param msg is string, that can contain groups in single quotes like 'property1. ... .propertyN'
	// If dataObject[property1]...[propertyN] is defined, function substitutes this value 
	// into string instead of 'group'. String values are wrapped in double quotes.
	var substituteValues = function(msg, dataObject){
		// matching quoted sequence of properties
		var groupRegExp = /'[A-Za-z0-9_\.]+'/;
		// simple message string can contain words in single quotes
		// that will cause errors with 'property'
		if( !dataObject) return msg;

		var searched = msg;
		var groupPos = searched.search(groupRegExp);
		while(groupPos != -1){
			var secondQuote = searched.indexOf("'", groupPos+1);
			// can be obtained better?
			var group = searched.substring(groupPos+1, secondQuote) // group without quotes 
			var property = getPropertyByKeys(dataObject, group.split('.'));
			if(property !== undefined){
				// also double-quote string values
				msg = msg.replace(new RegExp(sq(group)), 
					(typeof property == "string") ? quote(property) : property);
			}
			searched = msg.slice(groupPos + (msg.length - searched.length));
			groupPos = searched.search(groupRegExp);
		}
		return msg;
	}

	return{
		addError: function(errorName, msg, dataObject, fatal){
			passed = false;
			if(fatal){
				errorName = 'fatal '+errorName;
			}
			msg = substituteValues(msg, dataObject).replace(/\n/,'\n'+INDENT);
			alert(INDENT.concat("Raised ",errorName,': ',msg));
			var callStack = stringifyCallStack(INDENT);
			if(callStack.length) alert(callStack);
		},
		addFail: function(word, sent, arg){
			passed = false;
			failedSents.push({
				word: word,
				sent: sent, 
				arg: arg,
				stack: stringifyCallStack(INDENT)
			});
		},
		print: function(str){
			alert((str) ? str.replace(/\n/,'\n'+INDENT) : '');
		},
		printReport: function(){
			if(scenarioName){
				alert('Scenario '.concat((passed) ? 'passed':'failed'));
				var str = stringifyFailedSents();
				// Redundant check?
				if(str.length) alert(str);
				else alert();

				scenarioName = undefined;
			}
		},
		recordScenario: function(name, tags){
			failedSents = [];
			passed = true;
			scenarioName = name;
			alert("Scenario "+quote(scenarioName)+" begins");
			if(tags) alert("It has tags "+tags.join());
		}
	}
})();

/* Controls execution of blocks Finally, Background and Ending.
*  Accepts notifications about step failures and errors.
*  Stores and prints information about executed scenario.*/
var Flow = (function(){
	// keyword of currently executed step
	// required to define engine behavior in case of error || step failure
	// see Flow.isAborted()
	var currentKeyword;

	var state;

	// has error happened in current block: Finally, Outline iteration etc.
	var blockError = false;

	// Special mark, which prevents execution of any Scenario in file
	// Right now triggered in case of syntax or runtime error in Finally block
	// This mark prevents reset of blockError, so no more step definitions will be ever executed
	var skipFeature = false;

	var debug = function(msg){
		if(App.debug) alert('Flow: '+msg);
	}

	// Handles all the errors, which happened while Scenario was read || any steps executed 
	// Common: nothing marked invalid
	//TODO check procedure errors handling and sth like that(without Given, but need abort)
	var runtimeError = function(errorName, msg, dataObject){
		debug('Runtime error called');
		blockError = true;
		if(state == State.FINALLY){
			skipFeature = true;
		}else if(!currentKeyword || currentKeyword == 'Given'){
			debug('Set state ABORTED');
			debug('currentKeyword '+currentKeyword);
			state = State.ABORTED;
		}
		Log.addError(errorName, msg, dataObject, state == State.FINALLY);
	}

	return {
		allowsScenario: function(name, tags){
			// TEMPORARY
			return !skipFeature;
		},
		allowsExamples: function(tags){
			return true;
		},
		printState: function(){
			switch(state){
				case State.ABORTED: debug('State: ABORTED');
					break;
				case State.FINALLY: debug('State: FINALLY');
					break;
				case State.LOADING: debug('State: LOADING');
					break;
				case State.SCENARIO_BODY: debug('State: SCENARIO_BODY');
					break;
				default: alert('Error state '+state);
			}
		},
		runtimeError: runtimeError,
		setCurrentKeyword: function(word){
			currentKeyword = word;
		},
		// @param {blockType} one of numeric constants, provided by Flow
		setState: function(blockType){
			// TEMPORARY check, write assert
			if(blockType < 10){
				alert('Error: Wrong block type '+blockType);
				return;
			}
			state = blockType;
			currentKeyword = undefined;
			if( !skipFeature){
				// without that reset step definitions won't be executed,
				// because Core methods check Flow.valid()
				blockError = false;
			}
			else debug('skip feature');
		},
		skipFeature: function(){
			return skipFeature;
		},
		state: function(){
			return state;
		},
		valid: function(){
			return !blockError;
		}
	}
})();