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

	var blockValid  = true;

	// In critical block any step failure considered to be runtime error
	// Ex: Afterward, Background, Finally 
	var isBlockCritical = false;

	// used to correspond names of step variables and Scenario Examples \ Procedure arguments
	var variables = callStack[0].vars;

	var setError = function(errorName, msg, dataObject){
		blockValid = false;
		Engine.runtimeError(errorName, msg, dataObject, isBlockCritical);
	}
	var setCallError = function(msg, dataObject){
		setError('procedure error', msg, dataObject);
	}

	var callProcedure = function(procedure, arg){
		debug('Running procedure '+quote(procedure.name));
		callStack.push({	name: procedure.name, vars:{}	});
		variables = callStack.last().vars;
		// get arg type & check errors
		var argType = verifyArgument(procedure, arg);
		if(blockValid){
			switch(argType){
				case ABSENT: 
					Core.runBlock(procedure); 
					break;
				case STRING: variables[procedure.params[0]] = arg;
					Core.runBlock(procedure);
					break;
				case DOC_STRING: var keepCriticalValue = undefined;
					Core.runBlock(procedure, keepCriticalValue, arg);
					break;
				case DATA_TABLE: Core.runCycle(procedure, arg);
			}
		}
		callStack.pop();
		variables = callStack.last().vars;
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
					setError(
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
			setError(
				'sentence error',
				"Sentence 'sentence' doesn't fit any step definition from group 'keyword'",
			{keyword: keyword, sentence: sent});
		}
		if(funcRes === false){
			debug('sentenceFailure called');
			Log.addFail(keyword, sent, arg);
			// fails of action steps are understood like errors and terminate scenario execution
			if(keyword != 'Then') setError(
				'step error',
				'Action step '.concat(quote(keyword,' ',sent), ' failed')
			);
			// in critical block any failed step considered to be error
			else if(isBlockCritical) setError(
				'step error',
				'Check '.concat(quote(keyword,' ',sent), ' in Finally block failed')
			);
		}
		return funcRes;
	};

	function verifyArgument(procedure, arg){
		var argType = 0; // error value
		if(!arg){
			debug('no arg');
			if(procedure.params) 
				setCallError("Procedure 'name' has got no arguments, but requires 'params.length'", procedure);
			else argType = ABSENT;
		}else if(typeof arg == 'string'){
			debug('arg string');
			if(procedure.params && procedure.params.length == 1){
				//
				argType = STRING;
			}else{
				setCallError("Procedure 'name' has 'params.length' parameters and got one string argument", procedure);
			}
		}else if(typeof arg[0] == 'string'){
			debug('arg is DocString');
			if(procedure.params)
				setCallError("Procedure 'name' has 'params.length' parameters and got one Doc String argument", procedure);
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
		pushDefinition: function(word, def){
			if(DEFINITIONS[word]){
				DEFINITIONS[word].push(def);
			}else{
				alert("Engine: Wrong definition kind +'"+word+"'");
			}
		},
		/*
		* @param {block} should contain properties 'steps' and 'name'
		* @param {critical} is executed block critical
		* true or false set new value, undefined keeps previous one
		* @param {defaultArg} argument for every block step, which doesn't have its own 
		*/
		runBlock: function(block, critical, defaultArg){
			blockValid = true;
			callStack.last().name = block.name;
			debug('Name: '+block.name);
			if(critical !== undefined){
				isBlockCritical = critical;
			}
			return block.steps.every(function(command){
				var word = command.word;
				var step = command.step;
				// default argument can be replaced by steps' personal arguments
				var arg  = (command.arg) ? command.arg : defaultArg;
				// debug('Execute '+word+' '+step.join("'"));
				Engine.setCurrentKeyword(word);
				var procedure = (step.length == 1) ? Engine.getProcedure(step[0]) : undefined;
				if(procedure){
					if( !procedure.invalid){
					     callProcedure(procedure, arg);
					}
					else setCallError("Attempt to access invalid procedure 'name'",procedure);
				}else{
					var sentence = collectSentence(step);
					if(blockValid){
						interpret(word, sentence.join(''), arg);
					}
					else debug('For this sentence Flow is invalid');
				}
				return blockValid;
			});
		},
		/*
		* Executes block with arguments from every table row.
		* Execution is interrupted, if iteration completes with error
		* If callback is passed to function, it is called after each iteration
		* and redefines iteration result. 
		* Critical flag is passed to every runBlock call, so callback can temporary
		* change isBlockCritical value.  
		*/
		// TODO behavior of finalBlock should be changeable
		// TODO test Given fail in the middle.
		runCycle: function(block, table, critical, callback){
			debug('runCycle');
			// names of table columns can be redefined using keyword 'With'
			var params = (block.params) ? block.params : table[0]; 
			// Doubtful approach: procedure will remember parameters names after first call and use them later
			// // to get more sane messages about number of procedure parameters
			// procedure.params = params; 
			//excluding row with names TODO describe
			table.shift();
			table.every(function(row){
				var res = false;
				if(params.length == row.length){
					// assign values from the table row to procedure parameters
					for (var i = 0; i < params.length; i++) {
						variables[params[i]] = row[i];
					}
					debug(variables.content());
					debug('block length '+block.steps.length);
					res = Core.runBlock(block, critical);
				}else{
					//TEMPORARY to avoid printing failed procedure in callStack with old variables
					var called = callStack.pop();
					setCallError(
						"Data Table row |"+row.join('|')+'|\n' +
						"Procedure 'name' has "+params.length+" parameters, but got "+row.length+" arguments",
					block);
					callStack.push(called);
				}
				return (callback) ? callback() : res;
			});
			// reset of used variables
			for (var i = 0; i < params.length; i++) {
				variables[params[i]] = undefined;
			}
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