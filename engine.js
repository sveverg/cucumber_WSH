var State = {
	// Terminates scenario without calling Finally
	ABORTED: 10,
	// Executing service block, in which any Then failure considered to be runtime error
	// Ex: Afterward, Background, Finally 
	CRITICAL_BLOCK: 11, 
	// Loading procedure, outline body, finally, background...
	// whatever loadedProcedure points at.
	LOADING: 12,
	//
	SCENARIO_BODY: 13
};

// stores procedures in the object form: procedures[name] = {
//		params: array of procedure parameters(strings)
//		steps: array of steps(string arrays)
//	}
// also has special vault procedures[0] to store Scenario Outline steps
var procedures = [];

var SCENARIO = 0;

// If procedure can't be loaded to procedures[name], ex. name is duplicated
// then it's loaded to procedures[CARANTINE]
// to avoid long list of errors "Engine: sentence 'step' is loaded to an undefined procedure"
// It exists for some time, but can't be called
var CARANTINE = 1;
// This cell is used to store Finally blocks
// It can be pointed by loadedProcedure in appendToLoading()
// or accessed directly in run()
var FINALLY = 2;
var BACKGROUND = 3;
var AFTERWARD = 4;

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
		vars: {}
	}];

	// used to correspond names of step variables and Scenario Examples \ Procedure arguments
	var variables = callStack[0].vars;

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
		if(funcRes === false){
			debug('sentenceFailure called');
			Log.addFail(keyword, sent, arg);
			// fails of action steps are understood like errors and terminate scenario execution
			if(keyword != 'Then') Flow.runtimeError(
				'step error',
				'Action step '.concat(quote(keyword,' ',sent), ' failed')
			);
			// in critical block any failed step considered to be error
			else if(Flow.state() == State.CRITICAL_BLOCK) Flow.runtimeError(
				'step error',
				'Check '.concat(quote(keyword,' ',sent), ' in Finally block failed')
			);
		}
		return funcRes;
	};

	// TODO behavior of finalBlock should be changeable
	// TODO test Given fail in the middle.
	function runCycledProcedure(procedure, table, callback){
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
				debug(variables.content());
				debug('procedure length '+procedure.steps.length);
				runSteps(procedure);
			}else{
				//TEMPORARY to avoid printing failed procedure in callStack with old variables
				var called = callStack.pop();
				callError(
					"Data Table row |"+row.join('|')+'|\n' +
					"Procedure 'name' has "+params.length+" parameters, but got "+row.length+" arguments",
				procedure);
				callStack.push(called);
			}
			if(callback) callback();
		});
		// reset of used variables
		for (var i = 0; i < params.length; i++) {
			variables[params[i]] = undefined;
		}
	}

	function runSteps(procedure, defaultArg){
		callStack.last().name = procedure.name;
		procedure.steps.every((defaultArg) ? function(command){
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
		callStack: function(){
			return callStack;
		},
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
							case ABSENT: runSteps(procedure); 
								break;
							case STRING: variables[procedure.params[0]] = arg;
								runSteps(procedure);
								break;
							case DOC_STRING: runSteps(procedure, arg);
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
		// TEMPORARY until refactored
		runAfterward: function(){
			if(procedures[AFTERWARD]){
				Flow.setState(State.CRITICAL_BLOCK);
				runSteps(procedures[AFTERWARD]);
			}
		},
		// @param {hasFinally} whether executed scenario has block Finally
		runScenario: function(hasFinally){
			// if scenario execution is allowed by Flow
			if(Flow.state() != State.ABORTED){
				if(procedures[BACKGROUND]){
					Flow.setState(State.CRITICAL_BLOCK);
					runSteps(procedures[BACKGROUND]);
				}
				//no errors in Background
				if(Flow.valid()){
					// space for Background
					Flow.setState(State.SCENARIO_BODY);
					runSteps(procedures[SCENARIO]);
					if(hasFinally && Flow.state() != State.ABORTED){
						Flow.setState(State.CRITICAL_BLOCK);
						runSteps(procedures[FINALLY]);
					}
				}
				//if Background was called, Afterward is called in any case
				if(procedures[AFTERWARD]){
					Flow.setState(State.CRITICAL_BLOCK);
					runSteps(procedures[AFTERWARD]);
				}
			}
			else debug('Scenario skipped');
		},
		runOutline: function(examples, hasFinally){
			// used to call finally after each examples row
			// and avoid outline interruption after first error occurred
			var cycleCallback = function(){
				if(hasFinally && Flow.state() != State.ABORTED){
					debug('run outline final');
					Flow.setState(State.CRITICAL_BLOCK);
					runSteps(procedures[FINALLY]);
				}
				// TEMPORARY crutch
				if( !Flow.skipFeature()){
					// block errors reset
					Flow.setState(State.SCENARIO_BODY);
				}
			}
			// first execution
			if(Flow.state() == State.LOADING){
				if(procedures[BACKGROUND]){
					Flow.setState(State.CRITICAL_BLOCK);
					runSteps(procedures[BACKGROUND]);
				}
			}
			// if execution of examples is permitted by Flow
			if(Flow.state() != State.ABORTED){
				// TODO local methods should not change Flow state(!)
				Flow.setState(State.SCENARIO_BODY);
				// function is executed after every row of examples
				runCycledProcedure(procedures[SCENARIO], examples, cycleCallback);
			}
			// Afterward is called in finishLoad()
		}
	};
})();

