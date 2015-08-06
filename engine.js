// stores procedures in the object form: procedures[name] = {
//		params: array of procedure parameters(strings)
//		steps: array of steps(string arrays)
//	}
// also has special vault procedures[0] to store Scenario Outline steps
var procedures = [];

// Stores sequence of Finally block steps in currentlly loaded Scenario || Outline
// becomes UNDEFINED at the beginning of next scenario
var finallyBuffer;

var Core = (function(){
	/* Lists, containing step definition objects
	* {reg: regular expression matching step, func: step definition} 
	* Their preliminary definition is necessary to build Engine.CORRESPONDENCE properly. */
	var given = [];
	var when = [];
	var then = [];

	// ARGUMENT TYPES
	var ABSENT = 1;
	var STRING = 2;
	var DOC_STRING = 3;
	var DATA_TABLE = 4;

	var CORE_DEBUG = true;

	// used as map to select proper list by the keyword 
	var DEFINITIONS = {
		Given: given,
		When: when,
		Then: then
	};

	//TODO comments
	var callStack = [{
		name: 'headElement',
		vars: []
	}];

	// used to correspond names of step variables and Scenario Examples \ Procedure arguments
	var variables = {};

	//shortcut for FLow.runtimeError
	var callError = function(msg, procedure){
		Flow.runtimeError('procedure error', msg, procedure);
	}

	/*If step contains some variables (even parts of array),
	* function creates resulting step to be matched to regular expressions
	* by substituting values from 'variables' map.
	* @param sentence -- array to store resulting step*/
	function collectSentence(step){
		var sentence = [];
		var value;
		for(var i = 0; i < step.length; i++){
			if(i % 2){
				value = variables[step[i]];
				if(value){
					sentence[i] = value;
				}else{
					Flow.runtimeError(
						'step error', 
						"In the step ".concat(quote(step.join("'"))," variable ",quote(step[i])," isn't defined")
					);
					break;
				}
			}
			else sentence[i] = step[i];
		}
		return sentence;
	}

	var debug = function(msg){
		if(CORE_DEBUG && App.debug) alert("Core: "+msg);
	}

	/** Arguments:
	*	kind -- string 'Given','When' or 'Then'
	*	sent -- can be string or array of strings
	*	        array is used, when step contains <variables>
	*	        in that case each even element is a name of variable
	*	arg  -- optional step argument like DocString or DataTable
	*
	*	Returns:
	*	undefined, when function defined for step doesn't return anything
	*		or there's no suitable step definition,
	*	result of function executing, if it returns something. */

	function interpret(keyword, sent, arg){
		debug("Interpret "+quote(keyword+" "+sent));
		var funcRes, testRes;
		var defs = DEFINITIONS[keyword];
		if( !defs.some(function(step){
			testRes = step.reg.exec(sent); // returns array with matchings or null
			if(testRes){
				// zero element of testRes contains all the matching, other elements matching of special groups
				testRes.shift();
				if(arg){ 
					testRes.push(arg);
				}
				funcRes = step.func.apply({}, testRes);
				return true; //interrupt cycle
			}
		})){
			Flow.runtimeError(
				'sentence error',
				"Sentence 'sentence' doesn't fit any step definition from group 'keyword'",
			{keyword: keyword, sentence: sent});
		}
		if(funcRes === false) Flow.sentenceFailure(sent, arg);
		return funcRes;
	};

	// TODO behavior of final should be changable
	// TODO test Given fail in the middle.
	function runCycledProcedure(procedure, table){
		debug('runCycledProcedure');
		// names of table columns can be redefined using keyword 'With'
		var params = (procedure.params) ? procedure.params : table[0]; 
		// Doubtful approach: procedure will remember parameters names after first call and use them later
		// // to get more sane messages about number of procedure parameters
		// procedure.params = params; 

		//excluding row with names TODO describe
		table.forfurther(0, function(row){
			if(params.length == row.length){
				// assign values from the table row to procedure parameters
				for (var i = 0; i < params.length; i++) {
					variables[params[i]] = row[i];
				}
				debug('procedure length '+procedure.steps.length);
				runSteps(procedure.steps);
			}else{
				//TEMPORARY to avoid printing failed procedure in callStack with old variables
				var called = callStack.pop();
				callError(
					"Data Table row |"+row.join('|')+'|\n' +
					"Procedure 'name' has "+params.length+" parameters, but got "+row.length+" arguments",
				procedure);
				callStack.push(called);
			}
			if(procedure == procedures[0]){
				if(finallyBuffer && !Flow.isAborted()){
					debug('run final');
					Flow.nextBlock(Flow.FINALLY);
					runSteps(finallyBuffer);
				}
				if( !Flow.skipFeature()){
					Flow.nextBlock(Flow.OUTLINE_ITERATION);
				}
				else debug('Feature is skipped');
			}
		});
	}

	function runSteps(steps, defaultArg){
		steps.every((defaultArg) ? function(command){
			// default argument can be replaced by steps' personal arguments
			var arg = (command.arg) ? command.arg : defaultArg;
			Core.execute(command.word, command.step, arg);
			return Flow.valid();
		} : function(command){
			var res = Core.execute(command.word, command.step, command.arg);
			return Flow.valid();
		});
	}
	function verifyArgument(procedure, arg){
		var argType = 0; // error value
		if(!arg){
			debug('no arg');
			if(procedure.params) 
				callError("Procedure 'name' has got no arguments, but requires 'params.length'", procedure);
			else argType = ABSENT;
		}else if(typeof arg == 'string'){
			debug('arg string');
			if(procedure.params && procedure.params.length == 1){
				//
				argType = STRING;
			}else{
				callError("Procedure 'name' has 'params.length' parameters and got one string argument", procedure);
			}
		}else if(typeof arg[0] == 'string'){
			debug('arg is DocString');
			if(procedure.params)
				callError("Procedure 'name' has 'params.length' parameters and got one Doc String argument", procedure);
			else argType = DOC_STRING;
		}else{
			debug('arg is table');
			argType = DATA_TABLE;
		}
		return argType;
	};

	return {
		execute: function(word, step, arg){
			debug('Execute '+word+' '+step.join("'"));
			Flow.setCurrentKeyword(word);
			if(step.length == 1 && procedures[step[0]]){
				// step contains procedure call
				var procedure = procedures[step[0]];
				if( !procedure.invalid){
					debug('Running procedure '+quote(procedure.name));
					callStack.push({	name: procedure.name, vars:{}	});
					variables = callStack.last().vars;
					// get arg type & check errors
					var argType = verifyArgument(procedure, arg);
					if(Flow.valid()){
						switch(argType){
							case ABSENT: runSteps(procedure.steps); 
								break;
							case STRING: variables[procedure.params[0]] = arg;
								runSteps(procedure.steps);
								break;
							case DOC_STRING: runSteps(procedure.steps, arg);
								break;
							case DATA_TABLE: runCycledProcedure(procedure, arg);
						}
					}
					debug('pop '+quote(callStack.last().name));
					callStack.pop();
					variables = callStack.last().vars;
				}else callError("Attempt to access invalid procedure 'name'",procedure);
			}else{
				var sentence = collectSentence(step);
				if(Flow.valid()){
					interpret(word, sentence.join(''), arg);
				}
				else debug('For this sentence Flow is invalid');
			}
		},
		pushDefinition: function(word, def){
			if(DEFINITIONS[word]){
				DEFINITIONS[word].push(def);
			}else{
				alert("Engine: Wrong definition kind +'"+word+"'");
			}
		},
		stringifyCallStack: function(indent){
			var str = '', props;
			//debug('CSL'+callStack.length);
			//zero element is headElement, it's not printed
			for (var i = callStack.length - 1; i > 0; i--) {
				str += indent+'In Procedure: '+callStack[i].name;
				props = callStack[i].vars.content(indent+'    ');
				if(props.length){
					str = str.concat('\n',props);
				}
			};
			return str;
		}
	};
})();

