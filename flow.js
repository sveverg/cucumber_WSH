/* Controls execution of blocks Finally, Background and Ending.
*  Accepts notifications about step failures and errors.
*  Stores and prints information about executed scenario.*/
var Flow = (function(){
	var INDENT = '    ';
	var STEP_JOIN_SYMBOL = "'";

	// keyword of currently executed step
	// required to define engine behavior in case of error || step failure
	// see Flow.isAborted()
	var currentKeyword;
	// has error happened in current block: Finally, Outline iteration etc.
	var blockError = false;

	// contains list of failed steps like objects with properties
	// { name, step, arg, stack: stringified call stack}
	var failedSents = [];

	var finallyExecuted = false;

	var passed = true;

	// Special mark, which prevents execution of any Scenario in file
	// Right now triggered in case of syntax or runtime error in Finally block
	// This mark prevents reset of blockError, so no more step definitions will be ever executed
	var skipFeature = false;
	//
	var scenarioName;


	var debug = function(msg){
		if(App.debug) alert('Flow: '+msg);
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

	// Handles all the errors, which happened while Scenario was read || any steps executed 
	// Common: nothing marked invalid
	//TODO check procedure errors handling and sth like that(without Given, but need abort)
	var runtimeError = function(errorName, msg, dataObject){
		debug('Runtime error called');
		blockError = true;
		passed = false;
		if(finallyExecuted){
			skipFeature = true;
			errorName = 'fatal '+errorName;
			msg += ' in block Finally';
		}
		msg = substituteValues(msg, dataObject).replace(/\n/,'\n'+INDENT);
		alert(INDENT.concat("Raised ",errorName,': ',msg));
		var callStack = Core.stringifyCallStack(INDENT);
		if(callStack.length) alert(callStack);
	}

	//single quote
	var sq = function(str){
		return "'".concat(str,"'");
	}

	// var stringifyCallStack = function(){
	// 	var str = '', props;
	// 	//debug('CSL'+callStack.length);
	// 	//zero element is headElement, it's not printed
	// 	for (var i = callStack.length - 1; i > 0; i--) {
	// 		str += INDENT+'In Procedure: '+callStack[i].name;
	// 		props = callStack[i].vars.content(INDENT+'    ');
	// 		if(props.length){
	// 			str = str.concat('\n',props);
	// 		}
	// 	};
	// 	return str;
	// }

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

	return {
		// block types
		FINALLY: 1, 
		OUTLINE_ITERATION: 2,
		// will finally block be executed
		isAborted: function(){
			//if(App.debug) alert('Current keyword is '+currentKeyword);
			// Example for variant "!currentKeyword" is Outline with syntax error
			return blockError && (!currentKeyword || currentKeyword == 'Given');
		},
		// syntax errors, that happened during procedure loading
		loadError: function(msg, procedure){
			alert('Load error: '+msg.replace(/\n/,'\n'+INDENT));
			// procedure can be undefined. ex: attempt to load procedure with duplicated name
			if(procedure){
				procedure.invalid = true;
				alert('Happened in procedure '+quote(procedure.name));
			}
			alert();
		},
		// @param {blockType} one of numeric constants, provided by Flow
		nextBlock: function(blockType){
			// without that reset step definitions won't be executed,
			// because Core methods check Flow.valid()
			if( !skipFeature){
				blockError = false;
				debug('blockError reset');
			}
			currentKeyword = undefined;
			switch(blockType){
				case this.FINALLY: finallyExecuted = true;
					break;
				case this.OUTLINE_ITERATION: finallyExecuted = false;
					break;
				default: alert('Wrong blockType for the Flow.nextBlock()');
			}
		},
		nextScenario: function(name, tags){
			if(scenarioName){
				alert('Scenario '.concat((passed) ? 'passed':'failed'));
				var str = stringifyFailedSents();
				if(str.length) alert(str);
				else alert();
			}else{
				debug('Void call');
			}
			if(!skipFeature){
				scenarioName = name;
				failedSents = [];
				blockError = false;
				passed = true;
				if(scenarioName){
					alert("Scenario "+quote(scenarioName)+" begins");
					if(tags) alert("It has tags "+tags.join());
				}
			}else{
				debug('skip feature');
				// to avoid repeating same report
				scenarioName = undefined;
				// and blockError stays true, nothing is executed
			}
			// syntax check continues
			currentKeyword = undefined;
			finallyExecuted = false;
		},
		runtimeError: runtimeError,
		sentenceFailure: function(sent, arg){
			debug('sentenceFailure called');
			passed = false;
			failedSents.push({
				word: currentKeyword,
				sent: sent,
				arg: arg,
				stack: Core.stringifyCallStack(INDENT)
			});
			debug('failed sentence remembered');
			// fails of action steps are understood like errors and terminate scenario execution
			// in block Finally any failed step terminates whole feature
			if(currentKeyword != 'Then' || finallyExecuted) runtimeError(
				'step error',
				'Action step '.concat(quote(currentKeyword,' ',sent), ' failed')
			);
		},
		setCurrentKeyword: function(word){
			currentKeyword = word;
		},
		skipFeature: function(){
			return skipFeature;
		},
		valid: function(){
			return !blockError;
		}
	}
})();