var Engine = (function(){

	var ENGINE_DEBUG = true;

	// points at procedure object, which is currently loaded
	// becomes UNDEFINED, after loading is completed
	var loadedProcedure;

	var debug = function(msg){
		if(ENGINE_DEBUG && App.debug) alert('Engine: '+msg);
	}

	var isNotProcedure = function(loadedBlock){
		return loadedBlock == procedures[SCENARIO] || loadedBlock == procedures[FINALLY];
	}

	var loadError = function(msg, procedure){
		Log.print('Load error: '+msg);
		if(procedure){
			procedure.invalid = true;
			Log.print('Happened in procedure '+quote(procedure.name));
		} 
		Log.print();
	}

	return {
		addAfterward: function(){
			if(!loadedProcedure || loadedProcedure == procedures[BACKGROUND]){
				procedures[AFTERWARD] = {name: 'Afterward block', steps: []};
				loadedProcedure = procedures[AFTERWARD];
				Flow.setState(State.LOADING);
			}
			else loadError('Block Afterward can be preceded only by Background block');
			// TODO add to CARANTINE
		},
		addBackground: function(){
			if(!loadedProcedure){
				procedures[BACKGROUND] = {name: 'Background block', steps: []};
				loadedProcedure = procedures[BACKGROUND];
				Flow.setState(State.LOADING);
			}
			else loadError('No block can precede block Background');
		},
		addFinallyBlock: function(){
			// Flow.printState();
			if(loadedProcedure == procedures[SCENARIO] || loadedProcedure == procedures[CARANTINE]){
				procedures[FINALLY] = {
					name: 'Finally block',
					steps: []
				};
				loadedProcedure = procedures[FINALLY];
			}
			else if(loadedProcedure == procedures[FINALLY]){
			     loadError("Second block Finally is not allowed", loadedProcedure);
			}
			else loadError("Block Finally after procedure is not allowed", loadedProcedure);
		},
		// appends step to loading procedure or scenario outline
		appendToLoading: function(word, step, arg){
			Flow.printState();
			if(Flow.state() == State.LOADING){
				loadedProcedure.steps.push({
					word: word,
					step: step,
					arg: arg
				});
			}else if(Flow.state() != State.ABORTED){
				// TODO add array support to Log
				Flow.runtimeError(
					"syntax error",
					"Unexpected step ".concat(quote(word,' ',step)," after Examples block")
				);
			}
		},
		//TODO move this check to Flow
		catchSyntaxError: function(msg){
			if(Flow.state() == State.LOADING && loadedProcedure != procedures[0]){
				loadError(msg, loadedProcedure);
			}
			else Flow.runtimeError('syntax error', msg);
		},
		finishLoad: function(){
			if(isNotProcedure(loadedProcedure)){
				// if scenario was no times executed, but also wasn't aborted 
				if(Flow.state() == State.LOADING){
					debug('Run last scenario');
					// suggest, it's not scenario outline, and execute it
					// argument hasFinally
					Core.runScenario(loadedProcedure == procedures[FINALLY]);
				}else if(Flow.state() != State.ABORTED){
					// suggest, it's scenario outline
					// execute Afterwards by Core
					Core.runAfterward();
				}
				Log.printReport();
			}
			else debug('Doing nothing');
		},
		// TODO defense against numeric procedure names
		newProcedure: function(name, params){
			debug("Loading Procedure "+name);
			Flow.setState(State.LOADING);
			var procName = name;
			if(procedures[name]){
				loadError("there is another procedure with name "+name);
				procName = CARANTINE;
			} 
			procedures[procName] = {name: name, params: params, steps: []};
			loadedProcedure = procedures[procName];
		},
		newScenario: function(name, tags){
			if(Flow.allowsScenario(name, tags)){
				Flow.setState(State.LOADING);
				Log.recordScenario(name, tags);
				procedures[SCENARIO] = {name: name, steps: []};
				loadedProcedure = procedures[SCENARIO];
			}else{
				Flow.setState(State.ABORTED);
				procedures[CARANTINE] = {name: name, steps: []};
				loadedProcedure = procedures[CARANTINE];
				debug('Scenario '+quote(name)+'is omitted');
			} 
		},
		// runs loaded outline with following examples table
		runOutline: function(examples, exampleTags){
			debug('runOutline');
			if(isNotProcedure(loadedProcedure)){
				if(Flow.allowsExamples(exampleTags)){
					// second argument {hasFinally}
					Core.runOutline(examples, loadedProcedure == procedures[FINALLY]);
				}
				else debug('Examples are omitted');
			}
			else loadError("Procedure can't be executed with Examples", loadedProcedure);
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