var Engine = (function(){

	//TODO add var OUTLINE = 0

	// If procedure can't be loaded to procedures[name], ex. name is duplicated
	// then it's loaded to procedures[CARANTINE]
	// to avoid long list of errors "Engine: sentence 'step' is loaded to an undefined procedure"
	// It exists for some time, but can't be called
	var CARANTINE = 1;

	var ENGINE_DEBUG = true;

	// points at procedure object, which is currently loaded
	// becomes UNDEFINED, after loading is completed
	var loadedProcedure;

	var debug = function(msg){
		if(ENGINE_DEBUG && App.debug) alert('Engine: '+msg);
	}

	return {
		addFinallyBlock: function(){
			debug('Add finally');
			finallyBuffer = [];
			if( !loadedProcedure){
				// scenario execution
				if( !Flow.isAborted()){
					Flow.nextBlock(Flow.FINALLY); 
					debug('Finally is executed');
				}
				else debug('Finally is omitted');
			}
			else if(loadedProcedure != procedures[0]){
				Flow.loadError("Unexpected block Finally", loadedProcedure);
				finallyBuffer = undefined;
			}
		},
		// appends step to loading procedure or scenario outline
		appendToLoading: function(word, step, arg){
			if(loadedProcedure){
				((finallyBuffer) ? finallyBuffer : loadedProcedure.steps)
				.push({
					word: word,
					step: step,
					arg: arg
				});
			}else{
				alert("Engine: sentence '"+step+"'\n is loaded to an undefined procedure");
			}
		},
		catchSyntaxError: function(msg){
			if(loadedProcedure && loadedProcedure != procedures[0]) Flow.loadError(msg, loadedProcedure);
			else Flow.runtimeError('syntax error', msg);
		},
		// to get last report
		finish: Flow.nextScenario,
		newOutline: function(name, tags){
			Flow.nextScenario(name, tags);
			finallyBuffer = undefined;
			procedures[0] = {name: name, params: undefined, steps: []};
			loadedProcedure = procedures[0];
		},
		newProcedure: function(name, params){
			Flow.nextScenario();// to print report and insert new line
			finallyBuffer = undefined;

			debug("Engine: Loading Procedure "+name);
			if( !procedures[name]){
				procedures[name] = {name: name, params: params, steps: []};
				loadedProcedure = procedures[name];
			}else{
				Flow.loadError("there is another procedure with name "+name);
				procedures[CARANTINE] = {name: name, params: undefined, steps: []};
				loadedProcedure = procedures[CARANTINE];
			}
		},
		newScenario: function(name, tags){
			debug('New scenario '+quote(name));
			if(loadedProcedure) loadedProcedure = undefined;
			Flow.nextScenario(name, tags);
			// to avoid steps recording and their following reiteration
		},
		run: function(word, step, arg){
			if(finallyBuffer){
				 // finally block of scenario
				if( !Flow.isAborted()){
					debug('We are in Finally block of Scenario');
					Core.execute(word, step, arg);
					finallyBuffer.push({
						word: word,
						step: step,
						arg: arg
					});
				}
			}else{
				// main part of scenario
				// OR can be omitted Finally part: in that case Flow.valid() == false
				if(Flow.valid()) Core.execute(word, step, arg);
				else debug('This is ignored');
			}
		},
		// runs loaded outline with following examples table
		runOutline: function(examples, exampleTags){
			debug('runOutline');
			if(loadedProcedure && loadedProcedure == procedures[0]){ 
				// Scenario Outline
				// TODO call Flow method and pass exampleTags to it
				if( !loadedProcedure.invalid){
					// Trick to call Outline like usual procedure
					// First argument has no meaning and written for debugging purpose
					// Second forces Core to check for procedures[0], which exist, and call it.
					// TODO add defense against numeric steps 
					Core.execute('Run procedure',[0], examples);
				}else callError("Scenario Outline 'name' has syntax error and can't be executed",
				      loadedProcedure);
			}else alert('Engine: Not found Scenario Outline to use this Examples for.');
		}
	};
})();

var After = function(func){
	Engine.after = func; 
};
var Before = function(func){
	Engine.before = func;
};
var Given = function(reg,func){
	Core.pushDefinition('Given',{
		reg: reg,
		func: func
	});
};
var When = function(reg,func){
	Core.pushDefinition('When',{
		reg: reg,
		func: func
	});
}
var Then = function(reg, func){
	Core.pushDefinition('Then',{
		reg: reg,
		func: func
	});
}