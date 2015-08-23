// TODO make 1 class and two separate objects for Scenario and Feature
var Log = (function(){
	var INDENT = '    ';

	var failedSents = [];

	//TEMPORARY
	var featurePassed = true;
	var passed = true;
	var featureName;
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
		// debug('CSL'+callStack.length);
		//zero element is headElement, it's not printed
		for (var i = callStack.length - 1; i >= 0; i--) {
			props = callStack[i].vars.content(indent+'    ');
			if(i > 0){
				str = str.concat(indent,'In Procedure: ',callStack[i].name);
				if(props.length){
					str = str.concat('\n',props);
				}
			// special case for errors in critical blocks
			}else if(callStack[0].name != scenarioName){
				str = str.concat(indent,'In ',callStack[0].name);
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
			if(msg){
				msg = substituteValues(msg, dataObject).replace(/\n/,'\n'+INDENT);
				alert(INDENT.concat("Raised ",errorName,': ',msg));
			}else{
				alert(INDENT.concat("Raised ",errorName));
			}
			if(errorName != 'syntax error'){
				var callStack = stringifyCallStack(INDENT);
				if(callStack.length) alert(callStack);
			}
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
		announceFeature: function(name){
			featurePassed = true;
			if(name.length){
				featureName = name;
				alert("Feature "+quote(name)+" executed.\n");
			} 
			else alert('Next Feature executed.\n');
		},
		announceScenario: function(name, tags){
			failedSents = [];
			passed = true;
			scenarioName = name;
			alert("Scenario "+quote(scenarioName)+" begins");
			if(tags) alert("It has tags "+tags.join());
		},
		print: function(str){
			alert((str) ? str.replace(/\n/,'\n'+INDENT) : '');
		},
		summarizeFeature: function(){
			if(featureName){
				var msg = 'Feature '.concat(quote(featureName), (featurePassed) ? ' passed':' failed');
				App.console(msg);
				featureName = undefined;
			}
		},
		summarizeScenario: function(){
			// update feature result
			if( !passed) featurePassed = false;
			if(scenarioName){
				alert('Scenario '.concat((passed) ? 'passed':'failed'));
				var str = stringifyFailedSents();
				// Redundant check?
				if(str.length) alert(str);
				else alert();

				scenarioName = undefined;
			}
		}
	}
})();